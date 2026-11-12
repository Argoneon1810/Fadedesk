import {
  AUTO_NORM_PRESET_META, clampAlpha, clampDb, formatDb, getFocusDimDb,
  isChannelPinned, sanitizeChannelFx, toggleExclusiveFlags, type MixerContextInput,
} from "../shared/mixer-math";
import { DEFAULT_SETTINGS, PALETTES } from "../shared/palettes";
import {
  POPUP_PORT_NAME, type AutoNormPreset, type BgToPopupPortMessage, type ChannelFxState,
  type ConsoleSnapshot, type ModePref, type PopupActionMessage,
  type TabChannelState, type ThemeKey, type ThemeTokens,
} from "../shared/types";
import { isChannelReorderDragging, startChannelReorderDrag } from "./drag-reorder";
import { buildFxRackDom, syncFxRackDom, syncFxRackTrimBadge, type FxRackRefs } from "./fx-rack-view";
import { buildHelpModalDom, syncHelpModalDom, type HelpModalRefs } from "./help-modal";
import { ICONS } from "./icons";
import { buildMasterStripDom, syncMasterStripDom, updateMasterBusVu, type MasterStripRefs } from "./master-view";
import { renderNormPopoverDom } from "./norm-popover";
import { initViewModeAndPopout } from "./popout-window";
import {
  attachKnobDrag, buildChannelStripDom, paintLedColumn,
  syncChannelReadoutSub, syncChannelStripDom,
  type ChannelStripRefs, type StripCallbacks,
} from "./strip-view";
import { renderThemePopoverDom } from "./theme-popover";
import { buildTourOverlayDom, createDemoTourChannels, type TourOverlayRefs } from "./tour-overlay";

/**
 * 팝업 최상위 오케스트레이터.
 * 백그라운드 포트 동기화, 채널 드래그 재배치, 2계층 노멀라이저(3종 프리셋)·고급 FX 랙·실화면 투어 제어.
 */

let snapshot: ConsoleSnapshot = { settings: { ...DEFAULT_SETTINGS, domainDefaults: {} }, channels: [] };
let popoverOpen = false, normPopoverOpen = false, helpOpen = false;
let initialOnboardingChecked = false;
let tourDemoActive = false;
let demoChannels: TabChannelState[] = [];
let selectedTabId: number | null = null;
let toastText = "";
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let port: chrome.runtime.Port | null = null;

const stripMap = new Map<number, ChannelStripRefs>();
const pauseDivider = document.createElement("div");
pauseDivider.className = "pause-divider";

const emptyBay = document.createElement("div");
emptyBay.className = "empty-bay";
emptyBay.innerHTML = `<div class="empty-icon">${ICONS.consoleEmpty}</div><div class="empty-title">활성 미디어 탭이 없습니다</div><div class="empty-desc">유튜브·스트리밍·음악 사이트에서 미디어를 재생하면 채널 스트립이 이 자리에 자동으로 정렬됩니다.</div>`;

let masterRefs!: MasterStripRefs, fxRackRefs!: FxRackRefs, helpRefs!: HelpModalRefs, tourRefs!: TourOverlayRefs;

function resolvedMode(): "dark" | "light" {
  const pref = snapshot.settings.modePref;
  if (pref !== "system") return pref;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

const currentTokens = (): ThemeTokens => PALETTES[snapshot.settings.theme][resolvedMode()];

const activeChannels = (): TabChannelState[] =>
  tourDemoActive && snapshot.channels.length === 0 ? demoChannels : snapshot.channels;

const findChannel = (tabId: number): TabChannelState | undefined =>
  activeChannels().find((c) => c.tabId === tabId);

function sendAction(msg: PopupActionMessage): void {
  try {
    if (port) { port.postMessage(msg); return; }
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      void chrome.runtime.sendMessage(msg).catch(() => {});
    }
  } catch {}
}

function markOnboardingDone(): void {
  if (snapshot.settings.onboardingDone) return;
  snapshot.settings.onboardingDone = true;
  sendAction({ source: "popup", type: "COMPLETE_ONBOARDING" });
}

