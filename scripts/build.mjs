import * as esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 화이트리스트 기반 Chrome MV3 확장 빌드·패키징 파이프라인 (app-build-architect 준수).
 * 개발 루트(docs/, tests/, .claude/, scripts/)와 분리된 dist/unpacked/ 및 dist/*.zip만 생성한다.
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

async function buildExtension() {
  const manifestRaw = fs.readFileSync(path.join(STATIC_DIR, "manifest.json"), "utf8");
  const manifest = JSON.parse(manifestRaw);
  assertManifestPolicy(manifest);

  fs.rmSync(UNPACKED_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(UNPACKED_DIR, "icons"), { recursive: true });

  // 1. 화이트리스트 정적 런타임 자산만 복사
  const staticWhitelist = [
    ["manifest.json", "manifest.json"],
    ["popup.html", "popup.html"],
    ["popup.css", "popup.css"],
    ["popup-strips.css", "popup-strips.css"],
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
  });

  // 4. 스토어/배포용 ZIP 아카이브 생성
  const zipName = `sound-manager-${manifest.version}.zip`;
  const zipPath = path.join(DIST_DIR, zipName);
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  const pyZipScript = `
import pathlib, zipfile, sys
unpacked = pathlib.Path(sys.argv[1])
zip_out = pathlib.Path(sys.argv[2])
with zipfile.ZipFile(zip_out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for p in sorted(unpacked.rglob("*")):
        if p.is_file():
            zf.write(p, p.relative_to(unpacked).as_posix())
`;
  execFileSync("python", ["-X", "utf8", "-c", pyZipScript, UNPACKED_DIR, zipPath], {
    stdio: "inherit",
  });

  const builtFiles = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else builtFiles.push(path.relative(UNPACKED_DIR, full).replace(/\\/g, "/"));
    }
  }
  walk(UNPACKED_DIR);

  console.log(`[PASS] Built Sound Manager v${manifest.version} (${builtFiles.length} runtime files):`);
  console.log(`  - Unpacked: ${UNPACKED_DIR}`);
  console.log(`  - Archive : ${zipPath}`);
}

buildExtension().catch((err) => {
  console.error("[FAIL] Build failed:", err);
  process.exit(1);
});
