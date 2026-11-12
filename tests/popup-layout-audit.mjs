import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * 실제 빌드된 dist/unpacked/ 자산(popup.html + popup.css + popup-strips.css + popup-fx.css + popup.js)을
 * 헤드리스 Chrome에서 실행해 런타임 오류, 줄바꿈, 한글 상하 잘림, 테마 팝오버 넘침,
 * 스위치 뱅크 3버튼(M·S·F), 스트립 하단 빈틈(dead bottom gap), CORS 채널 FX 랙 높이 불변성을 전수 감사한다.
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

// dist/unpacked 자산을 임시 폴더로 복사 (빌드 전 static 최신본 폴백 지원)
for (const name of ["popup.html", "popup.css", "popup-strips.css", "popup-fx.css", "popup.js"]) {
  const unpackedPath = path.join(UNPACKED_DIR, name);
  const staticPath = path.join(ROOT, "static", name);
  if (fs.existsSync(unpackedPath)) {
    if (fs.existsSync(staticPath) && fs.statSync(staticPath).mtimeMs > fs.statSync(unpackedPath).mtimeMs) {
      fs.copyFileSync(staticPath, path.join(TMP_DIR, name));
    } else {
      fs.copyFileSync(unpackedPath, path.join(TMP_DIR, name));
    }
  } else if (fs.existsSync(staticPath)) {
    fs.copyFileSync(staticPath, path.join(TMP_DIR, name));
  }
}

const SAMPLE_CHANNELS = [
  {
    tabId: 1, windowId: 1, title: "침착맨 라이브", domain: "chzzk.naver.com", shortHost: "chzzk",
    favIconUrl: "", playing: true, audible: true, mediaCount: 1, db: 0.0,
    muted: false, solo: false, focus: true, corsCap: false, vuLevel: 0.66, vuPeak: 0.76, firstSeenAt: 1,
    sortOrder: 1, normTrimDb: 0.0,
    fx: {
      normMode: "follow", normTargetLufs: -16, normSpeed: "std", pan: 0,
      gateEnabled: true, gateThresholdDb: -48, compEnabled: false, compRatio: 4,
    },
  },
  {
    tabId: 2, windowId: 1, title: "Lo-Fi 작업 브금", domain: "youtube.com", shortHost: "youtube",
    favIconUrl: "", playing: true, audible: true, mediaCount: 1, db: -6.0,
    muted: false, solo: false, focus: false, corsCap: false, vuLevel: 0.42, vuPeak: 0.52, firstSeenAt: 2,
    sortOrder: 2, normTrimDb: 2.1,
    fx: {
      normMode: "on", normTargetLufs: -14, normSpeed: "fast", pan: -20,
      gateEnabled: false, gateThresholdDb: -48, compEnabled: true, compRatio: 2,
    },
  },
  {
    tabId: 3, windowId: 1, title: "개발 컨퍼런스", domain: "youtube.com", shortHost: "youtube",
    favIconUrl: "", playing: true, audible: true, mediaCount: 1, db: 4.5,
    muted: false, solo: false, focus: false, corsCap: false, vuLevel: 0.54, vuPeak: 0.64, firstSeenAt: 3,
    sortOrder: 3, normTrimDb: 0.0,
    fx: {
      normMode: "follow", normTargetLufs: -16, normSpeed: "std", pan: 15,
      gateEnabled: false, gateThresholdDb: -48, compEnabled: false, compRatio: 4,
    },
  },
  {
    tabId: 4, windowId: 2, title: "넷플릭스 영화", domain: "netflix.com", shortHost: "netflix",
    favIconUrl: "", playing: true, audible: true, mediaCount: 1, db: 0.0,
    muted: false, solo: false, focus: false, corsCap: true, vuLevel: 0.48, vuPeak: 0.58, firstSeenAt: 4,
    sortOrder: 4, normTrimDb: 0.0,
    fx: {
      normMode: "follow", normTargetLufs: -16, normSpeed: "std", pan: 0,
      gateEnabled: false, gateThresholdDb: -48, compEnabled: false, compRatio: 4,
    },
  },
  {
    tabId: 5, windowId: 2, title: "오후 플레이리스트", domain: "soundcloud.com", shortHost: "soundcloud",
    favIconUrl: "", playing: false, audible: false, mediaCount: 1, db: -3.0,
    muted: false, solo: false, focus: false, corsCap: false, vuLevel: 0, vuPeak: 0, firstSeenAt: 5,
    sortOrder: 5, normTrimDb: 0.0,
    fx: {
      normMode: "off", normTargetLufs: -18, normSpeed: "slow", pan: 0,
      gateEnabled: false, gateThresholdDb: -48, compEnabled: false, compRatio: 4,
    },
  },
];

