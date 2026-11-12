import { dbToRatio, linearToDb } from "../shared/mixer-math";
import {
  BRIDGE_TO_HOOK_EVENT,
  HOOK_TO_BRIDGE_EVENT,
  type DspConfigPayload,
  type FrameMediaPayload,
  type HookCommand,
  type HookReportEvent,
} from "../shared/types";
import { createDspChain, DEFAULT_DSP_CONFIG, type DspChainInstance } from "./dsp-chain";
import { installPageWebAudioPatch, type WrappedContextEntry } from "./webaudio-patch";

/**
 * 페이지 MAIN 월드에서 실행되는 비침습 오디오 제어 엔진 (chrome.tabCapture 미사용).
 * - 동일 출처 / MSE(blob:) 미디어: WebAudio DSP 체인(노멀라이저·게이트·컴프레서·페이더·패닝·안전 리미터) 제어
 * - 교차 출처(CORS 미허용) / EME(DRM) / MediaStream(srcObject): 소리 끊김을 막기 위해 네이티브 volume(0..1, 0dB 상한) 폴백
 * - 순수 WebAudio 앱(AudioContext.destination 직결): 목적지 앞단에 동일한 DSP 체인을 삽입해 제어
 */

const METER_INTERVAL_MS = 75;

interface ElementAudioEntry {
  dspChain: DspChainInstance;
}

export interface AudioHookController {
  dispatchCommand: (cmd: HookCommand) => void;
  registerElement: (el: HTMLMediaElement) => void;
  getSnapshot: () => FrameMediaPayload;
  stepTick: () => void;
  dispose: () => void;
}