function flashToast(text: string): void {
  toastText = text;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastText = ""; renderAll(); }, 1600);
  renderAll();
}

function renderThemePopover(t: ThemeTokens, isDark: boolean): void {
  renderThemePopoverDom(snapshot.settings, popoverOpen, isDark, t, (theme: ThemeKey, modePref: ModePref) => {
    snapshot.settings.theme = theme;
    snapshot.settings.modePref = modePref;
    sendAction({ source: "popup", type: "SET_THEME", theme, modePref });
    renderAll();
  });
}

function reconcileChannelStrips(callbacks: StripCallbacks): void {
  if (isChannelReorderDragging()) return;
  const scrollRow = document.getElementById("channels-scroll")!;
  const channels = activeChannels();
  const liveIds = new Set(channels.map((c) => c.tabId));

  for (const [tabId, ref] of stripMap.entries()) {
    if (!liveIds.has(tabId)) { ref.el.remove(); stripMap.delete(tabId); }
  }
  if (selectedTabId !== null && !liveIds.has(selectedTabId)) {
    selectedTabId = channels[0]?.tabId ?? null;
  }
  if (channels.length === 0) {
    pauseDivider.remove();
    if (!emptyBay.isConnected) scrollRow.appendChild(emptyBay);
    return;
  }
  emptyBay.remove();

  for (const ch of channels) {
    if (!stripMap.has(ch.tabId)) {
      stripMap.set(ch.tabId, buildChannelStripDom(ch, () => findChannel(ch.tabId), callbacks));
    }
  }

  const playing = channels.filter((c) => c.playing);
  const paused = channels.filter((c) => !c.playing);
  const desiredNodes: HTMLElement[] = [];
  for (const ch of playing) desiredNodes.push(stripMap.get(ch.tabId)!.el);
  if (playing.length > 0 && paused.length > 0) desiredNodes.push(pauseDivider);
  for (const ch of paused) desiredNodes.push(stripMap.get(ch.tabId)!.el);
  if (playing.length === 0 || paused.length === 0) pauseDivider.remove();

  desiredNodes.forEach((node, idx) => {
    const currentAtIdx = scrollRow.children[idx];
    if (currentAtIdx !== node) scrollRow.insertBefore(node, currentAtIdx ?? null);
  });
}

