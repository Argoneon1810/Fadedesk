import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * 실제 빌드된 dist/unpacked/ 자산(popup.html + popup.css + popup-strips.css + popup-fx.css + popup-help.css + popup.js)을
 * 헤드리스 Chrome에서 실행해 런타임 오류, 줄바꿈, 한글 상하 잘림, 테마 팝오버 넘침,
 * 스위치 뱅크 3버튼(M·S·F), 스트립 하단 빈틈, CORS 채널 FX 랙 높이 불변성, 튜토리얼 도움말 모달 & 중첩 시각 카드,
 * 그리고 0.5.1 팝업 폭 잠금(768px/788px · #status-pill 124px), 비선택 채널 원클릭 조작, 블럭형 드롭 슬롯 & 비동기 SNAPSHOT 방어를 전수 감사한다.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const UNPACKED_DIR = path.join(ROOT, "dist", "unpacked");
const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe") : "",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

const CHROME_BIN = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!CHROME_BIN) {
  console.log("[SKIP] 로컬 Chrome 실행 파일을 찾지 못해 UI 헤드리스 감사를 건너뜁니다.");
  process.exit(0);
}

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "sound-manager-ui-audit-"));
const PROFILE_DIR = path.join(TMP_DIR, "profile");
fs.mkdirSync(PROFILE_DIR, { recursive: true });

for (const name of ["popup.html", "popup.css", "popup-strips.css", "popup-fx.css", "popup-fx-scope.css", "popup-help.css", "popup.js"]) {
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
    fx: { own: { gate: { enabled: true, thresholdDb: -48 } }, pan: 0 },
  },
  {
    tabId: 2, windowId: 1, title: "Lo-Fi 작업 브금", domain: "youtube.com", shortHost: "youtube",
    favIconUrl: "", playing: true, audible: true, mediaCount: 1, db: -6.0,
    muted: false, solo: false, focus: false, corsCap: false, vuLevel: 0.42, vuPeak: 0.52, firstSeenAt: 2,
    sortOrder: 2, normTrimDb: 2.1,
    fx: { own: { norm: { enabled: true, presetId: "", modified: false, targetLufs: -14, speed: "fast", rangeLowLufs: -32, rangeHighLufs: -10, zeroReturnRate: 0.35, minDwellBlocks: 2, maxBoostDb: 9 }, comp: { enabled: true, ratio: 2 } }, pan: -20 },
  },
  {
    tabId: 3, windowId: 1, title: "개발 컨퍼런스", domain: "youtube.com", shortHost: "youtube",
    favIconUrl: "", playing: true, audible: true, mediaCount: 1, db: 4.5,
    muted: false, solo: false, focus: false, corsCap: false, vuLevel: 0.54, vuPeak: 0.64, firstSeenAt: 3,
    sortOrder: 3, normTrimDb: 0.0,
    fx: { own: {}, pan: 15 },
  },
  {
    tabId: 4, windowId: 2, title: "넷플릭스 영화", domain: "netflix.com", shortHost: "netflix",
    favIconUrl: "", playing: true, audible: true, mediaCount: 1, db: 0.0,
    muted: false, solo: false, focus: false, corsCap: true, vuLevel: 0.48, vuPeak: 0.58, firstSeenAt: 4,
    sortOrder: 4, normTrimDb: 0.0,
    fx: { own: {}, pan: 0 },
  },
  {
    tabId: 5, windowId: 2, title: "오후 플레이리스트", domain: "soundcloud.com", shortHost: "soundcloud",
    favIconUrl: "", playing: false, audible: false, mediaCount: 1, db: -3.0,
    muted: false, solo: false, focus: false, corsCap: false, vuLevel: 0, vuPeak: 0, firstSeenAt: 5,
    sortOrder: 5, normTrimDb: 0.0,
    fx: { own: { norm: { enabled: false, presetId: "", modified: false, targetLufs: -18, speed: "slow", rangeLowLufs: -32, rangeHighLufs: -10, zeroReturnRate: 0.35, minDwellBlocks: 16, maxBoostDb: 6 } }, pan: 0 },
  },
];