export function installAudioHook(win: Window & typeof globalThis): AudioHookController {
  const globalBag = win as unknown as Record<string, unknown>;
  const existing = globalBag.__SOUND_MANAGER_CONTROLLER__ as AudioHookController | undefined;
  if (existing) {
    existing.dispatchCommand({ type: "REQUEST_REPORT" });
    return existing;
  }

  const MediaProto = win.HTMLMediaElement?.prototype;
  const volDesc = MediaProto ? Object.getOwnPropertyDescriptor(MediaProto, "volume") : undefined;
  const origVolGet = volDesc?.get;
  const origVolSet = volDesc?.set;

  let targetGain = 1.0;
  let currentDsp: DspConfigPayload = { ...DEFAULT_DSP_CONFIG };
  let meteringActive = false;
  let meterTimer: ReturnType<typeof setInterval> | null = null;
  let reportTimer: ReturnType<typeof setTimeout> | null = null;
  let vuCur = 0;
  let vuPeak = 0;
  let lastNormTrimDb = 0;
  let sharedCtx: AudioContext | null = null;

  const trackedElements = new Set<HTMLMediaElement>();
  const lastActiveElements = new Set<HTMLMediaElement>();
  const encryptedElements = new WeakSet<HTMLMediaElement>();
  const failedWebAudioElements = new WeakSet<HTMLMediaElement>();
  const siteVolumeMap = new WeakMap<HTMLMediaElement, number>();
  const hookedEntries = new WeakMap<HTMLMediaElement, ElementAudioEntry>();
  const internalContexts = new WeakSet<BaseAudioContext>();
  const internalBypassNodes = new WeakSet<AudioNode>();
  const pageContexts = new Set<WrappedContextEntry>();

  function emitToBridge(evt: HookReportEvent): void {
    try {
      win.document.dispatchEvent(
        new win.CustomEvent(HOOK_TO_BRIDGE_EVENT, { detail: JSON.stringify(evt) }),
      );
    } catch {
      // 페이지 언로드 중 이벤트 전달 실패는 무시
    }
  }

  function readSiteVolume(el: HTMLMediaElement): number {
    const saved = siteVolumeMap.get(el);
    if (typeof saved === "number") return saved;
    const initial = origVolGet ? origVolGet.call(el) : el.volume;
    const clamped = Math.max(0, Math.min(1, Number.isFinite(initial) ? initial : 1));
    siteVolumeMap.set(el, clamped);
    return clamped;
  }

  function writeRawVolume(el: HTMLMediaElement, val: number): void {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(val) ? val : 1));
    if (origVolSet) {
      origVolSet.call(el, clamped);
    }
  }

  function isElementCorsOrDrmRestricted(el: HTMLMediaElement): boolean {
    if (failedWebAudioElements.has(el) || encryptedElements.has(el)) return true;
    const anyEl = el as unknown as { mediaKeys?: unknown; srcObject?: unknown };
    if (anyEl.mediaKeys != null || anyEl.srcObject != null) return true;

    const src = el.currentSrc || el.getAttribute("src") || "";
    if (!src) return false;
    if (src.startsWith("blob:") || src.startsWith("data:")) return false;

    try {
      const parsed = new URL(src, win.location.href);
      if (parsed.origin === win.location.origin) return false;
      return el.crossOrigin === null || el.crossOrigin === "";
    } catch {
      return true;
    }
  }

  const OrigAudioCtx =
    win.AudioContext || (win as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  function ensureSharedContext(): AudioContext | null {
    if (sharedCtx && sharedCtx.state !== "closed") return sharedCtx;
    if (!OrigAudioCtx) return null;
    try {
      const ctx = new OrigAudioCtx();
      internalContexts.add(ctx);
      sharedCtx = ctx;
      return ctx;
    } catch {
      return null;
    }
  }

  function tryAttachWebAudioToElement(el: HTMLMediaElement): boolean {
    if (hookedEntries.has(el)) return true;
    if (isElementCorsOrDrmRestricted(el)) return false;
    const src = el.currentSrc || el.getAttribute("src") || "";
    if (!src) return false;

    const ctx = ensureSharedContext();
    if (!ctx) return false;

    try {
      const source = ctx.createMediaElementSource(el);
      const dspChain = createDspChain(ctx, targetGain, currentDsp, internalBypassNodes);
      source.connect(dspChain.inputNode);
      hookedEntries.set(el, { dspChain });
      if (ctx.state === "suspended" && !el.paused) {
        void ctx.resume().catch(() => {});
      }
      return true;
    } catch {
      // 이미 사이트 자체 AudioContext에 연결되었거나 보안 제약이 걸린 요소
      failedWebAudioElements.add(el);
      return false;
    }
  }

  function syncElementGain(el: HTMLMediaElement): void {
    const siteVol = readSiteVolume(el);
    if (!el.paused && !hookedEntries.has(el)) {
      tryAttachWebAudioToElement(el);
    }
    const entry = hookedEntries.get(el);
    if (entry && sharedCtx) {
      writeRawVolume(el, siteVol);
      if (!el.paused && sharedCtx.state === "suspended") {
        void sharedCtx.resume().catch(() => {});
      }
      entry.dspChain.applyFaderGain(targetGain);
      entry.dspChain.syncStaticDsp(currentDsp);
    } else {
      // 네이티브 폴백: 증폭(>1.0)은 1.0(0dB)으로 상한 고정, 감쇠·음소거는 그대로 적용
      const clampedGain = Math.max(0, Math.min(1, targetGain));
      writeRawVolume(el, siteVol * clampedGain);
    }
  }

  function syncAllGains(): void {
    for (const el of trackedElements) {
      syncElementGain(el);
    }
    for (const wc of pageContexts) {
      if (wc.ctx.state !== "closed") {
        wc.dspChain.applyFaderGain(targetGain);
      }
    }
  }

  function syncAllDsp(): void {
    for (const el of trackedElements) {
      hookedEntries.get(el)?.dspChain.syncStaticDsp(currentDsp);
    }
    for (const wc of pageContexts) {
      if (wc.ctx.state !== "closed") {
        wc.dspChain.syncStaticDsp(currentDsp);
      }
    }
    if (!currentDsp.normActive) {
      lastNormTrimDb = 0;
    }
  }

  function pruneStaleElements(): void {
    if (trackedElements.size <= 24) return;
    for (const el of trackedElements) {
      const src = el.currentSrc || el.getAttribute("src") || "";
      if (!el.isConnected && el.paused && !src && !hookedEntries.has(el)) {
        trackedElements.delete(el);
        lastActiveElements.delete(el);
      }
    }
  }

  function registerElement(el: HTMLMediaElement): void {
    if (!el || trackedElements.has(el)) return;
    pruneStaleElements();
    trackedElements.add(el);
    readSiteVolume(el);

    const onEncrypted = (): void => {
      encryptedElements.add(el);
      syncElementGain(el);
      scheduleReport();
    };
    const onPlay = (): void => {
      lastActiveElements.add(el);
      syncElementGain(el);
      updateProcessingLoop();
      scheduleReport();
    };
    const onStateChange = (): void => {
      syncElementGain(el);
      scheduleReport();
    };
    const onTrackChange = (): void => {
      hookedEntries.get(el)?.dspChain.notifyTrackTransition();
      syncElementGain(el);
      scheduleReport();
    };

    el.addEventListener("encrypted", onEncrypted, { passive: true });
    el.addEventListener("play", onPlay, { passive: true });
    el.addEventListener("playing", onPlay, { passive: true });
    el.addEventListener("pause", onStateChange, { passive: true });
    el.addEventListener("ended", onStateChange, { passive: true });
    el.addEventListener("loadedmetadata", onTrackChange, { passive: true });
    el.addEventListener("durationchange", onTrackChange, { passive: true });
    el.addEventListener("emptied", onTrackChange, { passive: true });

    syncElementGain(el);
    scheduleReport();
  }

  function runAudioTick(): void {
    let maxRatio = 0;
    let activeTrimDb = 0;
    let hasActiveChain = false;

    for (const el of trackedElements) {
      const isPlaying = !el.paused && !el.ended && !el.muted;
      const entry = hookedEntries.get(el);
      if (entry) {
        const trim = entry.dspChain.tickDynamicDsp(currentDsp, isPlaying);
        if (isPlaying || !hasActiveChain) {
          activeTrimDb = trim;
          hasActiveChain = isPlaying || hasActiveChain;
        }
        if (meteringActive && isPlaying && targetGain > 0) {
          const r = entry.dspChain.readPostVuRatio();
          if (r > maxRatio) maxRatio = r;
        }
      } else if (meteringActive && isPlaying && targetGain > 0) {
        const effVol = readSiteVolume(el) * Math.min(1, targetGain);
        if (effVol > 0) {
          const jitter = 0.88 + Math.random() * 0.2;
          const approxRatio = dbToRatio(linearToDb(effVol * 0.65 * jitter));
          if (approxRatio > maxRatio) maxRatio = approxRatio;
        }
      }
    }

    for (const wc of pageContexts) {
      if (wc.ctx.state === "closed" || !wc.hasConnectedNodes) continue;
      const isPlaying = wc.ctx.state === "running";
      const trim = wc.dspChain.tickDynamicDsp(currentDsp, isPlaying);
      if (isPlaying || !hasActiveChain) {
        activeTrimDb = trim;
        hasActiveChain = isPlaying || hasActiveChain;
      }
      if (meteringActive && isPlaying && targetGain > 0) {
        const r = wc.dspChain.readPostVuRatio();
        if (r > maxRatio) maxRatio = r;
      }
    }

    lastNormTrimDb = currentDsp.normActive ? activeTrimDb : 0;

    if (meteringActive) {
      const instant = Math.max(0, Math.min(1, maxRatio));
      vuCur = instant > vuCur ? vuCur + (instant - vuCur) * 0.62 : Math.max(0, vuCur - 0.05);
      vuPeak = vuCur >= vuPeak ? vuCur : Math.max(vuCur, vuPeak - 0.015);
      emitToBridge({
        type: "VU_TICK",
        vuLevel: Math.round(vuCur * 1000) / 1000,
        vuPeak: Math.round(vuPeak * 1000) / 1000,
        normTrimDb: lastNormTrimDb,
      });
    }
  }

  /**
   * 팝업이 닫혀 있어도(meteringActive === false) 노멀라이저나 노이즈 게이트가 켜져 있으면
   * 페이지 내부에서만 경량 DSP 루프를 유지하고 브리지 IPC 전송은 생략한다.
   */
  function updateProcessingLoop(): void {
    const needsLoop = meteringActive || currentDsp.normActive || currentDsp.gateEnabled;
    if (needsLoop && !meterTimer) {
      meterTimer = setInterval(runAudioTick, METER_INTERVAL_MS);
    } else if (!needsLoop && meterTimer) {
      clearInterval(meterTimer);
      meterTimer = null;
      vuCur = 0;
      vuPeak = 0;
    }
  }

  function buildSnapshot(): FrameMediaPayload {
    let playingCount = 0;
    let pausedCount = 0;
    let corsRestricted = false;

    for (const el of trackedElements) {
      const src = el.currentSrc || el.getAttribute("src") || "";
      const hasSource = Boolean(src || (el as unknown as { srcObject?: unknown }).srcObject);
      if (!hasSource && el.readyState === 0) continue;

      if (!el.paused && !el.ended) {
        playingCount++;
      } else if (hasSource && (el.currentTime > 0 || el.readyState >= 1 || lastActiveElements.has(el))) {
        pausedCount++;
      }
      if (isElementCorsOrDrmRestricted(el) && !hookedEntries.has(el)) {
        corsRestricted = true;
      }
    }

    for (const wc of pageContexts) {
      if (wc.ctx.state === "closed" || !wc.hasConnectedNodes) continue;
      if (wc.ctx.state === "running") playingCount++;
      else if (wc.ctx.state === "suspended") pausedCount++;
    }

    const sessionTitle = win.navigator?.mediaSession?.metadata?.title?.trim() ?? "";
    return {
      hasMedia: playingCount + pausedCount > 0,
      playingCount,
      pausedCount,
      corsRestricted,
      mediaTitle: sessionTitle,
      vuLevel: vuCur,
      vuPeak,
      normTrimDb: lastNormTrimDb,
    };
  }

  function scheduleReport(): void {
    if (reportTimer) return;
    reportTimer = setTimeout(() => {
      reportTimer = null;
      emitToBridge({ type: "MEDIA_REPORT", payload: buildSnapshot() });
    }, 30);
  }

  function setFramePlaying(shouldPlay: boolean): void {
    if (!shouldPlay) {
      let pausedAny = false;
      for (const el of trackedElements) {
        if (!el.paused && !el.ended) {
          lastActiveElements.add(el);
          el.pause();
          pausedAny = true;
        }
      }
      if (!pausedAny) {
        for (const wc of pageContexts) {
          if (wc.ctx.state === "running" && wc.hasConnectedNodes) {
            void wc.ctx.suspend().catch(() => {});
          }
        }
      }
      scheduleReport();
      return;
    }

    const candidates =
      lastActiveElements.size > 0
        ? Array.from(lastActiveElements).filter((el) => trackedElements.has(el))
        : Array.from(trackedElements).filter((el) => Boolean(el.currentSrc || el.getAttribute("src")));

    const primary = candidates[0];
    if (primary) {
      void primary.play().catch(() => {});
    } else {
      for (const wc of pageContexts) {
        if (wc.ctx.state === "suspended" && wc.hasConnectedNodes) {
          void wc.ctx.resume().catch(() => {});
        }
      }
    }
    scheduleReport();
  }

  function dispatchCommand(cmd: HookCommand): void {
    switch (cmd.type) {
      case "APPLY_GAIN":
        targetGain = Math.max(0, Number.isFinite(cmd.targetGain) ? cmd.targetGain : 1);
        syncAllGains();
        break;
      case "APPLY_DSP":
        currentDsp = { ...DEFAULT_DSP_CONFIG, ...cmd.dsp };
        syncAllDsp();
        updateProcessingLoop();
        break;
      case "SET_PLAYING":
        setFramePlaying(cmd.shouldPlay);
        break;
      case "TOGGLE_PLAY": {
        const snap = buildSnapshot();
        setFramePlaying(snap.playingCount === 0);
        break;
      }
      case "SET_METERING":
        meteringActive = cmd.active;
        if (!meteringActive) {
          vuCur = 0;
          vuPeak = 0;
        }
        updateProcessingLoop();
        break;
      case "REQUEST_REPORT":
        emitToBridge({ type: "MEDIA_REPORT", payload: buildSnapshot() });
        break;
    }
  }

  if (MediaProto && origVolGet && origVolSet) {
    const origPlay = MediaProto.play;
    MediaProto.play = function patchedPlay(this: HTMLMediaElement): Promise<void> {
      registerElement(this);
      lastActiveElements.add(this);
      syncElementGain(this);
      return origPlay.call(this);
    };

    Object.defineProperty(MediaProto, "volume", {
      configurable: true,
      enumerable: true,
      get(this: HTMLMediaElement): number {
        return readSiteVolume(this);
      },
      set(this: HTMLMediaElement, nextVal: number): void {
        const clamped = Math.max(0, Math.min(1, Number(nextVal)));
        if (!Number.isFinite(clamped)) return;
        siteVolumeMap.set(this, clamped);
        registerElement(this);
        syncElementGain(this);
      },
    });
  }

  installPageWebAudioPatch({
    win,
    OrigAudioCtx,
    internalContexts,
    internalBypassNodes,
    pageContexts,
    getTargetGain: () => targetGain,
    getDspConfig: () => currentDsp,
    onActivityChange: scheduleReport,
  });

  function scanNodeForMedia(root: ParentNode): void {
    root.querySelectorAll?.("video, audio").forEach((node) => {
      registerElement(node as HTMLMediaElement);
    });
  }

  if (win.document.documentElement) {
    scanNodeForMedia(win.document);
  }
  const observer = new win.MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node instanceof win.HTMLMediaElement) {
          registerElement(node);
        } else if (node instanceof win.Element) {
          scanNodeForMedia(node);
        }
      });
    }
  });
  const startObserving = (): void => {
    if (win.document.documentElement) {
      scanNodeForMedia(win.document);
      observer.observe(win.document.documentElement, { childList: true, subtree: true });
    }
  };
  if (win.document.readyState === "loading") {
    win.document.addEventListener("DOMContentLoaded", startObserving, { once: true });
  } else {
    startObserving();
  }

  const onBridgeEvent = (ev: Event): void => {
    const raw = (ev as CustomEvent<string>).detail;
    if (typeof raw !== "string") return;
    try {
      dispatchCommand(JSON.parse(raw) as HookCommand);
    } catch {
      // 잘못된 메시지 무시
    }
  };
  win.document.addEventListener(BRIDGE_TO_HOOK_EVENT, onBridgeEvent);

  const controller: AudioHookController = {
    dispatchCommand,
    registerElement,
    getSnapshot: buildSnapshot,
    stepTick: runAudioTick,
    dispose: () => {
      if (meterTimer) clearInterval(meterTimer);
      if (reportTimer) clearTimeout(reportTimer);
      observer.disconnect();
      win.document.removeEventListener(BRIDGE_TO_HOOK_EVENT, onBridgeEvent);
      delete globalBag.__SOUND_MANAGER_CONTROLLER__;
    },
  };
  globalBag.__SOUND_MANAGER_CONTROLLER__ = controller;
  scheduleReport();
  return controller;
}

if (typeof window !== "undefined" && !(window as unknown as Record<string, unknown>).__SOUND_MANAGER_SKIP_AUTO_INSTALL__) {
  installAudioHook(window);
}