function renderAll(): void {
  const mode = resolvedMode();
  const isDark = mode === "dark";
  const t = PALETTES[snapshot.settings.theme][mode];
  const root = document.getElementById("console-root")!;
  const tourActive = Boolean(tourRefs?.isActive());
  root.dataset.dark = String(isDark);
  root.dataset.helpOpen = String(helpOpen);
  root.dataset.tourOpen = String(tourActive);
  root.dataset.fxOpen = String(snapshot.settings.advRackOpen);

  const vars: Record<string, string> = {
    "--c-bg": t.bg, "--c-surface": t.surface, "--c-raised": t.raised,
    "--c-border": t.border, "--c-text": t.text, "--c-muted": t.muted,
    "--c-primary": t.primary, "--c-on-primary": t.onPrimary, "--c-accent": t.accent,
  };
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
    document.documentElement.style.setProperty(k, v);
  }

  renderThemePopover(t, isDark);
  renderNormPopoverDom(snapshot.settings, normPopoverOpen, t, (preset: AutoNormPreset) => {
    snapshot.settings.autoNormPreset = preset;
    snapshot.settings.autoNormEnabled = true;
    normPopoverOpen = false;
    sendAction({ source: "popup", type: "SET_AUTO_NORM_PRESET", preset, enable: true });
    flashToast(`균일 N: ${AUTO_NORM_PRESET_META[preset].shortLabel} 프리셋 적용`);
  });

  const channels = activeChannels();
  const playingCount = channels.filter((c) => c.playing).length;
  const pausedCount = channels.length - playingCount;
  const anySolo = channels.some((c) => c.solo);
  const anyFocus = channels.some((c) => c.focus);

  const statusPill = document.getElementById("status-pill")!, statusDot = document.getElementById("status-dot")!;
  const statusText = document.getElementById("status-text")!;
  statusPill.style.borderColor = toastText ? t.primary : t.border;
  statusDot.style.backgroundColor = toastText
    ? t.primary : anySolo ? t.accent : playingCount > 0 ? t.states.success : t.muted;
  statusText.textContent = toastText || `재생 ${playingCount} · 대기 ${pausedCount}`;
  statusText.title = statusText.textContent;
  statusText.style.color = toastText ? t.primary : t.muted;

  const alphaBox = document.getElementById("alpha-box")!, alphaLabel = document.getElementById("alpha-label")!;
  const alphaFill = document.getElementById("alpha-fill")!, alphaThumb = document.getElementById("alpha-thumb")!;
  const alphaReadout = document.getElementById("alpha-readout")!;
  const resetModesBtn = document.getElementById("reset-modes-btn") as HTMLButtonElement;
  alphaBox.style.borderColor = anyFocus ? t.primary : t.border;
  alphaLabel.style.color = anyFocus ? t.primary : t.muted;
  alphaFill.style.width = `${snapshot.settings.alpha * 100}%`;
  alphaFill.style.backgroundColor = t.primary;
  alphaThumb.style.left = `calc(${snapshot.settings.alpha * 100}% - 5px)`;
  alphaThumb.style.borderColor = t.primary;

  const dim = getFocusDimDb(snapshot.settings.alpha);
  alphaReadout.textContent = `${snapshot.settings.alpha.toFixed(2)} · ${
    Number.isFinite(dim) ? (dim === 0 ? "0dB" : `${dim.toFixed(0)}dB`) : "-∞"
  }`;
  resetModesBtn.disabled = !(anySolo || anyFocus);

  const advRackBtn = document.getElementById("adv-rack-btn");
  if (advRackBtn) {
    const on = snapshot.settings.advRackOpen;
    advRackBtn.textContent = on ? "고급 FX ◂" : "고급 FX ▸";
    advRackBtn.style.backgroundColor = on ? t.primary : t.raised;
    advRackBtn.style.color = on ? t.onPrimary : t.text;
    advRackBtn.style.borderColor = on ? t.primary : t.border;
    advRackBtn.style.fontWeight = on ? "700" : "500";
  }

  const helpBtn = document.getElementById("help-btn") as HTMLButtonElement | null;
  if (helpBtn) {
    helpBtn.setAttribute("aria-expanded", String(helpOpen));
    helpBtn.style.backgroundColor = helpOpen ? t.primary : t.raised;
    helpBtn.style.color = helpOpen ? t.onPrimary : t.primary;
    helpBtn.style.borderColor = helpOpen ? t.primary : t.border;
  }

  const popoutBtn = document.getElementById("popout-btn") as HTMLButtonElement | null;
  if (popoutBtn && !popoutBtn.classList.contains("hidden")) {
    popoutBtn.style.backgroundColor = t.raised;
    popoutBtn.style.color = t.primary;
    popoutBtn.style.borderColor = t.border;
  }

  reconcileChannelStrips(stripCallbacks);

  const ctx: MixerContextInput = {
    alpha: snapshot.settings.alpha,
    masterDb: snapshot.settings.masterDb,
    masterMuted: snapshot.settings.masterMuted,
    anySolo,
    anyFocus,
  };

  for (const ch of channels) {
    const refs = stripMap.get(ch.tabId);
    if (refs) syncChannelStripDom(refs, ch, snapshot.settings, ctx, selectedTabId === ch.tabId, t);
  }

  syncMasterStripDom(masterRefs, snapshot.settings, channels, t);
  updateMasterBusVu(masterRefs, snapshot.settings, channels, t);
  syncFxRackDom(fxRackRefs, findChannel(selectedTabId ?? 0) ?? channels[0], snapshot.settings, t);
  syncHelpModalDom(helpRefs, helpOpen, t);
  if (tourActive) {
    tourRefs.syncPosition(tourDemoActive && snapshot.channels.length === 0, t);
  }
}