function buildAuditHtml(sc) {
  const baseHtml = fs.readFileSync(path.join(TMP_DIR, "popup.html"), "utf8");
  const injectedScript = `
  <script>
    window.__AUDIT_ERRORS__ = [];
    window.__SENT_ACTIONS__ = [];
    window.__PORT_LISTENERS__ = [];
    window.addEventListener("error", (e) => window.__AUDIT_ERRORS__.push(String(e.message || e)));
    window.chrome = {
      runtime: {
        connect() {
          const listeners = window.__PORT_LISTENERS__;
          setTimeout(() => {
            listeners.forEach((fn) => fn({ type: "SNAPSHOT", snapshot: ${JSON.stringify(sc.snap)} }));
            if (${JSON.stringify(Boolean(sc.openPop))}) {
              document.getElementById("theme-dot-btn")?.click();
            }
            if (${JSON.stringify(sc.selectTabId ?? null)} !== null) {
              const targetStrip = document.querySelector('.channel-strip[data-tab-id="' + ${JSON.stringify(sc.selectTabId ?? null)} + '"]');
              if (targetStrip) {
                targetStrip.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
                targetStrip.querySelector('.strip-header')?.click();
              }
            }
            if (${JSON.stringify(Boolean(sc.inlineEdit))}) {
              const strips = document.querySelectorAll(".channel-strip");
              const ch2Box = strips[1]?.querySelector('[data-ref="readoutBtn"]');
              const ch2Input = strips[1]?.querySelector('[data-ref="dbInput"]');
              const ch2DbText = strips[1]?.querySelector('[data-ref="dbText"]');

              ch2Box?.click();
              if (ch2Box?.dataset.editing !== "true") window.__AUDIT_ERRORS__.push("INLINE_EDIT_NOT_OPENED");
              if (window.__SENT_ACTIONS__.some((m) => m.type === "SET_TAB_DB" && m.db === 0)) window.__AUDIT_ERRORS__.push("ACCIDENTAL_ZERO_RESET_ON_CLICK");
              if (ch2Input?.value !== "-6.0") window.__AUDIT_ERRORS__.push("UNEXPECTED_INIT_VAL:" + ch2Input?.value);

              ch2Input.value = "-10.3";
              ch2Input.dispatchEvent(new KeyboardEvent("keydown", { key: "0", bubbles: true }));
              ch2Input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
              if (ch2DbText?.textContent !== "-10.3") window.__AUDIT_ERRORS__.push("COMMIT_DB_MISMATCH:" + ch2DbText?.textContent);

              const alphaBtn = document.getElementById("alpha-readout-btn");
              const alphaInput = document.getElementById("alpha-input");
              alphaBtn?.click();
              if (alphaBtn?.dataset.editing !== "true") window.__AUDIT_ERRORS__.push("ALPHA_INLINE_NOT_OPENED");
              alphaInput.value = "-15.5";
              alphaInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
              if (document.getElementById("alpha-readout")?.textContent !== "0.61 · -15.5dB") {
                window.__AUDIT_ERRORS__.push("ALPHA_COMMIT_MISMATCH:" + document.getElementById("alpha-readout")?.textContent);
              }
              strips[2]?.querySelector('[data-ref="readoutBtn"]')?.click();
            }
          }, 10);
          return {
            onMessage: { addListener: (fn) => listeners.push(fn) },
            onDisconnect: { addListener: () => {} },
            postMessage: (msg) => window.__SENT_ACTIONS__.push(msg),
          };
        },
        sendMessage: async (msg) => {
          window.__SENT_ACTIONS__.push(msg);
          return {};
        },
      },
    };
    window.addEventListener("load", () => {
      setTimeout(() => {
        const issues = [...window.__AUDIT_ERRORS__.map((e) => "JS_ERR: " + e)];
        const root = document.getElementById("console-root");
        const rr = root.getBoundingClientRect();
        const isWin = ${JSON.stringify(Boolean(sc.isWindow))};
        const popoutBtn = document.getElementById("popout-btn");

        if (isWin) {
          if (document.documentElement.dataset.view !== "window") issues.push("WINDOW_VIEW_ATTR_MISSING");
          if (!popoutBtn || !popoutBtn.classList.contains("hidden")) issues.push("POPOUT_BTN_NOT_HIDDEN_IN_WINDOW");
        } else {
          if (document.documentElement.dataset.view !== "popup") issues.push("POPUP_VIEW_ATTR_MISSING");
          if (!popoutBtn || popoutBtn.classList.contains("hidden")) issues.push("POPOUT_BTN_HIDDEN_IN_POPUP");
          const expectedW = ${JSON.stringify(Boolean(sc.snap.settings.advRackOpen))} ? 788 : 768;
          if (Math.round(rr.width) !== expectedW) {
            issues.push("POPUP_FIXED_WIDTH_MISMATCH: " + Math.round(rr.width) + " !== " + expectedW);
          }
        }

        const pill = document.getElementById("status-pill");
        const initPillW = pill ? Math.round(pill.getBoundingClientRect().width) : 0;
        if (initPillW !== 124) {
          issues.push("STATUS_PILL_FIXED_WIDTH_MISMATCH: " + initPillW + " !== 124");
        }

        const masterCount = document.querySelectorAll(".master-strip").length;
        if (masterCount !== 1) issues.push("MISSING_MASTER_STRIP: count=" + masterCount);
        const masterRightVuCols = document.querySelectorAll(".master-strip .stereo-vu-pair .vu-col").length;
        if (masterRightVuCols !== 2) {
          issues.push("MASTER_STRIP_STEREO_VU_PAIR_MISMATCH: " + masterRightVuCols + " !== 2");
        }

        // 0.7.0 첫 실행 온보딩 자동 표시 & 빈 화면 예시 채널 7단계 실화면 스포트라이트 투어 검증
        if (${JSON.stringify(Boolean(sc.testOnboardingTour))}) {
          const backdrop = document.getElementById("help-backdrop");
          const tourTab = document.querySelector('[data-help-tab="tour"]');
          if (!backdrop || backdrop.classList.contains("hidden")) issues.push("ONBOARDING_HELP_NOT_AUTO_OPENED");
          if (tourTab?.getAttribute("data-active") !== "true") issues.push("ONBOARDING_NOT_ON_TOUR_TAB");
          document.querySelector("[data-tour-start]")?.click();
          if (!window.__SENT_ACTIONS__.some((m) => m.type === "COMPLETE_ONBOARDING")) {
            issues.push("COMPLETE_ONBOARDING_NOT_SENT");
          }
          if (backdrop && !backdrop.classList.contains("hidden")) issues.push("HELP_NOT_CLOSED_ON_TOUR_START");
          const overlay = document.getElementById("tour-overlay");
          if (!overlay || overlay.classList.contains("hidden")) issues.push("TOUR_OVERLAY_NOT_OPENED");
          if (!document.querySelector('.channel-strip[data-tab-id="-901"]') || !document.querySelector('.channel-strip[data-tab-id="-902"]')) {
            issues.push("DEMO_TOUR_CHANNELS_MISSING");
          }
          const card = overlay?.querySelector('[data-ref="card"]');
          const nextBtn = overlay?.querySelector("[data-tour-next]");
          const TOUR_STEPS = 8;
          const computeOverlap = (a, b) =>
            Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
            Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          const rackWasOpen = !document.getElementById("side-fx-rack")?.classList.contains("hidden");
          for (let step = 0; step < TOUR_STEPS; step++) {
            const holes = overlay?.querySelectorAll(".tour-spotlight-hole") ?? [];
            const hr = holes[0]?.getBoundingClientRect();
            const cr = card?.getBoundingClientRect();
            if (!hr || hr.width < 16 || hr.height < 16) issues.push("TOUR_HOLE_INVALID_STEP_" + step);
            if (step === 4) {
              const ar = document.getElementById("alpha-box")?.getBoundingClientRect();
              const hr2 = holes[1]?.getBoundingClientRect();
              if (holes.length < 2 || !hr2 || !ar || hr2.left > ar.left || hr2.right < ar.right) {
                issues.push("TOUR_STEP5_ALPHA_NOT_SPOTLIGHTED");
              }
            }
            // 8단계: 고급 FX 랙을 잠시 열고 랙 + 채널 N G C P 칩 두 곳을 비춘다
            const rackEl = document.getElementById("side-fx-rack");
            const rackShown = rackEl && !rackEl.classList.contains("hidden");
            if (step === 7) {
              if (!rackShown) issues.push("TOUR_STEP8_RACK_NOT_SHOWN");
              const chipR = document.querySelector(".channel-strip .fx-chips")?.getBoundingClientRect();
              const h2 = holes[1]?.getBoundingClientRect();
              if (holes.length < 2 || !h2 || !chipR || h2.left > chipR.left || h2.right < chipR.right) {
                issues.push("TOUR_STEP8_CHIPS_NOT_SPOTLIGHTED");
              }
              // 카드는 left/top 전환(140ms)으로 미끄러지므로 지금 보이는 자리가 아니라 목표 자리(style)로 판정한다
              const cardTarget = card && {
                left: rr.left + parseFloat(card.style.left), top: rr.top + parseFloat(card.style.top),
                right: rr.left + parseFloat(card.style.left) + card.offsetWidth,
                bottom: rr.top + parseFloat(card.style.top) + card.offsetHeight,
              };
              holes.forEach((h, i) => {
                if (cardTarget && computeOverlap(cardTarget, h.getBoundingClientRect()) > 0) issues.push("TOUR_STEP8_CARD_COVERS_HOLE_" + i);
              });
            } else if (rackShown !== rackWasOpen) {
              issues.push("TOUR_RACK_LEAKED_STEP_" + step);
            }
            if (!cr || cr.width < 200 || cr.height < 80) issues.push("TOUR_CARD_INVALID_STEP_" + step);
            if (cr && (cr.left < rr.left - 1 || cr.right > rr.right + 1 || cr.top < rr.top - 1 || cr.bottom > rr.bottom + 1)) {
              issues.push("TOUR_CARD_OUT_OF_BOUNDS_STEP_" + step);
            }
            if (step < TOUR_STEPS - 1) nextBtn?.click();
          }
        }

        // 투어를 N단계까지 넘긴 채로 둔다 (AUDIT_SHOTS 화면 확인용, 판정은 testOnboardingTour가 맡음)
        if (${JSON.stringify(sc.tourShotStep ?? 0)} > 0) {
          document.querySelector("[data-tour-start]")?.click();
          for (let i = 1; i < ${JSON.stringify(sc.tourShotStep ?? 0)}; i++) {
            document.querySelector("#tour-overlay [data-tour-next]")?.click();
          }
          if (document.getElementById("tour-overlay")?.classList.contains("hidden")) issues.push("TOUR_SHOT_OVERLAY_HIDDEN");
        }

        // 0.7.0 상단 균일 N ▾ 스플릿 프리셋 팝오버 열기 검증
        if (${JSON.stringify(Boolean(sc.testNormPopover))}) {
          document.getElementById("auto-norm-preset-btn")?.click();
          const normPop = document.getElementById("norm-popover");
          if (!normPop || normPop.classList.contains("hidden")) {
            issues.push("NORM_POPOVER_NOT_OPEN");
          } else {
            const npr = normPop.getBoundingClientRect();
            if (npr.left < rr.left - 1 || npr.right > rr.right + 1 || npr.bottom > rr.bottom + 1) {
              issues.push("NORM_POPOVER_OUT_OF_BOUNDS");
            }
            if (normPop.querySelectorAll("[data-norm-preset]").length !== 4) {
              issues.push("NORM_PRESET_COUNT_MISMATCH");
            }
            const miniViz = normPop.querySelector(".norm-pop-mini-viz");
            if (!miniViz) {
              issues.push("NORM_POPOVER_MINI_VIZ_MISSING");
            } else {
              const nightBtn = normPop.querySelector('[data-norm-preset="night"]');
              const previewBand = miniViz.querySelector('[data-ref="previewBand"]');
              const miniSummary = miniViz.querySelector('[data-ref="miniSummary"]');
              nightBtn?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
              if (!previewBand || previewBand.classList.contains("hidden")) {
                issues.push("NORM_POPOVER_HOVER_PREVIEW_BAND_NOT_SHOWN");
              }
              if (!miniSummary || !miniSummary.textContent?.includes("→")) {
                issues.push("NORM_POPOVER_HOVER_PREVIEW_SUMMARY_MISSING");
              }
              nightBtn?.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
              if (previewBand && !previewBand.classList.contains("hidden")) {
                issues.push("NORM_POPOVER_HOVER_PREVIEW_BAND_NOT_HIDDEN_ON_LEAVE");
              }
            }
          }
        }

        // 1.2.0 고급 FX 세부 창 · 범위 · 떠오름 검증
        const fxSpec = ${JSON.stringify(sc.testFxDetail ?? null)};
        if (fxSpec) {
          if (fxSpec.global) document.querySelector(".master-fx-btn")?.click();
          const card = document.querySelector('.fx-card[data-panel="' + fxSpec.panel + '"]');
          card?.querySelector(".fx-more-btn")?.click();
          const det = document.getElementById("fx-detail");
          if (!det || det.classList.contains("hidden")) {
            issues.push("FX_DETAIL_NOT_OPEN");
          } else {
            if (fxSpec.detach) {
              det.querySelector(".fx-link-btn")?.click();
              if (!window.__SENT_ACTIONS__.some((m) => m.type === "EDIT_FX" && m.edit && m.edit.kind === "detach")) issues.push("FX_DETACH_NOT_SENT");
            }
            if (fxSpec.tweak) {
              const fast = det.querySelectorAll('[data-ref="speedGrid"] .fx-seg-btn')[2];
              fast?.click();
              const bar = det.querySelector('[data-ref="modBar"]');
              if (!bar || bar.classList.contains("hidden")) issues.push("FX_MODIFIED_BAR_NOT_SHOWN");
            }
            if (fxSpec.manage) {
              const mb = det.querySelector('[data-ref="manageBtn"]');
              if (!mb || mb.classList.contains("hidden")) issues.push("FX_MANAGE_BTN_MISSING");
              else mb.click();
            }
            const dr = det.getBoundingClientRect();
            if (dr.left < rr.left - 1 || dr.right > rr.right + 1 || dr.top < rr.top - 1 || dr.bottom > rr.bottom + 1) {
              issues.push("FX_DETAIL_OUT_OF_BOUNDS: " + [dr.left, dr.top, dr.right, dr.bottom].map(Math.round).join(","));
            }
            // 독립 창(window)은 사용자가 창을 작게 줄일 수 있어 세부 창도 안에서 스크롤한다
            if (!isWin && dr.height < 220) issues.push("FX_DETAIL_TOO_SHORT: " + Math.round(dr.height));
            if (det.scrollWidth > det.clientWidth + 1) issues.push("FX_DETAIL_X_OVERFLOW: " + det.scrollWidth + " > " + det.clientWidth);
            for (const el of det.querySelectorAll(".fx-detail-title, .fx-link-state, .fx-small-btn, .fx-link-btn")) {
              if (el.offsetParent && el.scrollWidth > el.clientWidth + 1) issues.push("FX_DETAIL_TEXT_CLIPPED: " + (el.textContent || "").trim());
            }
          }
          if (fxSpec.stripMute) {
            // "모든 채널" 상태에서 스트립의 M 버튼을 눌러도 범위·세부 창이 그대로여야 한다
            const muteBtn = document.querySelector('.channel-strip [data-ref="muteBtn"]');
            muteBtn?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
            muteBtn?.click();
            if (document.querySelector('.fx-scope-tab')?.dataset.on !== "true") issues.push("STRIP_MUTE_LEFT_GLOBAL_SCOPE");
            if (document.getElementById("fx-detail")?.classList.contains("hidden")) issues.push("STRIP_MUTE_CLOSED_DETAIL");
          }
          const lifted = document.querySelector('.channel-strip[data-selected="true"]');
          const masterLifted = document.querySelector(".master-strip")?.dataset.selected === "true";
          if (fxSpec.global) {
            if (!masterLifted) issues.push("MASTER_NOT_LIFTED_IN_GLOBAL");
            if (lifted) issues.push("STRIP_LIFTED_IN_GLOBAL");
          } else {
            if (masterLifted) issues.push("MASTER_LIFTED_IN_CHANNEL_SCOPE");
            if (!lifted) issues.push("NO_STRIP_LIFTED_IN_CHANNEL_SCOPE");
          }
          const rack = document.getElementById("side-fx-rack");
          if (!isWin && rack && rack.scrollHeight > rack.clientHeight + 1) issues.push("FX_RACK_Y_OVERFLOW: " + rack.scrollHeight + " > " + rack.clientHeight);
          for (const el of document.querySelectorAll(".fx-card-title, .fx-link-btn, .fx-more-btn, .fx-scope-tab")) {
            if (el.offsetParent && el.scrollWidth > el.clientWidth + 1) issues.push("FX_RACK_TEXT_CLIPPED: " + (el.textContent || "").trim());
          }
        }

        const channelCount = document.querySelectorAll(".channel-strip").length;
        // 투어 중 빈 화면이면 예시 채널 2개가 뜬다
        const expectedChannels = ${(sc.testOnboardingTour || sc.tourShotStep) && sc.snap.channels.length === 0 ? 2 : sc.snap.channels.length};
        if (channelCount !== expectedChannels) issues.push("CHANNEL_COUNT_MISMATCH: " + channelCount + " !== " + expectedChannels);
        if (${JSON.stringify(Boolean(sc.openPop))}) {
          const pop = document.getElementById("theme-popover");
          if (!pop || pop.classList.contains("hidden")) issues.push("POPOVER_NOT_OPEN");
        }
        if (document.documentElement.scrollWidth > window.innerWidth + 1) {
          issues.push("OUTER_OVERFLOW: " + document.documentElement.scrollWidth + " > " + window.innerWidth);
        }
        if (isWin && document.documentElement.scrollHeight > window.innerHeight + 1) {
          issues.push("OUTER_OVERFLOW_Y: " + document.documentElement.scrollHeight + " > " + window.innerHeight);
        }

        // 0.5.1 핵심 인터랙션 회귀 감사: 폭 불변성 · 비선택 채널 원클릭 조작 · 블럭 슬롯 & 드래그 중 SNAPSHOT 잠금
        if (${JSON.stringify(Boolean(sc.test051Ux))}) {
          const initRootW = Math.round(root.getBoundingClientRect().width);
          const ch1 = document.querySelector('.channel-strip[data-tab-id="1"]');
          const ch2 = document.querySelector('.channel-strip[data-tab-id="2"]');
          const ch5 = document.querySelector('.channel-strip[data-tab-id="5"]');

          // A) 이미 일시정지된 채널(#5)이 존재할 때 재생 채널(#1) 드래그 시 '여기에 놓아 일시정지' 빈 구역이 뜨지 않고 블럭 슬롯만 표시되는지 검증
          const grip1 = ch1?.querySelector('[data-ref="grip"]');
          const g1r = grip1.getBoundingClientRect();
          const ch5r = ch5.getBoundingClientRect();
          grip1.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 11, clientX: g1r.left + 10, clientY: g1r.top + 5 }));
          window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 11, clientX: g1r.left + 28, clientY: g1r.top + 5 }));
          if (document.querySelectorAll(".drop-zone-empty").length !== 0) {
            issues.push("UNEXPECTED_EMPTY_ZONE_WHEN_PAUSED_NONEMPTY");
          }
          window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 11, clientX: ch5r.left + 12, clientY: g1r.top + 5 }));
          const ind1 = document.querySelector(".drop-slot-indicator");
          if (!ind1) {
            issues.push("MISSING_BLOCK_SLOT_INDICATOR_ON_PAUSE_CROSS");
          } else {
            if (Math.round(ind1.getBoundingClientRect().width) !== 94) {
              issues.push("SLOT_INDICATOR_WIDTH_MISMATCH: " + Math.round(ind1.getBoundingClientRect().width));
            }
            if (ind1.textContent !== "여기에 놓아 일시정지") {
              issues.push("SLOT_INDICATOR_TEXT_MISMATCH_PAUSE: " + ind1.textContent);
            }
          }
          if (Math.round(root.getBoundingClientRect().width) !== initRootW) {
            issues.push("ROOT_WIDTH_SHIFTED_DURING_DRAG");
          }
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          if (document.querySelectorAll(".drop-slot-indicator").length !== 0) {
            issues.push("SLOT_INDICATOR_NOT_CLEANED_ON_ESC");
          }

          // B) 이미 일시정지 상태인 유일 채널(#5)을 잡았을 때 '여기에 놓아 일시정지'가 뜨지 않고, 드래그 중 비동기 SNAPSHOT이 와도 '여기에 놓아 재생' 슬롯이 왼쪽에 유지되는지 검증
          const grip5 = ch5?.querySelector('[data-ref="grip"]');
          const g5r = grip5.getBoundingClientRect();
          const ch1r = ch1.getBoundingClientRect();
          grip5.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 12, clientX: g5r.left + 10, clientY: g5r.top + 5 }));
          window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 12, clientX: g5r.left - 18, clientY: g5r.top + 5 }));
          if (document.querySelectorAll(".drop-zone-empty").length !== 0) {
            issues.push("PAUSED_CHANNEL_DRAG_SPAWNED_EMPTY_PAUSE_ZONE");
          }
          // 드래그 도중 비동기 SNAPSHOT 주입 (Bug 1 재현 조건)
          window.__PORT_LISTENERS__.forEach((fn) => fn({ type: "SNAPSHOT", snapshot: ${JSON.stringify(sc.snap)} }));
          window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 12, clientX: ch1r.left + 8, clientY: g5r.top + 5 }));
          const ind2 = document.querySelector(".drop-slot-indicator");
          const divEl = document.querySelector(".pause-divider");
          if (!ind2 || !divEl || !divEl.isConnected) {
            issues.push("DRAG_DOM_CORRUPTED_BY_ASYNC_SNAPSHOT");
          } else {
            if (ind2.textContent !== "여기에 놓아 재생") {
              issues.push("PLAY_SLOT_TEXT_MISMATCH: " + ind2.textContent);
            }
            if (ind2.getBoundingClientRect().right > divEl.getBoundingClientRect().left + 2) {
              issues.push("PLAY_SLOT_PLACED_RIGHT_OF_PAUSE_DIVIDER");
            }
          }
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

          // C) 비선택 채널(#5, 현재 #1 선택됨)의 재생 버튼을 한 번 클릭했을 때 선택과 TOGGLE_TAB_PLAY(shouldPlay: true)가 첫 클릭에 동시에 수행되는지 검증
          ch1.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
          if (ch5.dataset.selected !== "false") issues.push("CH5_SHOULD_START_UNSELECTED");
          window.__SENT_ACTIONS__.length = 0;
          const playBtn5 = ch5.querySelector('[data-ref="playBtn"]');
          const playChild5 = playBtn5.firstElementChild || playBtn5;
          playChild5.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
          playBtn5.click();
          if (ch5.dataset.selected !== "true") issues.push("SINGLE_CLICK_DID_NOT_SELECT_STRIP");
          const sentToggle = window.__SENT_ACTIONS__.find((m) => m.type === "TOGGLE_TAB_PLAY" && m.tabId === 5);
          if (!sentToggle || sentToggle.shouldPlay !== true) {
            issues.push("SINGLE_CLICK_PLAY_ACTION_LOST: " + JSON.stringify(window.__SENT_ACTIONS__));
          }

          // D) 이제 일시정지 그룹이 0개인 상태에서 재생 채널(#1)을 잡으면 '여기에 놓아 일시정지' 블럭 1개가 뜨고 그 블럭 자체가 드롭 타깃으로 강조되는지 검증
          const g1rAfter = grip1.getBoundingClientRect();
          grip1.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 13, clientX: g1rAfter.left + 10, clientY: g1rAfter.top + 5 }));
          window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 13, clientX: g1rAfter.left + 25, clientY: g1rAfter.top + 5 }));
          const emptyZones = document.querySelectorAll(".drop-zone-empty");
          if (emptyZones.length !== 1 || emptyZones[0].textContent !== "여기에 놓아 일시정지") {
            issues.push("MISSING_EMPTY_PAUSE_ZONE_WHEN_ZERO_PAUSED: count=" + emptyZones.length);
          } else {
            const ezRect = emptyZones[0].getBoundingClientRect();
            window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 13, clientX: ezRect.left + 40, clientY: ezRect.top + 20 }));
            if (emptyZones[0].dataset.active !== "true") issues.push("EMPTY_PAUSE_ZONE_NOT_ACTIVATED_DIRECTLY");
            if (document.querySelectorAll(".drop-slot-indicator").length !== 0) {
              issues.push("DUPLICATE_SLOT_INDICATOR_NEXT_TO_EMPTY_ZONE");
            }
          }
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

          // E) 토스트 출력 중에도 #status-pill(124px)과 #console-root(768px) 폭이 1px도 변하지 않는지 검증
          ch2.querySelector('[data-ref="pinBtn"]')?.click();
          if (Math.round(pill.getBoundingClientRect().width) !== 124) {
            issues.push("STATUS_PILL_WIDTH_CHANGED_ON_TOAST: " + Math.round(pill.getBoundingClientRect().width));
          }
          if (Math.round(root.getBoundingClientRect().width) !== initRootW) {
            issues.push("ROOT_WIDTH_CHANGED_ON_TOAST: " + Math.round(root.getBoundingClientRect().width));
          }
        }

        // 1) 모든 .switch-bank가 3개 버튼(M, S, F)을 온전히 갖추고, 각 .channel-strip이 스테레오 2열(.vu-col 2개)을 갖추었는지 검증
        document.querySelectorAll(".channel-strip").forEach((strip, idx) => {
          const vuCols = strip.querySelectorAll(".stereo-vu-pair .vu-col");
          if (vuCols.length !== 2) {
            issues.push("STEREO_VU_COL_COUNT_MISMATCH #" + idx + ": " + vuCols.length + " !== 2");
          }
        });
        document.querySelectorAll(".switch-bank").forEach((bank, idx) => {
          const btns = bank.querySelectorAll("button");
          if (btns.length !== 3) issues.push("SWITCH_BANK_COUNT_MISMATCH #" + idx + ": " + btns.length + " !== 3");
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
            const gap = stripRect.bottom - lastChild.getBoundingClientRect().bottom;
            if (gap > 10) issues.push("DEAD_BOTTOM_GAP [channel-strip " + (strip.dataset.tabId || "") + "]: " + gap.toFixed(1) + "px > 10px");
          }
        });
        document.querySelectorAll(".master-strip").forEach((strip) => {
          const stripRect = strip.getBoundingClientRect();
          const lastChild = strip.lastElementChild;
          if (lastChild) {
            const gap = stripRect.bottom - lastChild.getBoundingClientRect().bottom;
            if (gap > 10) issues.push("DEAD_BOTTOM_GAP [master-strip]: " + gap.toFixed(1) + "px > 10px");
          }
        });

        // 3) 고급 FX 사이드 랙 높이 및 CORS 채널 전환 시 레이아웃 높이 점프 불변성 검증
        const advRack = document.getElementById("side-fx-rack");
        const advRackHeight = advRack && !advRack.classList.contains("hidden")
          ? Math.round(advRack.getBoundingClientRect().height) : 0;

        if (${JSON.stringify(sc.name)} === "adv_rack_normal" && advRack && !advRack.classList.contains("hidden")) {
          // 1.2.0: 노멀라이저 시각화는 랙 카드의 "세부 ▸"로 여는 세부 창(#fx-detail)에 있다
          advRack.querySelector('.fx-card[data-panel="norm"] .fx-more-btn')?.click();
          const vizHost = document.getElementById("fx-detail");
          const vizToggle = vizHost?.querySelector('[data-ref="modeToggleBtn"]');
          const spec2d = vizHost?.querySelector('[data-ref="spec2dWrap"]');
          const bar1d = vizHost?.querySelector('[data-ref="bar1dWrap"]');
          if (!vizToggle || !spec2d || !bar1d) {
            issues.push("MISSING_NORM_VISUALIZER_ELEMENTS");
          } else {
            if (spec2d.classList.contains("hidden") || !bar1d.classList.contains("hidden")) {
              issues.push("NORM_VIZ_DEFAULT_SHOULD_BE_2D");
            }
            if (vizToggle.getAttribute("data-icon-state") !== "collapse" || vizToggle.textContent.trim().length > 0) {
              issues.push("NORM_VIZ_ICON_SHOULD_BE_COLLAPSE_IN_2D");
            }
            vizToggle.click();
            if (!spec2d.classList.contains("hidden") || bar1d.classList.contains("hidden")) {
              issues.push("NORM_VIZ_TOGGLE_TO_1D_FAILED");
            }
            if (vizToggle.getAttribute("data-icon-state") !== "expand" || vizToggle.textContent.trim().length > 0) {
              issues.push("NORM_VIZ_ICON_SHOULD_BE_EXPAND_IN_1D");
            }
            vizToggle.click();
            if (spec2d.classList.contains("hidden") || !bar1d.classList.contains("hidden")) {
              issues.push("NORM_VIZ_TOGGLE_BACK_TO_2D_FAILED");
            }
          }
        }

        if (${JSON.stringify(sc.name)} === "adv_rack_cors" && advRack && !advRack.classList.contains("hidden")) {
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

        // 4) 0.7.0 3탭 도움말 모달(빠른 투어 · 콘솔 사용법 · 노멀라이저·고급 FX) & 1:1 도면 중첩 카드 검증
        if (${JSON.stringify(Boolean(sc.testHelpModal))}) {
          const helpBtn = document.getElementById("help-btn");
          helpBtn?.click();
          const backdrop = document.getElementById("help-backdrop");
          if (!backdrop || backdrop.classList.contains("hidden")) {
            issues.push("HELP_BACKDROP_NOT_VISIBLE");
          }
          const modal = document.querySelector(".help-modal");
          if (!modal) {
            issues.push("MISSING_HELP_MODAL");
          } else {
            const mr = modal.getBoundingClientRect();
            if (mr.width <= 0 || mr.height <= 0) issues.push("HELP_MODAL_ZERO_BOUNDS: " + mr.width + "x" + mr.height);
            if (mr.left < rr.left - 1 || mr.right > rr.right + 1 || mr.top < rr.top - 1 || mr.bottom > rr.bottom + 1) {
              issues.push("HELP_MODAL_OUT_OF_BOUNDS: [" + mr.left + "," + mr.top + "," + mr.right + "," + mr.bottom + "]");
            }
            if (modal.querySelector('[data-help-tab="tour"]')?.getAttribute("data-active") !== "true") {
              issues.push("HELP_DEFAULT_TAB_NOT_TOUR");
            }
            if (!modal.querySelector("[data-tour-start]") || !modal.querySelector("[data-tour-skip]")) {
              issues.push("MISSING_TOUR_LAUNCHER_BUTTONS");
            }
          }

          modal?.querySelector('[data-help-tab="adv"]')?.click();
          const advDot4 = modal?.querySelector('[data-help-step="4"]');
          if (!advDot4 || !advDot4.classList.contains("hidden")) {
            issues.push("ADV_TAB_SHOULD_HIDE_5TH_STEP_DOT");
          }

          modal?.querySelector('[data-help-tab="easy"]')?.click();
          if (!modal?.querySelector('[data-term="tabJump"]') || !modal?.querySelector('[data-term="popout"]')) {
            issues.push("MISSING_STEP0_GENERAL_CHIPS");
          }
          modal?.querySelector('[data-help-step="4"]')?.click();
          if (modal?.querySelector('[data-ref="stepBadge"]')?.textContent?.trim() !== "5 / 5") {
            issues.push("MISSING_STEP5_SAFETY_BADGE: " + modal?.querySelector('[data-ref="stepBadge"]')?.textContent);
          }
          const safetyBullets = modal?.querySelectorAll('[data-ref="bulletList"] li')?.length ?? 0;
          if (safetyBullets < 4) {
            issues.push("MISSING_STEP5_SAFETY_BULLETS: count=" + safetyBullets);
          }

          const nestedCard = document.querySelector('[data-ref="nestedCard"]');
          modal?.querySelector('[data-help-step="2"]')?.click();
          const pinChip = modal?.querySelector('[data-term="pin"]');
          if (!pinChip || !modal?.querySelector('[data-term="grip"]')) issues.push("MISSING_STEP2_PIN_GRIP_CHIPS");
          if (pinChip && nestedCard) {
            pinChip.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
            if (!nestedCard.querySelector('[data-schematic="pin"].highlighted')) issues.push("PIN_SCHEMATIC_NOT_HIGHLIGHTED");
            pinChip.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
          }

          modal?.querySelector('[data-help-step="1"]')?.click();
          const faderChip = modal?.querySelector('[data-term="fader"]');
          if (!faderChip) issues.push("MISSING_FADER_CHIP");
          if (!nestedCard) issues.push("MISSING_NESTED_CARD");
          if (faderChip && nestedCard) {
            faderChip.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
            if (nestedCard.classList.contains("hidden")) issues.push("NESTED_CARD_NOT_VISIBLE_ON_ENTER");
            if (getComputedStyle(nestedCard).pointerEvents !== "none") issues.push("UNPINNED_NESTED_CARD_INTERCEPTS_POINTER");
            faderChip.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
            if (!nestedCard.classList.contains("hidden")) issues.push("NESTED_CARD_NOT_HIDDEN_ON_LEAVE");
          }

          const knobChip = modal?.querySelector('[data-term="knob"]');
          if (!knobChip) issues.push("MISSING_KNOB_CHIP");
          if (knobChip && nestedCard) {
            knobChip.focus();
            knobChip.click();
            knobChip.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
            if (nestedCard.classList.contains("hidden")) issues.push("NESTED_CARD_NOT_PINNED_ON_CLICK");
            if (getComputedStyle(nestedCard).pointerEvents !== "auto") issues.push("PINNED_NESTED_CARD_NOT_INTERACTIVE");
            if (!nestedCard.querySelector("svg")) issues.push("NESTED_CARD_MISSING_SVG");
          }
        }

        // 레이아웃 감사: 버튼, 텍스트 배지, 용어 칩, 중첩 시각 카드, 투어 카드의 CLIP_X, WRAP, BLEED_Y 감사
        document.querySelectorAll("button, .alpha-readout, .status-text, .readout-sub, .strip-title, .pop-theme-btn, .fx-card-title, .term-chip, .nested-term-card, .tour-card").forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return;
          const cls = el.getAttribute("class") || "";
          const isTruncate = cls.includes("truncate") || cls.includes("status-text");
          if (!isTruncate && el.scrollWidth > el.clientWidth + 1) {
            issues.push("CLIP_X [" + el.textContent.trim().slice(0, 20) + "]: " + el.scrollWidth + " > " + el.clientWidth);
          }
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let n;
          while ((n = walker.nextNode())) {
            if (!n.nodeValue.trim()) continue;
            if (n.parentElement && n.parentElement.closest("svg")) continue;
            const pCls = (n.parentElement && n.parentElement.getAttribute("class")) || "";
            const isWrapAllowed = cls.includes("desc") || pCls.includes("desc") || cls.includes("tip") || pCls.includes("tip") || cls.includes("allow-wrap") || pCls.includes("allow-wrap");
            const nodeTrunc = isTruncate || pCls.includes("truncate") || pCls.includes("status-text");
            const range = document.createRange();
            range.selectNodeContents(n);
            const rects = range.getClientRects();
            if (!nodeTrunc && !isWrapAllowed && rects.length > 1) {
              issues.push("WRAP [" + n.nodeValue.trim() + "]: rects=" + rects.length);
            }
            const r0 = rects[0];
            const rLast = rects[rects.length - 1];
            if (r0 && rLast && (r0.top < rect.top - 0.6 || rLast.bottom > rect.bottom + 0.6)) {
              issues.push("BLEED_Y [" + n.nodeValue.trim() + "]");
            }
          }
        });
        document.querySelectorAll(".fader-well").forEach((well, idx) => {
          const wr = well.getBoundingClientRect();
          const knob = well.querySelector('[data-ref="knob"]');
          if (knob) {
            const kr = knob.getBoundingClientRect();
            if (kr.top < wr.top + 1 || kr.bottom > wr.bottom - 1) issues.push("KNOB_OUT_OF_WELL #" + idx);
          }
        });

        if (${JSON.stringify(Boolean(sc.testNormPopover))}) {
          document.querySelector('[data-norm-preset="music"]')?.click();
          if (!document.getElementById("norm-popover")?.classList.contains("hidden")) {
            issues.push("NORM_POPOVER_NOT_CLOSED_ON_SELECT");
          }
          if (!window.__SENT_ACTIONS__.some((m) => m.type === "SET_AUTO_NORM_PRESET" && m.preset === "music" && m.enable === true)) {
            issues.push("SET_AUTO_NORM_PRESET_NOT_SENT");
          }
        }

        if (${JSON.stringify(Boolean(sc.testOnboardingTour))}) {
          document.querySelector("#tour-overlay [data-tour-next]")?.click();
          if (!document.getElementById("tour-overlay")?.classList.contains("hidden")) {
            issues.push("TOUR_OVERLAY_NOT_CLOSED_ON_FINISH");
          }
          if (document.querySelectorAll(".channel-strip").length !== 0 || !document.querySelector(".empty-bay")) {
            issues.push("DEMO_CHANNELS_NOT_CLEANED_AFTER_TOUR");
          }
          if (!document.getElementById("side-fx-rack")?.classList.contains("hidden")) {
            issues.push("TOUR_RACK_LEFT_OPEN_AFTER_TOUR");
          }
          if (window.__SENT_ACTIONS__.some((m) => m.type === "SET_ADV_RACK_OPEN")) {
            issues.push("TOUR_RACK_OPEN_PERSISTED");
          }
          if (window.__SENT_ACTIONS__.some((m) => typeof m.tabId === "number" && m.tabId < 0)) {
            issues.push("NEGATIVE_DEMO_TAB_ACTION_LEAKED");
          }
        }

        // 5) Escape 2계층 해제(1차: 중첩 카드 -> 2차: 모달 전체) 검증
        if (${JSON.stringify(Boolean(sc.testHelpModal))}) {
          const backdrop = document.getElementById("help-backdrop");
          const nestedCard = document.querySelector('[data-ref="nestedCard"]');
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          if (nestedCard && !nestedCard.classList.contains("hidden")) {
            issues.push("ESCAPE_LAYER1_NESTED_NOT_CLOSED");
          }
          if (!backdrop || backdrop.classList.contains("hidden")) {
            issues.push("ESCAPE_LAYER1_BACKDROP_ACCIDENTALLY_CLOSED");
          }
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          if (backdrop && !backdrop.classList.contains("hidden")) {
            issues.push("ESCAPE_LAYER2_BACKDROP_NOT_CLOSED");
          }
        }

        const pre = document.createElement("pre");
        pre.id = "ui-audit-json";
        pre.textContent = JSON.stringify({
          scenario: ${JSON.stringify(sc.name)},
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

/** 1.2.0 "모든 채널" 고급 FX 층 (노멀라이저는 표준 프리셋 값) */
function globalFx(normOn) {
  return {
    norm: { enabled: normOn, presetId: "standard", modified: false, targetLufs: -16, speed: "std", rangeLowLufs: -36, rangeHighLufs: -8, zeroReturnRate: 0.25, minDwellBlocks: 6, maxBoostDb: 7.5 },
    gate: { enabled: false, thresholdDb: -48 },
    comp: { enabled: false, ratio: 4 },
  };
}

const BASE_SETTINGS = {
  theme: "teal", modePref: "dark", alpha: 0.7, masterDb: 0, masterMuted: false,
  globalFx: globalFx(false), globalPan: 0, userPresets: [], advRackOpen: false, onboardingDone: true,
  popoutWidth: 780, popoutHeight: 480, domainDefaults: {},
};

const USER_PRESETS = [
  { id: "u1", name: "심야 대사", targetLufs: -20, speed: "std", rangeLowLufs: -36, rangeHighLufs: -8, zeroReturnRate: 0.25, minDwellBlocks: 6, maxBoostDb: 7.5 },
];

const PINNED_DEFAULTS = { "chzzk.naver.com": 0, "youtube.com": -6 };

const SAMPLE_CHANNELS_EN = [
  {
    tabId: 1, windowId: 1, title: "Live Talk Broadcast", domain: "live.example", shortHost: "live",
    favIconUrl: "", playing: true, audible: true, mediaCount: 1, db: 0.0,
    muted: false, solo: false, focus: true, corsCap: false, vuLevel: 0.66, vuPeak: 0.76, firstSeenAt: 1,
    sortOrder: 1, normTrimDb: 0.0,
    fx: { own: { gate: { enabled: true, thresholdDb: -48 } }, pan: 0 },
  },
  {
    tabId: 2, windowId: 1, title: "Acoustic Focus Session", domain: "audio.example", shortHost: "audio",
    favIconUrl: "", playing: true, audible: true, mediaCount: 1, db: -6.0,
    muted: false, solo: false, focus: false, corsCap: false, vuLevel: 0.42, vuPeak: 0.52, firstSeenAt: 2,
    sortOrder: 2, normTrimDb: 2.1,
    fx: { own: { norm: { enabled: true, presetId: "", modified: false, targetLufs: -14, speed: "fast", rangeLowLufs: -32, rangeHighLufs: -10, zeroReturnRate: 0.35, minDwellBlocks: 2, maxBoostDb: 9 }, comp: { enabled: true, ratio: 2 } }, pan: -20 },
  },
  {
    tabId: 3, windowId: 1, title: "Engineering Keynote", domain: "video.example", shortHost: "video",
    favIconUrl: "", playing: true, audible: true, mediaCount: 1, db: 4.5,
    muted: false, solo: false, focus: false, corsCap: false, vuLevel: 0.54, vuPeak: 0.64, firstSeenAt: 3,
    sortOrder: 3, normTrimDb: 0.0,
    fx: { own: {}, pan: 15 },
  },
  {
    tabId: 4, windowId: 2, title: "Feature Documentary", domain: "cinema.example", shortHost: "cinema",
    favIconUrl: "", playing: true, audible: true, mediaCount: 1, db: 0.0,
    muted: false, solo: false, focus: false, corsCap: true, vuLevel: 0.48, vuPeak: 0.58, firstSeenAt: 4,
    sortOrder: 4, normTrimDb: 0.0,
    fx: { own: {}, pan: 0 },
  },
  {
    tabId: 5, windowId: 2, title: "Evening Podcast Episode", domain: "podcast.example", shortHost: "podcast",
    favIconUrl: "", playing: false, audible: false, mediaCount: 1, db: -3.0,
    muted: false, solo: false, focus: false, corsCap: false, vuLevel: 0, vuPeak: 0, firstSeenAt: 5,
    sortOrder: 5, normTrimDb: 0.0,
    fx: { own: { norm: { enabled: false, presetId: "", modified: false, targetLufs: -18, speed: "slow", rangeLowLufs: -32, rangeHighLufs: -10, zeroReturnRate: 0.35, minDwellBlocks: 16, maxBoostDb: 6 } }, pan: 0 },
  },
];

const scenarios = [
  { name: "empty_popup", w: 800, h: 600, isWindow: false, openPop: false, snap: { settings: { ...BASE_SETTINGS }, channels: [] } },
  { name: "onboarding_and_spotlight_tour", w: 800, h: 600, isWindow: false, openPop: false, testOnboardingTour: true, snap: { settings: { ...BASE_SETTINGS, onboardingDone: false }, channels: [] } },
  { name: "popup_norm_popover", w: 800, h: 600, isWindow: false, openPop: false, testNormPopover: true, snap: { settings: { ...BASE_SETTINGS, globalFx: globalFx(true) }, channels: SAMPLE_CHANNELS } },
  { name: "active_popup_051", w: 800, h: 600, isWindow: false, openPop: false, test051Ux: true, snap: { settings: { ...BASE_SETTINGS, domainDefaults: PINNED_DEFAULTS }, channels: SAMPLE_CHANNELS } },
  { name: "adv_rack_normal", w: 800, h: 600, isWindow: false, openPop: false, selectTabId: 2, snap: { settings: { ...BASE_SETTINGS, globalFx: globalFx(true), advRackOpen: true, domainDefaults: { "youtube.com": -6 } }, channels: SAMPLE_CHANNELS } },
  { name: "adv_rack_cors", w: 800, h: 600, isWindow: false, openPop: false, selectTabId: 4, snap: { settings: { ...BASE_SETTINGS, globalFx: globalFx(true), advRackOpen: true }, channels: SAMPLE_CHANNELS } },
  { name: "window_narrow_520", w: 520, h: 420, isWindow: true, openPop: false, snap: { settings: { ...BASE_SETTINGS, domainDefaults: { "chzzk.naver.com": 0 } }, channels: SAMPLE_CHANNELS } },
  { name: "window_popover_dark", w: 680, h: 460, isWindow: true, openPop: true, snap: { settings: { ...BASE_SETTINGS, theme: "cobalt", modePref: "dark" }, channels: SAMPLE_CHANNELS } },
  { name: "window_popover_light", w: 680, h: 460, isWindow: true, openPop: true, snap: { settings: { ...BASE_SETTINGS, theme: "emerald", modePref: "light" }, channels: SAMPLE_CHANNELS } },
  { name: "window_inline_edit", w: 680, h: 460, isWindow: true, openPop: false, inlineEdit: true, snap: { settings: { ...BASE_SETTINGS, domainDefaults: PINNED_DEFAULTS }, channels: SAMPLE_CHANNELS } },
  { name: "window_help_modal", w: 680, h: 480, isWindow: true, openPop: false, testHelpModal: true, snap: { settings: { ...BASE_SETTINGS, domainDefaults: PINNED_DEFAULTS }, channels: SAMPLE_CHANNELS } },
  { name: "en_empty_popup", lang: "en", w: 800, h: 600, isWindow: false, openPop: false, snap: { settings: { ...BASE_SETTINGS }, channels: [] } },
  { name: "tour_step8_rack", w: 800, h: 600, isWindow: false, openPop: false, tourShotStep: 8, snap: { settings: { ...BASE_SETTINGS, onboardingDone: false }, channels: [] } },
  { name: "en_tour_step8_live", lang: "en", w: 800, h: 600, isWindow: false, openPop: false, tourShotStep: 8, snap: { settings: { ...BASE_SETTINGS, onboardingDone: false }, channels: SAMPLE_CHANNELS_EN } },
  { name: "en_onboarding_tour", lang: "en", w: 800, h: 600, isWindow: false, openPop: false, testOnboardingTour: true, snap: { settings: { ...BASE_SETTINGS, onboardingDone: false }, channels: [] } },
  { name: "en_norm_popover", lang: "en", w: 800, h: 600, isWindow: false, openPop: false, testNormPopover: true, snap: { settings: { ...BASE_SETTINGS, globalFx: globalFx(true) }, channels: SAMPLE_CHANNELS_EN } },
  { name: "fx_global_norm_detail", w: 800, h: 600, isWindow: false, openPop: false, testFxDetail: { global: true, panel: "norm", manage: true }, snap: { settings: { ...BASE_SETTINGS, globalFx: globalFx(true), userPresets: USER_PRESETS, advRackOpen: true }, channels: SAMPLE_CHANNELS } },
  { name: "fx_light_detach_tweak", w: 800, h: 600, isWindow: false, openPop: false, selectTabId: 3, testFxDetail: { panel: "norm", detach: true, tweak: true }, snap: { settings: { ...BASE_SETTINGS, theme: "emerald", modePref: "light", globalFx: globalFx(true), advRackOpen: true }, channels: SAMPLE_CHANNELS } },
  { name: "fx_rightmost_pan_detail", w: 800, h: 600, isWindow: false, openPop: false, selectTabId: 5, testFxDetail: { panel: "pan" }, snap: { settings: { ...BASE_SETTINGS, globalPan: 20, advRackOpen: true }, channels: SAMPLE_CHANNELS } },
  { name: "fx_global_keep_on_strip_mute", w: 800, h: 600, isWindow: false, openPop: false, testFxDetail: { global: true, panel: "gate", stripMute: true }, snap: { settings: { ...BASE_SETTINGS, advRackOpen: true }, channels: SAMPLE_CHANNELS } },
  { name: "window_narrow_fx_detail", w: 520, h: 420, isWindow: true, openPop: false, testFxDetail: { global: true, panel: "norm" }, snap: { settings: { ...BASE_SETTINGS, globalFx: globalFx(true), advRackOpen: true }, channels: SAMPLE_CHANNELS } },
  { name: "en_fx_global_detail", lang: "en", w: 800, h: 600, isWindow: false, openPop: false, testFxDetail: { global: true, panel: "norm", manage: true }, snap: { settings: { ...BASE_SETTINGS, globalFx: globalFx(true), userPresets: USER_PRESETS, advRackOpen: true }, channels: SAMPLE_CHANNELS_EN } },
  { name: "en_adv_rack", lang: "en", w: 800, h: 600, isWindow: false, openPop: false, selectTabId: 2, snap: { settings: { ...BASE_SETTINGS, globalFx: globalFx(true), advRackOpen: true, domainDefaults: { "audio.example": -6 } }, channels: SAMPLE_CHANNELS_EN } },
  { name: "en_window_popover", lang: "en", w: 680, h: 460, isWindow: true, openPop: true, snap: { settings: { ...BASE_SETTINGS, theme: "cobalt", modePref: "dark" }, channels: SAMPLE_CHANNELS_EN } },
  { name: "en_help_modal", lang: "en", w: 680, h: 480, isWindow: true, openPop: false, testHelpModal: true, snap: { settings: { ...BASE_SETTINGS, domainDefaults: { "live.example": 0, "audio.example": -6 } }, channels: SAMPLE_CHANNELS_EN } },
];

let failed = false;
try {
  const results = await Promise.all(
    scenarios.map(async (sc) => {
      const scProfile = path.join(TMP_DIR, `profile_${sc.name}`);
      fs.mkdirSync(scProfile, { recursive: true });
      const htmlFile = path.join(TMP_DIR, `audit_${sc.name}.html`);
      fs.writeFileSync(htmlFile, buildAuditHtml(sc), "utf8");
      const params = new URLSearchParams();
      if (sc.isWindow) params.set("view", "window");
      if (sc.lang) params.set("lang", sc.lang);
      const query = params.toString() ? `?${params.toString()}` : "";
      const fileUrl = "file:///" + htmlFile.replace(/\\/g, "/") + query;
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
      // 선택: AUDIT_SHOTS=<폴더>를 주면 장면마다 화면을 찍어 남긴다 (눈으로 확인용)
      if (process.env.AUDIT_SHOTS) {
        fs.mkdirSync(process.env.AUDIT_SHOTS, { recursive: true });
        await execFileAsync(CHROME_BIN, [
          "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
          `--user-data-dir=${scProfile}_shot`, `--window-size=${sc.w},${sc.h}`,
          "--virtual-time-budget=350",
          `--screenshot=${path.join(process.env.AUDIT_SHOTS, `${sc.name}.png`)}`,
          fileUrl,
        ]).catch(() => {});
      }
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
