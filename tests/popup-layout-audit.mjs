import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * 실제 빌드된 dist/unpacked/popup.html + popup.css + popup.js 번들을
 * 헤드리스 Chrome에서 실행해 런타임 오류, 줄바꿈, 한글 상하 잘림, 테마 팝오버 넘침을 전수 검사한다.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const UNPACKED_DIR = path.join(ROOT, "dist", "unpacked");
const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const CHROME_BIN = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!CHROME_BIN) {
  console.log("[SKIP] 로컬 Chrome 실행 파일을 찾지 못해 UI 헤드리스 감사를 건너뜁니다.");
  process.exit(0);
}

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "sound-manager-ui-audit-"));
const PROFILE_DIR = path.join(TMP_DIR, "profile");
fs.mkdirSync(PROFILE_DIR, { recursive: true });

// dist/unpacked 자산을 임시 폴더로 복사해 모의 chrome.runtime 포트 스크립트만 앞에 주입
for (const name of ["popup.html", "popup.css", "popup-strips.css", "popup.js"]) {
  fs.copyFileSync(path.join(UNPACKED_DIR, name), path.join(TMP_DIR, name));
}

const SAMPLE_CHANNELS = [
  {
    tabId: 1, windowId: 1, title: "침착맨 라이브", domain: "chzzk.naver.com", shortHost: "chzzk",
    favIconUrl: "", playing: true, audible: true, mediaCount: 1, db: 0.0,
    muted: false, solo: false, focus: true, corsCap: false, vuLevel: 0.66, vuPeak: 0.76, firstSeenAt: 1,
  },
  {
    tabId: 2, windowId: 1, title: "Lo-Fi 작업 브금", domain: "youtube.com", shortHost: "youtube",
    favIconUrl: "", playing: true, audible: true, mediaCount: 1, db: -6.0,
    muted: false, solo: false, focus: false, corsCap: false, vuLevel: 0.42, vuPeak: 0.52, firstSeenAt: 2,
  },
  {
    tabId: 3, windowId: 1, title: "개발 컨퍼런스", domain: "youtube.com", shortHost: "youtube",
    favIconUrl: "", playing: true, audible: true, mediaCount: 1, db: 4.5,
    muted: false, solo: false, focus: false, corsCap: false, vuLevel: 0.54, vuPeak: 0.64, firstSeenAt: 3,
  },
  {
    tabId: 4, windowId: 2, title: "넷플릭스 영화", domain: "netflix.com", shortHost: "netflix",
    favIconUrl: "", playing: true, audible: true, mediaCount: 1, db: 0.0,
    muted: false, solo: false, focus: false, corsCap: true, vuLevel: 0.48, vuPeak: 0.58, firstSeenAt: 4,
  },
  {
    tabId: 5, windowId: 2, title: "오후 플레이리스트", domain: "soundcloud.com", shortHost: "soundcloud",
    favIconUrl: "", playing: false, audible: false, mediaCount: 1, db: -3.0,
    muted: false, solo: false, focus: false, corsCap: false, vuLevel: 0, vuPeak: 0, firstSeenAt: 5,
  },
];

function buildAuditHtml(scenarioName, snapshotObj, openPopover = false) {
  const baseHtml = fs.readFileSync(path.join(UNPACKED_DIR, "popup.html"), "utf8");
  const injectedScript = `
  <script>
    window.__AUDIT_ERRORS__ = [];
    window.addEventListener("error", (e) => window.__AUDIT_ERRORS__.push(String(e.message || e)));
    window.chrome = {
      runtime: {
        connect() {
          const listeners = [];
          setTimeout(() => {
            listeners.forEach((fn) => fn({ type: "SNAPSHOT", snapshot: ${JSON.stringify(snapshotObj)} }));
            if (${JSON.stringify(openPopover)}) {
              document.getElementById("theme-dot-btn")?.click();
            }
          }, 10);
          return {
            onMessage: { addListener: (fn) => listeners.push(fn) },
            onDisconnect: { addListener: () => {} },
            postMessage: () => {},
          };
        },
        sendMessage: async () => ({}),
      },
    };
    window.addEventListener("load", () => {
      setTimeout(() => {
        const issues = [...window.__AUDIT_ERRORS__.map((e) => "JS_ERR: " + e)];
        const root = document.getElementById("console-root");
        const rr = root.getBoundingClientRect();
        const masterCount = document.querySelectorAll(".master-strip").length;
        const channelCount = document.querySelectorAll(".channel-strip").length;
        const expectedChannels = ${snapshotObj.channels.length};
        if (masterCount !== 1) {
          issues.push("MISSING_MASTER_STRIP: count=" + masterCount);
        }
        if (channelCount !== expectedChannels) {
          issues.push("CHANNEL_COUNT_MISMATCH: " + channelCount + " !== " + expectedChannels);
        }
        if (${JSON.stringify(openPopover)}) {
          const pop = document.getElementById("theme-popover");
          if (!pop || pop.classList.contains("hidden")) {
            issues.push("POPOVER_NOT_OPEN");
          }
        }
        if (document.documentElement.scrollWidth > window.innerWidth + 1) {
          issues.push("OUTER_OVERFLOW: " + document.documentElement.scrollWidth + " > " + window.innerWidth);
        }
        document.querySelectorAll("button, .alpha-readout, .status-text, .readout-sub, .strip-title, .pop-theme-btn").forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return;
          const cls = el.className || "";
          const isTruncate = cls.includes("truncate");
          if (!isTruncate && el.scrollWidth > el.clientWidth + 1) {
            issues.push("CLIP_X [" + el.textContent.trim().slice(0, 20) + "]: " + el.scrollWidth + " > " + el.clientWidth);
          }
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let n;
          while ((n = walker.nextNode())) {
            if (!n.nodeValue.trim()) continue;
            const pCls = (n.parentElement && n.parentElement.className) || "";
            const nodeTrunc = isTruncate || pCls.includes("truncate");
            const range = document.createRange();
            range.selectNodeContents(n);
            const rects = range.getClientRects();
            if (!nodeTrunc && rects.length > 1) {
              issues.push("WRAP [" + n.nodeValue.trim() + "]: rects=" + rects.length);
            }
            const r0 = rects[0];
            if (r0 && (r0.top < rect.top - 0.6 || r0.bottom > rect.bottom + 0.6)) {
              issues.push("BLEED_Y [" + n.nodeValue.trim() + "]");
            }
          }
        });
        document.querySelectorAll(".fader-well").forEach((well, idx) => {
          const wr = well.getBoundingClientRect();
          const knob = well.querySelector('[data-ref="knob"]');
          if (knob) {
            const kr = knob.getBoundingClientRect();
            if (kr.top < wr.top + 1 || kr.bottom > wr.bottom - 1) {
              issues.push("KNOB_OUT_OF_WELL #" + idx);
            }
          }
        });
        const pre = document.createElement("pre");
        pre.id = "ui-audit-json";
        pre.textContent = JSON.stringify({ scenario: ${JSON.stringify(scenarioName)}, width: Math.round(rr.width), height: Math.round(rr.height), issues });
        document.body.appendChild(pre);
      }, 150);
    });
  </script>`;
  return baseHtml.replace("</head>", `${injectedScript}\n</head>`);
}

