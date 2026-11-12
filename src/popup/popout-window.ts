import type { PopupActionMessage } from "../shared/types";
import { ICONS } from "./icons";

/**
 * 툴바 팝업 모드(`popup`)와 분리된 독립 콘솔 창 모드(`?view=window`) 전환·크기 기억 모듈.
 * - 기본 팝업에서는 상단 분리 버튼(`#popout-btn`) 클릭 시 백그라운드에 독립 창 열기/포커스를 요청한 뒤 팝업을 닫는다.
 * - 독립 창에서는 버튼을 숨기고 사용자가 조절한 창 외곽 치수(`outerWidth × outerHeight`)를 디바운스 저장한다.
 */

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

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    window.addEventListener("resize", () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        if (document.visibilityState === "hidden") return;
        const w = Math.round(window.outerWidth);
        const h = Math.round(window.outerHeight);
        if (w >= 520 && h >= 380) {
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
