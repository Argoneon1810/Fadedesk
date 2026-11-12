import {
  BRIDGE_TO_HOOK_EVENT,
  HOOK_TO_BRIDGE_EVENT,
  type BgToBridgeMessage,
  type BridgeToBgMessage,
  type HookCommand,
  type HookReportEvent,
} from "../shared/types";

/**
 * ISOLATED 월드에서 실행되는 경량 콘텐츠 브리지.
 * MAIN 월드의 audio-hook.js와 백그라운드 서비스 워커 사이에서 JSON 직렬화된 이벤트만 중계한다.
 */

function installContentBridge(): void {
  const globalBag = window as unknown as Record<string, unknown>;
  if (globalBag.__SOUND_MANAGER_BRIDGE_ACTIVE__) return;
  globalBag.__SOUND_MANAGER_BRIDGE_ACTIVE__ = true;

  function sendToHook(cmd: HookCommand): void {
    document.dispatchEvent(
      new CustomEvent(BRIDGE_TO_HOOK_EVENT, { detail: JSON.stringify(cmd) }),
    );
  }

  function safeSendToBackground(msg: BridgeToBgMessage): void {
    try {
      if (!chrome?.runtime?.id) return;
      void chrome.runtime.sendMessage(msg).catch(() => {
        // 서비스 워커 재기동 중이거나 확장이 리로드된 경우 무시
      });
    } catch {
      // 확장 컨텍스트 무효화 무시
    }
  }

  document.addEventListener(HOOK_TO_BRIDGE_EVENT, (ev: Event) => {
    const raw = (ev as CustomEvent<string>).detail;
    if (typeof raw !== "string") return;
    try {
      const parsed = JSON.parse(raw) as HookReportEvent;
      if (parsed.type === "MEDIA_REPORT") {
        safeSendToBackground({
          source: "content-bridge",
          type: "FRAME_REPORT",
          payload: parsed.payload,
        });
      } else if (parsed.type === "VU_TICK") {
        safeSendToBackground({
          source: "content-bridge",
          type: "FRAME_VU",
          vuLevel: parsed.vuLevel,
          vuPeak: parsed.vuPeak,
          normTrimDb: typeof parsed.normTrimDb === "number" ? parsed.normTrimDb : 0,
        });
      }
    } catch {
      // 손상된 페이로드 무시
    }
  });

  chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
    const typed = msg as BgToBridgeMessage | undefined;
    if (typed && typed.target === "content-bridge" && typed.command) {
      sendToHook(typed.command);
      sendResponse({ ok: true });
    }
    return false;
  });

  window.addEventListener(
    "pagehide",
    () => {
      safeSendToBackground({ source: "content-bridge", type: "FRAME_UNLOAD" });
    },
    { passive: true },
  );

  // 브리지 준비 직후 MAIN 훅에 초기 상태 보고를 요청하고, 백그라운드로부터 현재 게인을 동기화받음
  sendToHook({ type: "REQUEST_REPORT" });
}

if (typeof window !== "undefined" && typeof chrome !== "undefined" && chrome.runtime?.id) {
  installContentBridge();
}