const scenarios = [
  {
    name: "empty_default",
    w: 560, h: 420, openPop: false,
    snap: { settings: { theme: "teal", modePref: "dark", alpha: 0.7, masterDb: 0, masterMuted: false, domainDefaults: {} }, channels: [] },
  },
  {
    name: "active_680",
    w: 680, h: 420, openPop: false,
    snap: { settings: { theme: "teal", modePref: "dark", alpha: 0.7, masterDb: 0, masterMuted: false, domainDefaults: { "chzzk.naver.com": 0, "youtube.com": -6 } }, channels: SAMPLE_CHANNELS },
  },
  {
    name: "narrow_520",
    w: 520, h: 440, openPop: false,
    snap: { settings: { theme: "teal", modePref: "dark", alpha: 0.7, masterDb: 0, masterMuted: false, domainDefaults: { "chzzk.naver.com": 0 } }, channels: SAMPLE_CHANNELS },
  },
  {
    name: "popover_dark",
    w: 680, h: 420, openPop: true,
    snap: { settings: { theme: "cobalt", modePref: "dark", alpha: 0.7, masterDb: 0, masterMuted: false, domainDefaults: {} }, channels: SAMPLE_CHANNELS },
  },
  {
    name: "popover_light",
    w: 680, h: 420, openPop: true,
    snap: { settings: { theme: "emerald", modePref: "light", alpha: 0.7, masterDb: 0, masterMuted: false, domainDefaults: {} }, channels: SAMPLE_CHANNELS },
  },
];

let failed = false;
try {
  const results = await Promise.all(
    scenarios.map(async (sc) => {
      const scProfile = path.join(TMP_DIR, `profile_${sc.name}`);
      fs.mkdirSync(scProfile, { recursive: true });
      const htmlFile = path.join(TMP_DIR, `audit_${sc.name}.html`);
      fs.writeFileSync(htmlFile, buildAuditHtml(sc.name, sc.snap, sc.openPop), "utf8");
      const fileUrl = "file:///" + htmlFile.replace(/\\/g, "/");
      const { stdout } = await execFileAsync(
        CHROME_BIN,
        [
          "--headless=new",
          "--no-sandbox",
          "--disable-gpu",
          `--user-data-dir=${scProfile}`,
          `--window-size=${sc.w},${sc.h}`,
          "--virtual-time-budget=350",
          "--dump-dom",
          fileUrl,
        ],
        { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
      );
      return { sc, stdout };
    }),
  );

  for (const { sc, stdout } of results) {
    const match = stdout.match(/<pre id="ui-audit-json">([\s\S]*?)<\/pre>/);
    if (!match) {
      console.error(`[FAIL] ${sc.name}: DOM 감사 결과를 추출하지 못했습니다.`);
      failed = true;
      continue;
    }
    const result = JSON.parse(match[1]);
    if (result.issues.length > 0) {
      console.error(`[FAIL] ${sc.name}:`, result.issues);
      failed = true;
    } else {
      console.log(`[PASS] UI Audit (${sc.name}): ${result.width}x${result.height}px, 0 issues`);
    }
  }
} finally {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
}

if (failed) process.exit(1);
