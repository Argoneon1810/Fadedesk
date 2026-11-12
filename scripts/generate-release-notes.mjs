import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * GitHub Release 본문(한·영 수동 설치 안내 + CHANGELOG 발췌 + SHA-256 체크섬) 생성기.
 * RELEASE_TAG 환경변수가 주어지면(예: v1.0.0) static/manifest.json의 version과 일치하는지 검증한다.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, "static", "manifest.json"), "utf8"),
);
const version = manifest.version;
const expectedTag = `v${version}`;
const actualTag = process.env.RELEASE_TAG || expectedTag;

if (actualTag !== expectedTag) {
  console.error(
    `[FAIL] 태그(${actualTag})와 static/manifest.json 버전(${expectedTag})이 일치하지 않습니다.`,
  );
  process.exit(1);
}

const zipName = `fadedesk-${version}.zip`;
const zipRelPath = `dist/${zipName}`;
const zipFullPath = path.join(ROOT, "dist", zipName);

if (!fs.existsSync(zipFullPath)) {
  console.error(`[FAIL] 빌드 산출물을 찾을 수 없습니다: ${zipFullPath}`);
  process.exit(1);
}

const zipBuffer = fs.readFileSync(zipFullPath);
const sha256 = crypto.createHash("sha256").update(zipBuffer).digest("hex");

function extractChangelogForVersion(ver) {
  const changelogPath = path.join(ROOT, "CHANGELOG.md");
  if (!fs.existsSync(changelogPath)) return "";
  const lines = fs.readFileSync(changelogPath, "utf8").split(/\r?\n/);
  const matchedBlocks = [];
  let collecting = false;
  let current = [];

  const headerRe = /^##\s+(\d+\.\d+\.\d+)\b/;
  for (const line of lines) {
    const m = line.match(headerRe);
    if (m) {
      if (collecting && current.length > 0) {
        matchedBlocks.push(current.join("\n").trim());
      }
      if (m[1] === ver) {
        collecting = true;
        current = [`### ${line.replace(/^##\s+/, "")}`];
      } else {
        collecting = false;
        current = [];
      }
    } else if (collecting) {
      current.push(line);
    }
  }
  if (collecting && current.length > 0) {
    matchedBlocks.push(current.join("\n").trim());
  }
  return matchedBlocks.join("\n\n");
}

const changelogExcerpt = extractChangelogForVersion(version);

const firstReleaseSummary =
  version === "1.0.0"
    ? [
        "",
        "### 주요 포함 기능 (1.0.0 첫 정식 판)",
        "- **탭별 로그 스케일 `dB` 페이더 (`-60 dB` ~ `+12 dB`)**: 노브 직접 드래그, 숫자 클릭 직접 입력, 더블클릭 `0.0 dB` 복귀",
        "- **집중 청취 (`Mute` · `Solo` · `Focus α`)**: 선택한 탭 단독 청취(`0.3초` 소프트 복귀) 및 배경 탭 감쇠(`Focus`)",
        "- **방송 표준 기반 2계층 라우드니스 노멀라이저**: ITU-R BS.1770-4 게이팅 기반 `음악(9s)` · `표준(3s)` · `야간(0.4s)` 프리셋",
        "- **채널별 고급 FX 사이드 랙**: 목표 음압(`LUFS`), 스테레오 패닝(`Pan`), 노이즈 게이트, 다이내믹 컴프레서",
        "- **편의 기능**: 재생↔대기 드래그 정렬, 탭 바로 이동(`↗`), 도메인 기본 볼륨 핀(`📌`), 독립 콘솔 창 분리, 4종 테마, 7단계 투어, 한국어·영어 자동 전환",
      ].join("\n")
    : "";

const notes = [
  `## 바로 설치하기 (ZIP 수동 설치 · 빌드 도구 불필요)`,
  ``,
  `크롬 웹 스토어 심사를 기다리는 동안이나 오프라인 환경에서 소스 빌드 없이 바로 설치해 쓸 수 있는 공식 패키지입니다.`,
  ``,
  `1. 아래 **Assets**에서 **\`${zipName}\`** 파일을 내려받아 지우지 않을 폴더(예: \`Documents\\Fadedesk\`)에 **압축을 풉니다**.`,
  `2. Chrome 주소창에 \`chrome://extensions\`를 입력해 이동한 뒤 우측 상단 **개발자 모드(Developer mode)** 를 켭니다.`,
  `3. 좌측 상단 **압축해제된 확장 프로그램을 로드합니다(Load unpacked)** 를 누르고, 방금 압축을 푼 폴더(\`manifest.json\`이 들어 있는 폴더)를 선택합니다.`,
  ``,
  `---`,
  ``,
  `## Quick Manual Install (Unpacked ZIP · No Node.js Needed)`,
  ``,
  `1. Download **\`${zipName}\`** from **Assets** below and extract it into a permanent folder.`,
  `2. Open \`chrome://extensions\` in Chrome and toggle **Developer mode** on (top-right corner).`,
  `3. Click **Load unpacked** (top-left) and select the extracted folder containing \`manifest.json\`.`,
  ``,
  `---`,
  ``,
  `## 바뀐 내역 (Changelog)`,
  ``,
  changelogExcerpt || `- [CHANGELOG.md](./CHANGELOG.md) 참고`,
  firstReleaseSummary,
  ``,
  `---`,
  ``,
  `### 파일 무결성 (SHA-256)`,
  ``,
  `- \`${zipName}\`: \`${sha256}\``,
]
  .filter((v) => v !== "")
  .join("\n")
  .replace(/\n{3,}/g, "\n\n") + "\n";

const notesRelPath = `dist/release-notes-${version}.md`;
const notesFullPath = path.join(ROOT, "dist", `release-notes-${version}.md`);
fs.writeFileSync(notesFullPath, notes, "utf8");

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `version=${version}\nzip_path=${zipRelPath}\nnotes_path=${notesRelPath}\n`,
    "utf8",
  );
}

console.log(`[PASS] Generated release notes for ${actualTag}: ${notesRelPath}`);
console.log(`       Archive: ${zipRelPath} (SHA-256: ${sha256})`);