const stripCallbacks: StripCallbacks = {
  onSelectChannel(tabId) {
    if (selectedTabId === tabId) return;
    selectedTabId = tabId;
    for (const [id, refs] of stripMap.entries()) {
      refs.el.dataset.selected = String(id === tabId);
    }
    const channels = activeChannels();
    syncFxRackDom(fxRackRefs, findChannel(selectedTabId) ?? channels[0], snapshot.settings, currentTokens());
  },
  onBeginDragChannel(ev, tabId) {
    if (tabId < 0) return;
    startChannelReorderDrag({
      ev, movedTabId: tabId, scrollRow: document.getElementById("channels-scroll")!, pauseDivider,
      getChannels: () => snapshot.channels, getTokens: () => currentTokens(),
      onSelectChannel: (id) => stripCallbacks.onSelectChannel(id),
      onCommitReorder: (movedTabId, targetZone, orderedPlayingIds, orderedPausedIds) => {
        const ch = findChannel(movedTabId);
        const wasPlaying = ch?.playing, nextPlaying = targetZone === "playing";
        if (ch) ch.playing = nextPlaying;
        const playChs = orderedPlayingIds.map((id) => findChannel(id)).filter((c): c is TabChannelState => !!c);
        const pauseChs = orderedPausedIds.map((id) => findChannel(id)).filter((c): c is TabChannelState => !!c);
        playChs.forEach((c) => { c.playing = true; });
        pauseChs.forEach((c) => { c.playing = false; });
        snapshot.channels = [...playChs, ...pauseChs];
        sendAction({ source: "popup", type: "REORDER_CHANNELS", movedTabId, targetZone, orderedPlayingIds, orderedPausedIds });
        if (wasPlaying !== undefined && wasPlaying !== nextPlaying) {
          flashToast(`${ch?.title ?? "채널"}: ${nextPlaying ? "재생 구역 이동 · 즉시 재생" : "일시정지 구역 이동 · 즉시 정지"}`);
        } else renderAll();
      },
      onCancel: () => renderAll(),
    });
  },
  onSetTabDb(tabId, db) {
    const ch = findChannel(tabId);
    if (!ch) return;
    ch.db = clampDb(db, ch.corsCap);
    if (tabId >= 0) sendAction({ source: "popup", type: "SET_TAB_DB", tabId, db: ch.db });
    renderAll();
  },
  onToggleMute(tabId) {
    const ch = findChannel(tabId);
    if (!ch) return;
    ch.muted = !ch.muted;
    if (tabId >= 0) sendAction({ source: "popup", type: "TOGGLE_TAB_MUTE", tabId });
    renderAll();
  },
  onToggleMode(tabId, mode, shiftKey) {
    toggleExclusiveFlags(activeChannels(), tabId, mode, shiftKey);
    if (tabId >= 0) sendAction({ source: "popup", type: "TOGGLE_TAB_MODE", tabId, mode, shiftKey });
    renderAll();
  },
  onTogglePlay(tabId) {
    const ch = findChannel(tabId);
    const shouldPlay = ch ? !ch.playing : undefined;
    if (ch && shouldPlay !== undefined) ch.playing = shouldPlay;
    if (tabId >= 0) sendAction({ source: "popup", type: "TOGGLE_TAB_PLAY", tabId, shouldPlay });
    renderAll();
  },
  onTogglePin(tabId, ch) {
    if (!ch.domain || tabId < 0) return;
    const wasPinned = isChannelPinned(snapshot.settings.domainDefaults, ch.domain, ch.db);
    if (wasPinned) {
      delete snapshot.settings.domainDefaults[ch.domain];
      flashToast(`${ch.shortHost} 기본 볼륨 해제`);
    } else {
      snapshot.settings.domainDefaults[ch.domain] = ch.db;
      flashToast(`${ch.shortHost} ${formatDb(ch.db)}dB 고정`);
    }
    sendAction({ source: "popup", type: "TOGGLE_DOMAIN_PIN", tabId });
  },
  onJumpToTab(tabId, windowId, title) {
    if (tabId < 0) return;
    flashToast(`탭 이동: ${title}`);
    sendAction({ source: "popup", type: "JUMP_TO_TAB", tabId, windowId });
  },
  onSetMasterDb(db) {
    snapshot.settings.masterDb = clampDb(db, false);
    sendAction({ source: "popup", type: "SET_MASTER_DB", masterDb: snapshot.settings.masterDb });
    renderAll();
  },
  onToggleMasterMute() {
    snapshot.settings.masterMuted = !snapshot.settings.masterMuted;
    sendAction({ source: "popup", type: "TOGGLE_MASTER_MUTE" });
    renderAll();
  },
  onToggleAllPlaying() {
    const channels = activeChannels();
    const shouldPlay = !channels.some((c) => c.playing);
    for (const ch of channels) ch.playing = shouldPlay;
    if (snapshot.channels.length > 0) sendAction({ source: "popup", type: "SET_ALL_PLAYING", shouldPlay });
    renderAll();
  },
  onRefreshUi() { renderAll(); },
};

