import type { PopupActionMessage } from "../shared/types";
import { ICONS } from "./icons";

/**
 * 툴바 팝업 모드(`popup`)와 분리된 독립 콘솔 창 모드(`?view=window`) 전환·크기 기억 모듈.
 * - 기본 팝업에서는 상단 분리 버튼(`#popout-btn`) 클릭 시 백그라운드에 독립 창 열기/포커스를 요청한 뒤 팝업을 닫는다.
 * - 독립 창에서는 버튼을 숨기고 사용자가 조절한 창 외곽 치수(`outerWidth × outerHeight`)를 디바운스 저장하며,
 *   최소 가로 520px · 세로 420px 미만으로 축소되지 않도록 자동 복원 클램프를 적용한다.
 */

export const MIN_POPOUT_WIDTH = 520;
export const MIN_POPOUT_HEIGHT = 420;

export function clampStandaloneWindowBounds(
  rawW: number,
  rawH: number,
): { clamped: boolean; width: number; height: number } {
  const w = Math.round(Number.isFinite(rawW) ? rawW : MIN_POPOUT_WIDTH);
  const h = Math.round(Number.isFinite(rawH) ? rawH : MIN_POPOUT_HEIGHT);
  const targetW = Math.max(MIN_POPOUT_WIDTH, w);
  const targetH = Math.max(MIN_POPOUT_HEIGHT, h);
  return {
    clamped: targetW !== w || targetH !== h,
    width: targetW,
    height: targetH,
  };
}

export function isStandaloneWindowView(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("view") === "window";
  } catch {
    return false;
  }
}

export function initViewModeAndPopout(sendAction: (msg: PopupActionMessage) => void): void {
  const standalone = isStandaloneWindowView();
  const modeAttr = standalone ? "window" : "popup";
  document.documentElement.dataset.view = modeAttr;
  const root = document.getElementById("console-root");
  if (root) root.dataset.view = modeAttr;

  const popoutBtn = document.getElementById("popout-btn") as HTMLButtonElement | null;
  if (standalone) {
    if (popoutBtn) popoutBtn.classList.add("hidden");
    document.title = "Sound Manager — 독립 콘솔";

    let clampCooldownUntil = 0;
    let clampTimer: ReturnType<typeof setTimeout> | null = null;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;

    window.addEventListener("resize", () => {
      // 90ms 빠른 최소 크기 복원 디바운스
      if (clampTimer) clearTimeout(clampTimer);
      clampTimer = setTimeout(() => {
        clampTimer = null;
        if (document.visibilityState === "hidden") return;
        const w = Math.round(window.outerWidth);
        const h = Math.round(window.outerHeight);
        if (w <= 0 || h <= 0) return;

        const { clamped, width: targetW, height: targetH } = clampStandaloneWindowBounds(w, h);
        if (clamped && Date.now() >= clampCooldownUntil) {
          clampCooldownUntil = Date.now() + 220;
          if (typeof chrome !== "undefined" && chrome?.windows?.getCurrent && chrome?.windows?.update) {
            try {
              chrome.windows.getCurrent((win) => {
                if (win && win.state !== "minimized" && typeof win.id === "number") {
                  void chrome.windows.update(win.id, { width: targetW, height: targetH }).catch(() => {});
                }
              });
            } catch {
              // ignore
            }
          }
          try {
            window.resizeTo(targetW, targetH);
          } catch {
            // ignore
          }
        }
      }, 90);

      // 250ms 정상 범위 치수 영구 저장 디바운스
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveTimer = null;
        if (document.visibilityState === "hidden") return;
        const w = Math.round(window.outerWidth);
        const h = Math.round(window.outerHeight);
        if (w >= MIN_POPOUT_WIDTH && h >= MIN_POPOUT_HEIGHT) {
          sendAction({ source: "popup", type: "SAVE_POPOUT_BOUNDS", width: w, height: h });
        }
      }, 250);
    });
    return;
  }

  if (!popoutBtn) return;
  popoutBtn.innerHTML = ICONS.popout;
  popoutBtn.addEventListener("click", async (ev) => {
    ev.stopPropagation();
    if (popoutBtn.disabled) return;
    popoutBtn.disabled = true;

    const action: PopupActionMessage = { source: "popup", type: "OPEN_STANDALONE_WINDOW" };
    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        await chrome.runtime.sendMessage(action);
      } else {
        sendAction(action);
      }
    } catch {
      sendAction(action);
    }
    window.close();
  });
}
