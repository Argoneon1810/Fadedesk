import { resolveBuildId } from "../shared/build-id";
import {
  BRIDGE_TO_HOOK_EVENT,
  HOOK_TO_BRIDGE_EVENT,
  type BgToBridgeMessage,
  type BridgeToBgMessage,
  type HookCommand,
  type HookReportEvent,
} from "../shared/types";

/**
 * ISOLATED 월드에서 실행되는 무중단 교체형 경량 콘텐츠 브리지.
 * - MAIN 월드의 audio-hook.js와 백그라운드 서비스 워커 사이에서 JSON 직렬화된 이벤트만 중계한다.
 * - 확장 리로드나 버전 업데이트 시 고아 DOM 리스너를 자동으로 해제하고 새 브리지 인스턴스로 바인딩을 교체한다.
 */

export interface ContentBridgeInstance {
  readonly buildId: string;
  isAlive: () => boolean;
  dispose: () => void;
}

export function installContentBridge(options?: { buildId?: string }): ContentBridgeInstance | void {
  const buildId = resolveBuildId(options?.buildId);
  const globalBag = window as unknown as Record<string, unknown>;
  const existing = globalBag.__SOUND_MANAGER_BRIDGE__ as ContentBridgeInstance | undefined;

  // 동일 빌드이고 확장 런타임이 유효하면 중복 설치 없이 재사용
  if (existing && existing.isAlive() && existing.buildId === buildId) {
    return existing;
  }

  // 빌드가 다르거나 런타임이 죽은 구 브리지는 이전 리스너를 안전하게 해제
  if (existing) {
    try {
      existing.dispose();
    } catch {
      // 구 브리지 해제 예외 무시
    }
  }

  let disposed = false;

  function isAlive(): boolean {
    return !disposed && Boolean(typeof chrome !== "undefined" && chrome?.runtime?.id);
  }

  function sendToHook(cmd: HookCommand): void {
    if (disposed) return;
    try {
      document.dispatchEvent(
        new CustomEvent(BRIDGE_TO_HOOK_EVENT, { detail: JSON.stringify(cmd) }),
      );
    } catch {
      // 문서 언로드 중 이벤트 발행 실패 무시
    }
  }

  function safeSendToBackground(msg: BridgeToBgMessage): void {
    if (!isAlive()) return;
    try {
      void chrome.runtime.sendMessage(msg).catch(() => {
        // 서비스 워커 재기동 중이거나 통신 일시 단절 무시
      });
    } catch {
      // 확장 컨텍스트 무효화 시 리스너 자체 해제 유도
      dispose();
    }
  }

  const onHookEvent = (ev: Event): void => {
    if (!isAlive()) {
      dispose();
      return;
    }
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
          vuLevelL: parsed.vuLevelL,
          vuLevelR: parsed.vuLevelR,
          inputLufs: parsed.inputLufs,
          spectrumBins: parsed.spectrumBins,
          normTrimDb: typeof parsed.normTrimDb === "number" ? parsed.normTrimDb : 0,
        });
      }
    } catch {
      // 손상된 페이로드 무시
    }
  };

  const onRuntimeMessage = (msg: unknown, _sender: unknown, sendResponse: (resp: unknown) => void) => {
    if (!isAlive()) return false;
    const typed = msg as BgToBridgeMessage | undefined;
    if (typed && typed.target === "content-bridge" && typed.command) {
      sendToHook(typed.command);
      sendResponse({ ok: true });
    }
    return false;
  };

  const onPageHide = (): void => {
    safeSendToBackground({ source: "content-bridge", type: "FRAME_UNLOAD" });
  };

  document.addEventListener(HOOK_TO_BRIDGE_EVENT, onHookEvent);
  window.addEventListener("pagehide", onPageHide, { passive: true });
  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener(onRuntimeMessage);
  }

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    document.removeEventListener(HOOK_TO_BRIDGE_EVENT, onHookEvent);
    window.removeEventListener("pagehide", onPageHide);
    if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
      try {
        chrome.runtime.onMessage.removeListener(onRuntimeMessage);
      } catch {
        // 런타임 무효화 시 리스너 분리 실패 무시
      }
    }
    if (globalBag.__SOUND_MANAGER_BRIDGE__ === instance) {
      delete globalBag.__SOUND_MANAGER_BRIDGE__;
    }
    delete globalBag.__SOUND_MANAGER_BRIDGE_ACTIVE__;
  };

  const instance: ContentBridgeInstance = {
    buildId,
    isAlive,
    dispose,
  };

  globalBag.__SOUND_MANAGER_BRIDGE__ = instance;
  globalBag.__SOUND_MANAGER_BRIDGE_ACTIVE__ = true;

  // 브리지 준비 직후 MAIN 훅에 초기 상태 보고 요청
  sendToHook({ type: "REQUEST_REPORT" });

  return instance;
}

if (
  typeof window !== "undefined" &&
  typeof chrome !== "undefined" &&
  chrome.runtime?.id &&
  !(window as unknown as Record<string, unknown>).__SOUND_MANAGER_SKIP_AUTO_BRIDGE__
) {
  installContentBridge();
}