function startSpotlightTour(): void {
  markOnboardingDone();
  helpOpen = false;
  popoverOpen = false;
  normPopoverOpen = false;
  if (snapshot.channels.length === 0) {
    demoChannels = createDemoTourChannels();
    tourDemoActive = true;
    selectedTabId = demoChannels[0]?.tabId ?? null;
  } else {
    tourDemoActive = false;
    demoChannels = [];
  }
  renderAll();
  tourRefs.start();
  renderAll();
}

function setupTopDeckAndKeyboard(): void {
  const alphaBox = document.getElementById("alpha-box")!, alphaThumb = document.getElementById("alpha-thumb")!, alphaTrack = document.getElementById("alpha-track")!;

  const applyAlpha = (next: number): void => {
    snapshot.settings.alpha = clampAlpha(next);
    sendAction({ source: "popup", type: "SET_ALPHA", alpha: snapshot.settings.alpha });
    renderAll();
  };

  alphaBox.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    applyAlpha(snapshot.settings.alpha + (ev.deltaY < 0 ? 0.05 : -0.05));
  }, { passive: false });
  attachKnobDrag(alphaThumb, alphaTrack, "x", (ratio) => applyAlpha(ratio), () => applyAlpha(0.7));

  const resetBtn = document.getElementById("reset-modes-btn");
  if (resetBtn) resetBtn.onclick = () => {
    for (const ch of activeChannels()) { ch.solo = false; ch.focus = false; }
    sendAction({ source: "popup", type: "CLEAR_MODES" });
    renderAll();
  };
  const autoNormBtn = document.getElementById("auto-norm-btn");
  if (autoNormBtn) autoNormBtn.onclick = () => {
    snapshot.settings.autoNormEnabled = !snapshot.settings.autoNormEnabled;
    sendAction({ source: "popup", type: "TOGGLE_AUTO_NORM" });
    renderAll();
  };

  const presetBtn = document.getElementById("auto-norm-preset-btn");
  const normPop = document.getElementById("norm-popover")!;
  if (presetBtn) {
    presetBtn.onclick = (ev) => {
      ev.stopPropagation();
      popoverOpen = false;
      helpOpen = false;
      normPopoverOpen = !normPopoverOpen;
      renderAll();
    };
  }
  normPop.onclick = (ev) => ev.stopPropagation();

  const advRackBtn = document.getElementById("adv-rack-btn");
  if (advRackBtn) advRackBtn.onclick = () => {
    snapshot.settings.advRackOpen = !snapshot.settings.advRackOpen;
    sendAction({ source: "popup", type: "SET_ADV_RACK_OPEN", open: snapshot.settings.advRackOpen });
    renderAll();
  };

  const dotBtn = document.getElementById("theme-dot-btn")!;
  const pop = document.getElementById("theme-popover")!;
  dotBtn.onclick = (ev) => {
    ev.stopPropagation();
    normPopoverOpen = false;
    if (!popoverOpen) helpOpen = false;
    popoverOpen = !popoverOpen;
    renderAll();
  };
  pop.onclick = (ev) => ev.stopPropagation();

  const helpBtn = document.getElementById("help-btn");
  if (helpBtn) {
    helpBtn.onclick = (ev) => {
      ev.stopPropagation();
      popoverOpen = false;
      normPopoverOpen = false;
      if (tourRefs.isActive()) {
        tourRefs.stop();
        tourDemoActive = false;
        demoChannels = [];
      }
      helpOpen = !helpOpen;
      if (!helpOpen) markOnboardingDone();
      renderAll();
    };
  }

  window.addEventListener("pointerdown", (ev) => {
    const target = ev.target as Node | null;
    if (popoverOpen && target && !pop.contains(target) && !dotBtn.contains(target)) {
      popoverOpen = false;
      renderAll();
    }
    if (normPopoverOpen && target && !normPop.contains(target) && !(presetBtn && presetBtn.contains(target))) {
      normPopoverOpen = false;
      renderAll();
    }
  });

  window.addEventListener("resize", () => {
    if (tourRefs?.isActive()) {
      tourRefs.syncPosition(tourDemoActive && snapshot.channels.length === 0, currentTokens());
    }
  });

  window.addEventListener("keydown", (ev) => {
    if (tourRefs?.isActive()) return;
    const activeTag = document.activeElement?.tagName;
    if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
    if (ev.key === "Escape") {
      if (helpOpen && helpRefs.isNestedPinned()) {
        ev.preventDefault();
        helpRefs.clearNestedPin();
        return;
      }
      if (helpOpen) {
        ev.preventDefault();
        markOnboardingDone();
        helpOpen = false;
        renderAll();
        return;
      }
      if (normPopoverOpen) {
        ev.preventDefault();
        normPopoverOpen = false;
        renderAll();
        return;
      }
      if (popoverOpen) {
        ev.preventDefault();
        popoverOpen = false;
        renderAll();
        return;
      }
    }
    if (helpOpen) return;
    const channels = activeChannels();
    if (channels.length === 0) return;

    if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
      ev.preventDefault();
      const idx = channels.findIndex((c) => c.tabId === selectedTabId);
      const nextIdx = ev.key === "ArrowRight"
        ? (idx < 0 ? 0 : (idx + 1) % channels.length)
        : (idx <= 0 ? channels.length - 1 : idx - 1);
      selectedTabId = channels[nextIdx]!.tabId;
      stripMap.get(selectedTabId)?.el.scrollIntoView({ block: "nearest", inline: "nearest" });
      renderAll();
      return;
    }

    const activeCh = findChannel(selectedTabId ?? channels[0]!.tabId);
    if (!activeCh) return;
    selectedTabId = activeCh.tabId;

    const key = ev.key.toLowerCase();
    if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
      ev.preventDefault();
      const step = ev.shiftKey ? 0.5 : 1.5;
      stripCallbacks.onSetTabDb(activeCh.tabId, activeCh.db + (ev.key === "ArrowUp" ? step : -step));
    } else if (ev.key === "0") {
      ev.preventDefault();
      stripCallbacks.onSetTabDb(activeCh.tabId, 0);
    } else if (ev.key === " " && document.activeElement?.tagName !== "BUTTON") {
      ev.preventDefault();
      stripCallbacks.onTogglePlay(activeCh.tabId);
    } else if (key === "m") {
      ev.preventDefault();
      stripCallbacks.onToggleMute(activeCh.tabId);
    } else if (key === "s" || key === "f") {
      ev.preventDefault();
      stripCallbacks.onToggleMode(activeCh.tabId, key === "s" ? "solo" : "focus", ev.shiftKey);
    } else if (key === "p") {
      ev.preventDefault();
      stripCallbacks.onTogglePin(activeCh.tabId, activeCh);
    } else if (ev.key === "Enter" && document.activeElement?.tagName !== "BUTTON") {
      ev.preventDefault();
      stripCallbacks.onJumpToTab(activeCh.tabId, activeCh.windowId, activeCh.title);
    }
  });

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
      if (snapshot.settings.modePref === "system") renderAll();
    });
  }
}

