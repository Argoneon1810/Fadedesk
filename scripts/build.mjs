import * as esbuild from "esbuild";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

/**
 * 화이트리스트 기반 Chrome MV3 확장 빌드·패키징 파이프라인 (app-build-architect 준수).
 * 개발 루트(docs/, tests/, .claude/, scripts/)와 분리된 dist/unpacked/ 및 dist/*.zip만 생성한다.
 * src/shared 및 src/content 변경을 감지하는 결정적 buildId를 생성해 런타임에 주입한다.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const STATIC_DIR = path.join(ROOT, "static");
const DIST_DIR = path.join(ROOT, "dist");
const UNPACKED_DIR = path.join(DIST_DIR, "unpacked");

function assertManifestPolicy(manifest) {
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version || "")) {
    throw new Error(`유의적 버전 3자리 숫자 위반: "${manifest.version}"`);
  }
  const perms = manifest.permissions || [];
  if (perms.includes("tabCapture")) {
    throw new Error("금지된 권한(tabCapture)이 manifest.json에 포함되어 있습니다.");
  }
}

/**
 * src/shared 및 src/content 아래 소스 파일의 상대 경로와 내용을 정렬해 SHA-256 해시 앞 12자를 산출한다.
 */
function computeBuildId(version) {
  const hash = crypto.createHash("sha256");
  const targetDirs = [
    path.join(ROOT, "src", "shared"),
    path.join(ROOT, "src", "content"),
  ];
  const filePaths = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else if (
        ent.isFile() &&
        (ent.name.endsWith(".ts") || ent.name.endsWith(".js") || ent.name.endsWith(".json"))
      ) {
        filePaths.push(full);
      }
    }
  }

  for (const d of targetDirs) {
    walk(d);
  }

  filePaths.sort();

  for (const fp of filePaths) {
    const rel = path.relative(ROOT, fp).replace(/\\/g, "/");
    hash.update(rel);
    hash.update("\0");
    hash.update(fs.readFileSync(fp));
    hash.update("\0");
  }

  const hash12 = hash.digest("hex").slice(0, 12);
  return `${version}-${hash12}`;
}

async function buildExtension() {
  const manifestRaw = fs.readFileSync(path.join(STATIC_DIR, "manifest.json"), "utf8");
  const manifest = JSON.parse(manifestRaw);
  assertManifestPolicy(manifest);

  const buildId = computeBuildId(manifest.version);

  fs.rmSync(UNPACKED_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(UNPACKED_DIR, "icons"), { recursive: true });

  // 1. 화이트리스트 정적 런타임 자산만 복사
  const staticWhitelist = [
    ["manifest.json", "manifest.json"],
    ["popup.html", "popup.html"],
    ["popup.css", "popup.css"],
    ["popup-strips.css", "popup-strips.css"],
    ["popup-fx.css", "popup-fx.css"],
    ["popup-help.css", "popup-help.css"],
    ["icons/icon16.png", "icons/icon16.png"],
    ["icons/icon32.png", "icons/icon32.png"],
    ["icons/icon48.png", "icons/icon48.png"],
    ["icons/icon128.png", "icons/icon128.png"],
  ];

  for (const [srcRel, destRel] of staticWhitelist) {
    const srcFile = path.join(STATIC_DIR, srcRel);
    if (!fs.existsSync(srcFile)) {
      throw new Error(`필수 정적 런타임 파일 누락: static/${srcRel}`);
    }
    fs.copyFileSync(srcFile, path.join(UNPACKED_DIR, destRel));
  }

  // 2. ES Module 엔트리 번들 (백그라운드 서비스 워커: manifest type="module")
  await esbuild.build({
    entryPoints: {
      background: path.join(ROOT, "src/background/background.ts"),
    },
    outdir: UNPACKED_DIR,
    bundle: true,
    format: "esm",
    target: "chrome114",
    charset: "utf8",
    legalComments: "none",
    logLevel: "warning",
    define: {
      __SOUND_MANAGER_BUILD_ID__: JSON.stringify(buildId),
    },
  });

  // 3. 클래식 IIFE 엔트리 번들 (팝업 UI + 콘텐츠 스크립트: 전역 스코프 격리 및 로컬/executeScript 호환)
  await esbuild.build({
    entryPoints: {
      popup: path.join(ROOT, "src/popup/popup.ts"),
      "audio-hook": path.join(ROOT, "src/content/audio-hook.ts"),
      "content-bridge": path.join(ROOT, "src/content/content-bridge.ts"),
    },
    outdir: UNPACKED_DIR,
    bundle: true,
    format: "iife",
    target: "chrome114",
    charset: "utf8",
    legalComments: "none",
    logLevel: "warning",
    define: {
      __SOUND_MANAGER_BUILD_ID__: JSON.stringify(buildId),
    },
  });

  // 4. 스토어/배포용 ZIP 아카이브 생성 (외부 Python 의존성 없이 Node 내장 zlib 단독 생성)
  const builtFiles = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else builtFiles.push(path.relative(UNPACKED_DIR, full).replace(/\\/g, "/"));
    }
  }
  walk(UNPACKED_DIR);
  builtFiles.sort();

  const zipName = `sound-manager-${manifest.version}.zip`;
  const zipPath = path.join(DIST_DIR, zipName);
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  writeZipArchive(UNPACKED_DIR, builtFiles, zipPath);

  console.log(
    `[PASS] Built Sound Manager v${manifest.version} (buildId: ${buildId}, ${builtFiles.length} runtime files):`,
  );
  console.log(`  - Unpacked: ${UNPACKED_DIR}`);
  console.log(`  - Archive : ${zipPath}`);
}

const CRC_TABLE = (() => {
  const tbl = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    tbl[i] = c >>> 0;
  }
  return tbl;
})();

function calcCrc32(buf) {
  if (typeof zlib.crc32 === "function") return zlib.crc32(buf) >>> 0;
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function writeZipArchive(baseDir, relFiles, outPath) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const rel of relFiles) {
    const nameBuf = Buffer.from(rel, "utf8");
    const raw = fs.readFileSync(path.join(baseDir, rel));
    const comp = zlib.deflateRawSync(raw);
    const crc = calcCrc32(raw);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    localParts.push(lh, nameBuf, comp);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    centralParts.push(ch, nameBuf);

    offset += lh.length + nameBuf.length + comp.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(relFiles.length, 8);
  eocd.writeUInt16LE(relFiles.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);

  fs.writeFileSync(outPath, Buffer.concat([...localParts, centralBuf, eocd]));
}

buildExtension().catch((err) => {
  console.error("[FAIL] Build failed:", err);
  process.exit(1);
});
