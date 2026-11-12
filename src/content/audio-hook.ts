import { dbToRatio, linearToDb } from "../shared/mixer-math";
import {
  BRIDGE_TO_HOOK_EVENT,
  HOOK_TO_BRIDGE_EVENT,
  type FrameMediaPayload,
  type HookCommand,
  type HookReportEvent,
} from "../shared/types";
import { createDspChain, DEFAULT_DSP_CONFIG } from "./dsp-chain";
import {
  bindElementEventsOnce,
  ensureSharedContext,
  getOrCreateHookState,
  HOOK_CONTROLLER_KEY,
  installMediaPrototypePatchesOnce,
  isElementCorsOrDrmRestricted,
  readSiteVolume,
  resolveHookBuildId,
  writeRawVolume,
  type HookDelegates,
} from "./hook-state";
import { installPageWebAudioPatchOnce } from "./webaudio-patch";

/**
 * 페이지 MAIN 월드에서 실행되는 무중단 교체형 오디오 제어 엔진 (chrome.tabCapture 미사용).
 * - 확장 리로드 또는 버전 업데이트 시 기존 WebAudio 그래프와 미디어 상태를 보존한 채 컨트롤러만 핫스왑한다.
 * - 동일 출처 / MSE(blob:) 미디어: WebAudio DSP 체인(노멀라이저·게이트·컴프레서·페이더·패닝·안전 리미터) 제어
 * - 교차 출처(CORS 미허용) / EME(DRM) / MediaStream(srcObject): 네이티브 volume(0..1, 0dB 상한) 폴백
 * - 순수 WebAudio 앱(AudioContext.destination 직결): 목적지 앞단에 동일한 DSP 체인을 삽입해 제어
 */

const METER_INTERVAL_MS = 75;

export interface InstallAudioHookOptions {
  buildId?: string;
}

export interface AudioHookController {
  readonly buildId: string;
  dispatchCommand: (cmd: HookCommand) => void;
  registerElement: (el: HTMLMediaElement) => void;
  getSnapshot: () => FrameMediaPayload;
  stepTick: () => void;
  dispose: () => void;
}

function hasMediaSource(el: HTMLMediaElement): boolean {
  const anyEl = el as unknown as { srcObject?: unknown };
  return Boolean(el.currentSrc || el.getAttribute("src") || anyEl.srcObject);
}