function connectBackgroundPort(): void {
  if (typeof chrome === "undefined" || !chrome.runtime?.connect) return;
  try {
    port = chrome.runtime.connect({ name: POPUP_PORT_NAME });
    port.onMessage.addListener((raw: unknown) => {
      const msg = raw as BgToPopupPortMessage | undefined;
      if (!msg) return;
      if (msg.type === "SNAPSHOT") {
        snapshot = msg.snapshot;
        if (tourDemoActive && snapshot.channels.length > 0) {
          tourDemoActive = false;
          demoChannels = [];
        }
        if (!initialOnboardingChecked) {
          initialOnboardingChecked = true;
          if (!snapshot.settings.onboardingDone) {
            helpRefs.setTab("tour");
            helpOpen = true;
          }
        }
        const channels = activeChannels();
        if (selectedTabId === null && channels.length > 0) {
          selectedTabId = channels[0]!.tabId;
        }
        renderAll();
      } else if (msg.type === "VU_BATCH") {
        const t = currentTokens();
        const channels = activeChannels();
        const ctx: MixerContextInput = {
          alpha: snapshot.settings.alpha, masterDb: snapshot.settings.masterDb,
          masterMuted: snapshot.settings.masterMuted,
          anySolo: channels.some((c) => c.solo),
          anyFocus: channels.some((c) => c.focus),
        };
        for (const item of msg.levels) {
          const ch = findChannel(item.tabId);
          if (ch) { ch.vuLevel = item.vuLevel; ch.vuPeak = item.vuPeak; ch.normTrimDb = item.normTrimDb; }
          const refs = stripMap.get(item.tabId);
          if (refs) {
            paintLedColumn(refs.vu.segs, item.vuLevel, item.vuPeak, t);
            if (ch) syncChannelReadoutSub(refs, ch, snapshot.settings, ctx, t);
          }
        }
        updateMasterBusVu(masterRefs, snapshot.settings, channels, t);
        syncFxRackTrimBadge(fxRackRefs, findChannel(selectedTabId ?? 0) ?? channels[0], snapshot.settings, t);
      }
    });
    port.onDisconnect.addListener(() => { port = null; });
  } catch { port = null; }
}