function buildAuditHtml(scenarioName, snapshotObj, openPopover = false, testInlineEdit = false, selectTabId = null) {
  const baseHtml = fs.readFileSync(path.join(TMP_DIR, "popup.html"), "utf8");
  const injectedScript = `
  <script>
    window.__AUDIT_ERRORS__ = [];
    window.__SENT_ACTIONS__ = [];
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
            if (${JSON.stringify(selectTabId)} !== null) {
              const targetStrip = document.querySelector('.channel-strip[data-tab-id="' + ${JSON.stringify(selectTabId)} + '"]');
              if (targetStrip) {
                targetStrip.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
                targetStrip.querySelector('.strip-header')?.click();
              }
            }
            if (${JSON.stringify(testInlineEdit)}) {
              const strips = document.querySelectorAll(".channel-strip");
              const ch2Box = strips[1]?.querySelector('[data-ref="readoutBtn"]');
              const ch2Input = strips[1]?.querySelector('[data-ref="dbInput"]');
              const ch2DbText = strips[1]?.querySelector('[data-ref="dbText"]');

              // 1) 클릭 직후 0.0dB로 리셋되지 않고 편집 모드가 열리는지 검증
              ch2Box?.click();
              if (ch2Box?.dataset.editing !== "true") {
                window.__AUDIT_ERRORS__.push("INLINE_EDIT_NOT_OPENED");
              }
              if (window.__SENT_ACTIONS__.some((m) => m.type === "SET_TAB_DB" && m.db === 0)) {
                window.__AUDIT_ERRORS__.push("ACCIDENTAL_ZERO_RESET_ON_CLICK");
              }
              if (ch2Input?.value !== "-6.0") {
                window.__AUDIT_ERRORS__.push("UNEXPECTED_INIT_VAL:" + ch2Input?.value);
              }

              // 2) 숫자(-10.3) 입력 후 Enter 적용 검증 + 입력 중 '0' 키가 리셋 단축키로 새지 않는지 검증
              ch2Input.value = "-10.3";
              ch2Input.dispatchEvent(new KeyboardEvent("keydown", { key: "0", bubbles: true }));
              ch2Input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
              if (ch2DbText?.textContent !== "-10.3") {
                window.__AUDIT_ERRORS__.push("COMMIT_DB_MISMATCH:" + ch2DbText?.textContent);
              }

              // 3) 채널 3(+4.5dB) 편집기를 열어 둔 상태로 레이아웃·넘침 감사 수행
              strips[2]?.querySelector('[data-ref="readoutBtn"]')?.click();
            }
          }, 10);
          return {
            onMessage: { addListener: (fn) => listeners.push(fn) },
            onDisconnect: { addListener: () => {} },
            postMessage: (msg) => window.__SENT_ACTIONS__.push(msg),
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

        // 1) 모든 .switch-bank가 3개 버튼(M, S, F)을 온전히 갖추었는지 검증
        document.querySelectorAll(".switch-bank").forEach((bank, idx) => {
          const btns = bank.querySelectorAll("button");
          if (btns.length !== 3) {
            issues.push("SWITCH_BANK_COUNT_MISMATCH #" + idx + ": " + btns.length + " !== 3");
          }
          const text = Array.from(btns).map((b) => b.textContent.trim()).join(" ");
          if (!text.includes("M") || !text.includes("S") || !text.includes("F")) {
            issues.push("SWITCH_BANK_LABELS_MISMATCH #" + idx + ": " + text);
          }
        });

        // 2) .channel-strip 및 .master-strip 하단에 빈 공간(dead bottom gap)이 없는지 검증 (<= 10px)
        document.querySelectorAll(".channel-strip").forEach((strip) => {
          const stripRect = strip.getBoundingClientRect();
          const lastChild = strip.lastElementChild;
          if (lastChild) {
            const lastRect = lastChild.getBoundingClientRect();
            const gap = stripRect.bottom - lastRect.bottom;
            if (gap > 10) {
              issues.push("DEAD_BOTTOM_GAP [channel-strip " + (strip.dataset.tabId || "") + "]: " + gap.toFixed(1) + "px > 10px");
            }
          }
        });
        document.querySelectorAll(".master-strip").forEach((strip) => {
          const stripRect = strip.getBoundingClientRect();
          const lastChild = strip.lastElementChild;
          if (lastChild) {
            const lastRect = lastChild.getBoundingClientRect();
            const gap = stripRect.bottom - lastRect.bottom;
            if (gap > 10) {
              issues.push("DEAD_BOTTOM_GAP [master-strip]: " + gap.toFixed(1) + "px > 10px");
            }
          }
        });

        // 3) 고급 FX 사이드 랙 높이 및 CORS 채널 전환 시 레이아웃 높이 점프 불변성 검증
        const advRack = document.getElementById("side-fx-rack");
        const advRackHeight = advRack && !advRack.classList.contains("hidden")
          ? Math.round(advRack.getBoundingClientRect().height)
          : 0;

        if (${JSON.stringify(scenarioName)} === "adv_rack_cors" && advRack && !advRack.classList.contains("hidden")) {
          const ch2 = document.querySelector('.channel-strip[data-tab-id="2"]');
          const ch4 = document.querySelector('.channel-strip[data-tab-id="4"]');
          if (ch2 && ch4) {
            ch2.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
            const h2 = Math.round(advRack.getBoundingClientRect().height);
            ch4.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
            const h4 = Math.round(advRack.getBoundingClientRect().height);
            if (Math.abs(h2 - h4) > 1) {
              issues.push("ADV_RACK_HEIGHT_JUMP_IN_PAGE: ch2=" + h2 + "px, ch4=" + h4 + "px, diff=" + Math.abs(h2 - h4) + "px > 1px");
            }
          }
        }

        document.querySelectorAll("button, .alpha-readout, .status-text, .readout-sub, .strip-title, .pop-theme-btn, .fx-card-title").forEach((el) => {
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
        pre.textContent = JSON.stringify({
          scenario: ${JSON.stringify(scenarioName)},
          width: Math.round(rr.width),
          height: Math.round(rr.height),
          advRackHeight,
          issues,
        });
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
    snap: {
      settings: {
        theme: "teal", modePref: "dark", alpha: 0.7, masterDb: 0, masterMuted: false,
        autoNormEnabled: false, advRackOpen: false, domainDefaults: {},
      },
      channels: [],
    },
  },
  {
    name: "active_680",
    w: 680, h: 420, openPop: false,
    snap: {
      settings: {
        theme: "teal", modePref: "dark", alpha: 0.7, masterDb: 0, masterMuted: false,
        autoNormEnabled: false, advRackOpen: false, domainDefaults: { "chzzk.naver.com": 0, "youtube.com": -6 },
      },
      channels: SAMPLE_CHANNELS,
    },
  },
  {
    name: "narrow_520",
    w: 520, h: 440, openPop: false,
    snap: {
      settings: {
        theme: "teal", modePref: "dark", alpha: 0.7, masterDb: 0, masterMuted: false,
        autoNormEnabled: false, advRackOpen: false, domainDefaults: { "chzzk.naver.com": 0 },
      },
      channels: SAMPLE_CHANNELS,
    },
  },
  {
    name: "popover_dark",
    w: 680, h: 420, openPop: true,
    snap: {
      settings: {
        theme: "cobalt", modePref: "dark", alpha: 0.7, masterDb: 0, masterMuted: false,
        autoNormEnabled: false, advRackOpen: false, domainDefaults: {},
      },
      channels: SAMPLE_CHANNELS,
    },
  },
  {
    name: "popover_light",
    w: 680, h: 420, openPop: true, inlineEdit: false,
    snap: {
      settings: {
        theme: "emerald", modePref: "light", alpha: 0.7, masterDb: 0, masterMuted: false,
        autoNormEnabled: false, advRackOpen: false, domainDefaults: {},
      },
      channels: SAMPLE_CHANNELS,
    },
  },
  {
    name: "inline_edit_open",
    w: 680, h: 420, openPop: false, inlineEdit: true,
    snap: {
      settings: {
        theme: "teal", modePref: "dark", alpha: 0.7, masterDb: 0, masterMuted: false,
        autoNormEnabled: false, advRackOpen: false, domainDefaults: { "chzzk.naver.com": 0, "youtube.com": -6 },
      },
      channels: SAMPLE_CHANNELS,
    },
  },
  {
    name: "adv_rack_normal",
    w: 800, h: 520, openPop: false, inlineEdit: false, selectTabId: 2,
    snap: {
      settings: {
        theme: "teal", modePref: "dark", alpha: 0.7, masterDb: 0, masterMuted: false,
        autoNormEnabled: true, advRackOpen: true, domainDefaults: { "youtube.com": -6 },
      },
      channels: SAMPLE_CHANNELS,
    },
  },
  {
    name: "adv_rack_cors",
    w: 800, h: 520, openPop: false, inlineEdit: false, selectTabId: 4,
    snap: {
      settings: {
        theme: "teal", modePref: "dark", alpha: 0.7, masterDb: 0, masterMuted: false,
        autoNormEnabled: true, advRackOpen: true, domainDefaults: {},
      },
      channels: SAMPLE_CHANNELS,
    },
  },
];

let failed = false;
try {
  const results = await Promise.all(
    scenarios.map(async (sc) => {
      const scProfile = path.join(TMP_DIR, `profile_${sc.name}`);
      fs.mkdirSync(scProfile, { recursive: true });
      const htmlFile = path.join(TMP_DIR, `audit_${sc.name}.html`);
      fs.writeFileSync(
        htmlFile,
        buildAuditHtml(sc.name, sc.snap, sc.openPop, Boolean(sc.inlineEdit), sc.selectTabId ?? null),
        "utf8",
      );
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

  let advNormalHeight = null;
  let advCorsHeight = null;

  for (const { sc, stdout } of results) {
    const match = stdout.match(/<pre id="ui-audit-json">([\s\S]*?)<\/pre>/);
    if (!match) {
      console.error(`[FAIL] ${sc.name}: DOM 감사 결과를 추출하지 못했습니다.`);
      failed = true;
      continue;
    }
    const result = JSON.parse(match[1]);
    if (sc.name === "adv_rack_normal") {
      advNormalHeight = result.advRackHeight;
    }
    if (sc.name === "adv_rack_cors") {
      advCorsHeight = result.advRackHeight;
    }
    if (result.issues.length > 0) {
      console.error(`[FAIL] ${sc.name}:`, result.issues);
      failed = true;
    } else {
      console.log(`[PASS] UI Audit (${sc.name}): ${result.width}x${result.height}px, 0 issues`);
    }
  }

  // 4) CORS 채널 클릭 시 사이드 랙 레이아웃 높이 점프 불변성 검증 (|normal - cors| <= 1px)
  if (advNormalHeight !== null && advCorsHeight !== null) {
    const heightDiff = Math.abs(advNormalHeight - advCorsHeight);
    if (heightDiff > 1) {
      console.error(
        `[FAIL] ADV RACK HEIGHT MISMATCH: normal=${advNormalHeight}px, cors=${advCorsHeight}px (diff=${heightDiff}px > 1px)`,
      );
      failed = true;
    } else {
      console.log(
        `[PASS] Adv Rack Height Stability: normal=${advNormalHeight}px, cors=${advCorsHeight}px (diff=${heightDiff}px <= 1px)`,
      );
    }
  }
} finally {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
}

if (failed) process.exit(1);