export function installAudioHook(
  win: Window & typeof globalThis,
  options?: InstallAudioHookOptions,
): AudioHookController {
  const buildId = resolveHookBuildId(options?.buildId);
  const globalBag = win as unknown as Record<string, unknown>;
  const existing = globalBag[HOOK_CONTROLLER_KEY] as Partial<AudioHookController> | undefined;

  // 동일 빌드 재실행 시 기존 컨트롤러를 재사용하고 상태 보고만 즉시 전송
  if (existing && existing.buildId === buildId && typeof existing.dispatchCommand === "function") {
    existing.dispatchCommand({ type: "REQUEST_REPORT" });
    return existing as AudioHookController;
  }

  // 빌드가 다르거나 식별자가 없는 구버전 컨트롤러는 리스너와 타이머만 분리
  if (existing) {
    try {
      existing.dispose?.();
    } catch {
      // 구 컨트롤러 분리 예외 무시
    }
  }

  let meterTimer: ReturnType<typeof setInterval> | null = null;
  let reportTimer: ReturnType<typeof setTimeout> | null = null;
  let domReadyPending = false;

  const delegates: HookDelegates = {
    registerElement: (el) => registerElement(el),
    syncElementGain: (el) => syncElementGain(el),
    onElementEncrypted: (el) => {
      state.encryptedElements.add(el);
      syncElementGain(el);
      scheduleReport();
    },
    onElementPlay: (el) => {
      state.lastActiveElements.delete(el);
      state.lastActiveElements.add(el);
      syncElementGain(el);
      updateProcessingLoop();
      scheduleReport();
    },
    onElementStateChange: (el) => {
      syncElementGain(el);
      scheduleReport();
    },
    onElementTrackChange: (el) => {
      state.hookedEntries.get(el)?.dspChain.notifyTrackTransition();
      syncElementGain(el);
      scheduleReport();
    },
    getTargetGain: () => state.targetGain,
    getDspConfig: () => state.currentDsp,
    onActivityChange: () => scheduleReport(),
  };

  const state = getOrCreateHookState(win, delegates);

  function emitToBridge(evt: HookReportEvent): void {
    try {
      win.document.dispatchEvent(
        new win.CustomEvent(HOOK_TO_BRIDGE_EVENT, { detail: JSON.stringify(evt) }),
      );
    } catch {
      // 언로드 중 전송 실패 무시
    }
  }

  function tryAttachWebAudioToElement(el: HTMLMediaElement): boolean {
    if (state.hookedEntries.has(el)) return true;
    if (isElementCorsOrDrmRestricted(state, win, el)) return false;
    const src = el.currentSrc || el.getAttribute("src") || "";
    if (!src) return false;

    const ctx = ensureSharedContext(state);
    if (!ctx) return false;

    try {
      const source = ctx.createMediaElementSource(el);
      const dspChain = createDspChain(ctx, state.targetGain, state.currentDsp, state.internalBypassNodes);
      source.connect(dspChain.inputNode);
      state.hookedEntries.set(el, { sourceNode: source, dspChain });
      if (ctx.state === "suspended" && !el.paused) {
        void ctx.resume().catch(() => {});
      }
      return true;
    } catch {
      state.failedWebAudioElements.add(el);
      return false;
    }
  }

  function syncElementGain(el: HTMLMediaElement): void {
    const siteVol = readSiteVolume(state, el);
    if (!el.paused && !state.hookedEntries.has(el)) {
      tryAttachWebAudioToElement(el);
    }
    const entry = state.hookedEntries.get(el);
    if (entry && state.sharedCtx) {
      writeRawVolume(state, el, siteVol);
      if (!el.paused && state.sharedCtx.state === "suspended") {
        void state.sharedCtx.resume().catch(() => {});
      }
      entry.dspChain.applyFaderGain(state.targetGain);
      entry.dspChain.syncStaticDsp(state.currentDsp);
    } else {
      const clampedGain = Math.max(0, Math.min(1, state.targetGain));
      writeRawVolume(state, el, siteVol * clampedGain);
    }
  }

  function syncAllGains(): void {
    for (const el of state.trackedElements) syncElementGain(el);
    for (const wc of state.pageContexts) {
      if (wc.ctx.state !== "closed") wc.dspChain.applyFaderGain(state.targetGain);
    }
  }

  function syncAllDsp(): void {
    for (const el of state.trackedElements) {
      state.hookedEntries.get(el)?.dspChain.syncStaticDsp(state.currentDsp);
    }
    for (const wc of state.pageContexts) {
      if (wc.ctx.state !== "closed") wc.dspChain.syncStaticDsp(state.currentDsp);
    }
    if (!state.currentDsp.normActive) state.lastNormTrimDb = 0;
  }

  function pruneStaleElements(): void {
    if (state.trackedElements.size <= 24) return;
    for (const el of state.trackedElements) {
      if (!el.isConnected && el.paused && !hasMediaSource(el) && !state.hookedEntries.has(el)) {
        state.trackedElements.delete(el);
        state.lastActiveElements.delete(el);
      }
    }
  }

  function registerElement(el: HTMLMediaElement): void {
    if (!el) return;
    const alreadyTracked = state.trackedElements.has(el);
    if (!alreadyTracked) {
      pruneStaleElements();
      state.trackedElements.add(el);
      readSiteVolume(state, el);
    }
    bindElementEventsOnce(state, el);
    if (!alreadyTracked) {
      syncElementGain(el);
      scheduleReport();
    }
  }

  function runAudioTick(): void {
    let maxRatio = 0;
    let activeTrimDb = 0;
    let hasActiveChain = false;

    for (const el of state.trackedElements) {
      const isPlaying = !el.paused && !el.ended && !el.muted;
      const entry = state.hookedEntries.get(el);
      if (entry) {
        const trim = entry.dspChain.tickDynamicDsp(state.currentDsp, isPlaying);
        if (isPlaying || !hasActiveChain) {
          activeTrimDb = trim;
          hasActiveChain = isPlaying || hasActiveChain;
        }
        if (state.meteringActive && isPlaying && state.targetGain > 0) {
          const r = entry.dspChain.readPostVuRatio();
          if (r > maxRatio) maxRatio = r;
        }
      } else if (state.meteringActive && isPlaying && state.targetGain > 0) {
        const effVol = readSiteVolume(state, el) * Math.min(1, state.targetGain);
        if (effVol > 0) {
          const jitter = 0.88 + Math.random() * 0.2;
          const approxRatio = dbToRatio(linearToDb(effVol * 0.65 * jitter));
          if (approxRatio > maxRatio) maxRatio = approxRatio;
        }
      }
    }

    for (const wc of state.pageContexts) {
      if (wc.ctx.state === "closed" || !wc.hasConnectedNodes) continue;
      const isPlaying = wc.ctx.state === "running";
      const trim = wc.dspChain.tickDynamicDsp(state.currentDsp, isPlaying);
      if (isPlaying || !hasActiveChain) {
        activeTrimDb = trim;
        hasActiveChain = isPlaying || hasActiveChain;
      }
      if (state.meteringActive && isPlaying && state.targetGain > 0) {
        const r = wc.dspChain.readPostVuRatio();
        if (r > maxRatio) maxRatio = r;
      }
    }

    state.lastNormTrimDb = state.currentDsp.normActive ? activeTrimDb : 0;

    if (state.meteringActive) {
      const instant = Math.max(0, Math.min(1, maxRatio));
      state.vuCur =
        instant > state.vuCur ? state.vuCur + (instant - state.vuCur) * 0.62 : Math.max(0, state.vuCur - 0.05);
      state.vuPeak = state.vuCur >= state.vuPeak ? state.vuCur : Math.max(state.vuCur, state.vuPeak - 0.015);
      emitToBridge({
        type: "VU_TICK",
        vuLevel: Math.round(state.vuCur * 1000) / 1000,
        vuPeak: Math.round(state.vuPeak * 1000) / 1000,
        normTrimDb: state.lastNormTrimDb,
      });
    }
  }

  function updateProcessingLoop(): void {
    const needsLoop =
      state.meteringActive || state.currentDsp.normActive || state.currentDsp.gateEnabled;
    if (needsLoop && !meterTimer) {
      meterTimer = setInterval(runAudioTick, METER_INTERVAL_MS);
    } else if (!needsLoop && meterTimer) {
      clearInterval(meterTimer);
      meterTimer = null;
      state.vuCur = 0;
      state.vuPeak = 0;
    }
  }

  function buildSnapshot(): FrameMediaPayload {
    let mediaPlayingCount = 0;
    let mediaPausedCount = 0;
    let corsRestricted = false;

    for (const el of state.trackedElements) {
      const hasSource = hasMediaSource(el);
      if (!hasSource && el.readyState === 0) continue;

      if (!el.paused && !el.ended) {
        mediaPlayingCount++;
      } else if (hasSource && (el.currentTime > 0 || el.readyState >= 1 || state.lastActiveElements.has(el))) {
        mediaPausedCount++;
      }
      if (isElementCorsOrDrmRestricted(state, win, el) && !state.hookedEntries.has(el)) {
        corsRestricted = true;
      }
    }

    let playingCount = mediaPlayingCount;
    let pausedCount = mediaPausedCount;

    if (mediaPlayingCount + mediaPausedCount === 0) {
      for (const wc of state.pageContexts) {
        if (wc.ctx.state === "closed" || !wc.hasConnectedNodes) continue;
        if (wc.ctx.state === "running") playingCount++;
        else if (wc.ctx.state === "suspended") pausedCount++;
      }
    }

    const sessionTitle = win.navigator?.mediaSession?.metadata?.title?.trim() ?? "";
    return {
      hasMedia: playingCount + pausedCount > 0,
      playingCount,
      pausedCount,
      corsRestricted,
      mediaTitle: sessionTitle,
      vuLevel: state.vuCur,
      vuPeak: state.vuPeak,
      normTrimDb: state.lastNormTrimDb,
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
      for (const el of state.trackedElements) {
        if (!el.paused && !el.ended) {
          state.lastActiveElements.delete(el);
          state.lastActiveElements.add(el);
          el.pause();
          pausedAny = true;
        }
      }
      if (!pausedAny) {
        for (const wc of state.pageContexts) {
          if (wc.ctx.state === "running" && wc.hasConnectedNodes) {
            void wc.ctx.suspend().catch(() => {});
          }
        }
      }
      scheduleReport();
      return;
    }

    if (state.sharedCtx && state.sharedCtx.state === "suspended") void state.sharedCtx.resume().catch(() => {});
    for (const wc of state.pageContexts) {
      if (wc.ctx.state === "suspended" && wc.hasConnectedNodes) void wc.ctx.resume().catch(() => {});
    }

    for (const el of state.lastActiveElements) {
      if (!el.isConnected || !hasMediaSource(el)) state.lastActiveElements.delete(el);
    }

    const seenCandidates = new Set<HTMLMediaElement>();
    const candidates: HTMLMediaElement[] = [];
    const ordered = [...Array.from(state.lastActiveElements).reverse(), ...Array.from(state.trackedElements)];

    for (const el of ordered) {
      if (!seenCandidates.has(el) && el.isConnected && hasMediaSource(el)) {
        seenCandidates.add(el);
        candidates.push(el);
      }
    }

    function tryCandidate(idx: number): void {
      if (idx >= candidates.length) {
        scheduleReport();
        return;
      }
      const candidate = candidates[idx]!;
      try {
        const res = candidate.play();
        if (res && typeof res.then === "function") {
          res
            .then(() => {
              syncElementGain(candidate);
              scheduleReport();
            })
            .catch(() => tryCandidate(idx + 1));
        } else {
          syncElementGain(candidate);
          scheduleReport();
        }
      } catch {
        tryCandidate(idx + 1);
      }
    }

    if (candidates.length > 0) tryCandidate(0);
    scheduleReport();
  }

  function dispatchCommand(cmd: HookCommand): void {
    switch (cmd.type) {
      case "APPLY_GAIN":
        state.targetGain = Math.max(0, Number.isFinite(cmd.targetGain) ? cmd.targetGain : 1);
        syncAllGains();
        break;
      case "APPLY_DSP":
        state.currentDsp = { ...DEFAULT_DSP_CONFIG, ...cmd.dsp };
        syncAllDsp();
        updateProcessingLoop();
        break;
      case "SET_PLAYING":
        setFramePlaying(cmd.shouldPlay);
        break;
      case "TOGGLE_PLAY":
        setFramePlaying(buildSnapshot().playingCount === 0);
        break;
      case "SET_METERING":
        state.meteringActive = cmd.active;
        if (!state.meteringActive) {
          state.vuCur = 0;
          state.vuPeak = 0;
        }
        updateProcessingLoop();
        break;
      case "REQUEST_REPORT":
        emitToBridge({ type: "MEDIA_REPORT", payload: buildSnapshot() });
        break;
    }
  }

  installMediaPrototypePatchesOnce(win, state);
  installPageWebAudioPatchOnce(win, state);
  for (const el of state.trackedElements) bindElementEventsOnce(state, el);

  function scanNodeForMedia(root: ParentNode): void {
    root.querySelectorAll?.("video, audio").forEach((node) => {
      registerElement(node as HTMLMediaElement);
    });
  }

  if (win.document.documentElement) scanNodeForMedia(win.document);

  const observer = new win.MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node instanceof win.HTMLMediaElement) registerElement(node);
        else if (node instanceof win.Element) scanNodeForMedia(node);
      });
    }
  });

  const startObserving = (): void => {
    if (win.document.documentElement) {
      scanNodeForMedia(win.document);
      observer.observe(win.document.documentElement, { childList: true, subtree: true });
    }
  };
  const onDomReady = (): void => {
    domReadyPending = false;
    startObserving();
  };

  if (win.document.readyState === "loading") {
    domReadyPending = true;
    win.document.addEventListener("DOMContentLoaded", onDomReady, { once: true });
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

  syncAllGains();
  syncAllDsp();
  updateProcessingLoop();

  const controller: AudioHookController = {
    buildId,
    dispatchCommand,
    registerElement,
    getSnapshot: buildSnapshot,
    stepTick: runAudioTick,
    dispose: () => {
      if (meterTimer) {
        clearInterval(meterTimer);
        meterTimer = null;
      }
      if (reportTimer) {
        clearTimeout(reportTimer);
        reportTimer = null;
      }
      observer.disconnect();
      if (domReadyPending) {
        win.document.removeEventListener("DOMContentLoaded", onDomReady);
        domReadyPending = false;
      }
      win.document.removeEventListener(BRIDGE_TO_HOOK_EVENT, onBridgeEvent);
      if (globalBag[HOOK_CONTROLLER_KEY] === controller) {
        delete globalBag[HOOK_CONTROLLER_KEY];
      }
    },
  };

  globalBag[HOOK_CONTROLLER_KEY] = controller;
  scheduleReport();
  return controller;
}

if (
  typeof window !== "undefined" &&
  !(window as unknown as Record<string, unknown>).__SOUND_MANAGER_SKIP_AUTO_INSTALL__
) {
  installAudioHook(window);
}