function bootstrapPopup(): void {
  initViewModeAndPopout(sendAction);
  helpRefs = buildHelpModalDom(document.getElementById("help-backdrop")!, {
    onRequestClose: () => {
      markOnboardingDone();
      helpOpen = false;
      renderAll();
    },
    onStartTour: () => startSpotlightTour(),
  });
  tourRefs = buildTourOverlayDom(document.getElementById("tour-overlay")!, () => {
    tourDemoActive = false;
    demoChannels = [];
    if (selectedTabId !== null && selectedTabId < 0) {
      selectedTabId = snapshot.channels[0]?.tabId ?? null;
    }
    renderAll();
  });
  masterRefs = buildMasterStripDom(() => snapshot.settings.masterDb, stripCallbacks);
  document.getElementById("master-dock")!.appendChild(masterRefs.el);

  const sideFxRack = document.getElementById("side-fx-rack")!;
  fxRackRefs = buildFxRackDom(sideFxRack, () => findChannel(selectedTabId ?? 0) ?? activeChannels()[0], (tabId, patch) => {
    const ch = findChannel(tabId);
    if (!ch) return;
    ch.fx = sanitizeChannelFx(ch.fx, patch);
    if (tabId >= 0) sendAction({ source: "popup", type: "UPDATE_TAB_FX", tabId, patch });
    renderAll();
  });

  setupTopDeckAndKeyboard();
  renderAll();
  connectBackgroundPort();
}

bootstrapPopup();
