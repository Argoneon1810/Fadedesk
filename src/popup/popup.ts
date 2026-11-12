import {
  clampAlpha,
  clampDb,
  formatDb,
  getFocusDimDb,
  isChannelPinned,
  toggleExclusiveFlags,
  type MixerContextInput,
} from "../shared/mixer-math";
import { DEFAULT_SETTINGS, PALETTES } from "../shared/palettes";
import {
  POPUP_PORT_NAME,
  type BgToPopupPortMessage,
  type ConsoleSnapshot,
  type ModePref,
  type PopupActionMessage,
  type TabChannelState,
  type ThemeKey,
  type ThemeTokens,
} from "../shared/types";
import { ICONS } from "./icons";
import {
  buildMasterStripDom,
  syncMasterStripDom,
  updateMasterBusVu,
  type MasterStripRefs,
} from "./master-view";
import {
  attachPointerDrag,
  buildChannelStripDom,
  paintLedColumn,
  syncChannelStripDom,
  type ChannelStripRefs,
  type StripCallbacks,
} from "./strip-view";
import { renderThemePopoverDom } from "./theme-popover";

/**
 * 팝업 최상위 오케스트레이터.
 * 백그라운드 포트와 실시간 동기화하며 낙관적(Optimistic) UI 반응, 테마 팝오버, 마우스리스 키보드 제어를 담당한다.
 */

let snapshot: ConsoleSnapshot = {
  settings: { ...DEFAULT_SETTINGS, domainDefaults: {} },
  channels: [],
};

let popoverOpen = false;
let selectedTabId: number | null = null;
let toastText = "";
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let port: chrome.runtime.Port | null = null;

const stripMap = new Map<number, ChannelStripRefs>();
const pauseDivider = document.createElement("div");
pauseDivider.className = "pause-divider";

const emptyBay = document.createElement("div");
emptyBay.className = "empty-bay";
emptyBay.innerHTML = `
  <div class="empty-icon">${ICONS.consoleEmpty}</div>
  <div class="empty-title">활성 미디어 탭이 없습니다</div>
  <div class="empty-desc">유튜브·스트리밍·음악 사이트에서 미디어를 재생하면 채널 스트립이 이 자리에 자동으로 정렬됩니다.</div>
`;

let masterRefs!: MasterStripRefs;

function resolvedMode(): "dark" | "light" {
  const pref = snapshot.settings.modePref;
  if (pref !== "system") return pref;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function currentTokens(): ThemeTokens {
  return PALETTES[snapshot.settings.theme][resolvedMode()];
}

function sendAction(msg: PopupActionMessage): void {
  try {
    if (port) {
      port.postMessage(msg);
      return;
    }
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      void chrome.runtime.sendMessage(msg).catch(() => {});
    }
  } catch {
    // 포트 연결 전/종료 중 예외 무시
  }
}

function flashToast(text: string): void {
  toastText = text;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastText = "";
    renderAll();
  }, 1600);
  renderAll();
}

function findChannel(tabId: number): TabChannelState | undefined {
  return snapshot.channels.find((c) => c.tabId === tabId);
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
  const scrollRow = document.getElementById("channels-scroll")!;
  const channels = snapshot.channels;

  // 닫힌 탭 DOM 제거
  const liveIds = new Set(channels.map((c) => c.tabId));
  for (const [tabId, ref] of stripMap.entries()) {
    if (!liveIds.has(tabId)) {
      ref.el.remove();
      stripMap.delete(tabId);
    }
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

  // 새 채널 DOM 생성
  for (const ch of channels) {
    if (!stripMap.has(ch.tabId)) {
      const created = buildChannelStripDom(ch, () => findChannel(ch.tabId), callbacks);
      stripMap.set(ch.tabId, created);
    }
  }

  // 재생 중 -> 구분선 -> 일시정지 순서 배치 (필요할 때만 DOM 이동하여 스크롤·포커스 보존)
  const playing = channels.filter((c) => c.playing);
  const paused = channels.filter((c) => !c.playing);
  const desiredNodes: HTMLElement[] = [];
  for (const ch of playing) desiredNodes.push(stripMap.get(ch.tabId)!.el);
  if (playing.length > 0 && paused.length > 0) desiredNodes.push(pauseDivider);
  for (const ch of paused) desiredNodes.push(stripMap.get(ch.tabId)!.el);

  if (playing.length === 0 || paused.length === 0) {
    pauseDivider.remove();
  }

  desiredNodes.forEach((node, idx) => {
    const currentAtIdx = scrollRow.children[idx];
    if (currentAtIdx !== node) {
      scrollRow.insertBefore(node, currentAtIdx ?? null);
    }
  });
}

function renderAll(): void {
  const mode = resolvedMode();
  const isDark = mode === "dark";
  const t = PALETTES[snapshot.settings.theme][mode];

  const root = document.getElementById("console-root")!;
  root.dataset.dark = String(isDark);
  const vars: Record<string, string> = {
    "--c-bg": t.bg,
    "--c-surface": t.surface,
    "--c-raised": t.raised,
    "--c-border": t.border,
    "--c-text": t.text,
    "--c-muted": t.muted,
    "--c-primary": t.primary,
    "--c-on-primary": t.onPrimary,
    "--c-accent": t.accent,
  };
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
    document.documentElement.style.setProperty(k, v);
  }

  renderThemePopover(t, isDark);

  const channels = snapshot.channels;
  const playingCount = channels.filter((c) => c.playing).length;
  const pausedCount = channels.length - playingCount;
  const anySolo = channels.some((c) => c.solo);
  const anyFocus = channels.some((c) => c.focus);

  const statusPill = document.getElementById("status-pill")!;
  const statusDot = document.getElementById("status-dot")!;
  const statusText = document.getElementById("status-text")!;
  statusPill.style.borderColor = toastText ? t.primary : t.border;
  statusDot.style.backgroundColor = toastText
    ? t.primary
    : anySolo
      ? t.accent
      : playingCount > 0
        ? t.states.success
        : t.muted;
  statusText.textContent = toastText || `재생 ${playingCount} · 대기 ${pausedCount}`;
  statusText.style.color = toastText ? t.primary : t.muted;

  const alphaBox = document.getElementById("alpha-box")!;
  const alphaLabel = document.getElementById("alpha-label")!;
  const alphaFill = document.getElementById("alpha-fill")!;
  const alphaThumb = document.getElementById("alpha-thumb")!;
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
    if (refs) {
      syncChannelStripDom(refs, ch, snapshot.settings, ctx, selectedTabId === ch.tabId, t);
    }
  }

  syncMasterStripDom(masterRefs, snapshot.settings, channels, t);
  updateMasterBusVu(masterRefs, snapshot.settings, snapshot.channels, t);
}

const stripCallbacks: StripCallbacks = {
  onSelectChannel(tabId) {
    if (selectedTabId !== tabId) {
      selectedTabId = tabId;
      renderAll();
    }
  },
  onSetTabDb(tabId, db) {
    const ch = findChannel(tabId);
    if (!ch) return;
    ch.db = clampDb(db, ch.corsCap);
    sendAction({ source: "popup", type: "SET_TAB_DB", tabId, db: ch.db });
    renderAll();
  },
  onToggleMute(tabId) {
    const ch = findChannel(tabId);
    if (!ch) return;
    ch.muted = !ch.muted;
    sendAction({ source: "popup", type: "TOGGLE_TAB_MUTE", tabId });
    renderAll();
  },
  onToggleMode(tabId, mode, shiftKey) {
    toggleExclusiveFlags(snapshot.channels, tabId, mode, shiftKey);
    sendAction({ source: "popup", type: "TOGGLE_TAB_MODE", tabId, mode, shiftKey });
    renderAll();
  },
  onTogglePlay(tabId) {
    const ch = findChannel(tabId);
    if (ch) ch.playing = !ch.playing;
    sendAction({ source: "popup", type: "TOGGLE_TAB_PLAY", tabId });
    renderAll();
  },
  onTogglePin(tabId, ch) {
    if (!ch.domain) return;
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
    const shouldPlay = !snapshot.channels.some((c) => c.playing);
    for (const ch of snapshot.channels) ch.playing = shouldPlay;
    sendAction({ source: "popup", type: "SET_ALL_PLAYING", shouldPlay });
    renderAll();
  },
  onRefreshUi() {
    renderAll();
  },
};

function setupTopDeckAndKeyboard(): void {
  const alphaBox = document.getElementById("alpha-box")!;
  const alphaTrack = document.getElementById("alpha-track")!;

  const applyAlpha = (next: number): void => {
    snapshot.settings.alpha = clampAlpha(next);
    sendAction({ source: "popup", type: "SET_ALPHA", alpha: snapshot.settings.alpha });
    renderAll();
  };

  alphaBox.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      applyAlpha(snapshot.settings.alpha + (ev.deltaY < 0 ? 0.05 : -0.05));
    },
    { passive: false },
  );
  attachPointerDrag(alphaTrack, "x", (ratio) => applyAlpha(ratio), () => applyAlpha(0.7));

  document.getElementById("reset-modes-btn")!.onclick = () => {
    for (const ch of snapshot.channels) {
      ch.solo = false;
      ch.focus = false;
    }
    sendAction({ source: "popup", type: "CLEAR_MODES" });
    renderAll();
  };

  const dotBtn = document.getElementById("theme-dot-btn")!;
  const pop = document.getElementById("theme-popover")!;
  dotBtn.onclick = (ev) => {
    ev.stopPropagation();
    popoverOpen = !popoverOpen;
    renderAll();
  };
  pop.onclick = (ev) => ev.stopPropagation();

  window.addEventListener("pointerdown", (ev) => {
    if (!popoverOpen) return;
    const target = ev.target as Node | null;
    if (target && !pop.contains(target) && !dotBtn.contains(target)) {
      popoverOpen = false;
      renderAll();
    }
  });

  // 마우스리스 키보드 워크플로 (방향키 채널 선택·볼륨 조절, 0 리셋, Space 재생, M/S/F/P/Enter)
  window.addEventListener("keydown", (ev) => {
    const activeTag = document.activeElement?.tagName;
    if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;

    if (ev.key === "Escape" && popoverOpen) {
      ev.preventDefault();
      popoverOpen = false;
      renderAll();
      return;
    }

    const channels = snapshot.channels;
    if (channels.length === 0) return;

    if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
      ev.preventDefault();
      const idx = channels.findIndex((c) => c.tabId === selectedTabId);
      const nextIdx =
        ev.key === "ArrowRight"
          ? idx < 0
            ? 0
            : (idx + 1) % channels.length
          : idx <= 0
            ? channels.length - 1
            : idx - 1;
      selectedTabId = channels[nextIdx]!.tabId;
      stripMap.get(selectedTabId)?.el.scrollIntoView({ block: "nearest", inline: "nearest" });
      renderAll();
      return;
    }

    const activeCh = findChannel(selectedTabId ?? channels[0]!.tabId);
    if (!activeCh) return;
    selectedTabId = activeCh.tabId;

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
    } else if (ev.key === "m" || ev.key === "M") {
      ev.preventDefault();
      stripCallbacks.onToggleMute(activeCh.tabId);
    } else if (ev.key === "s" || ev.key === "S") {
      ev.preventDefault();
      stripCallbacks.onToggleMode(activeCh.tabId, "solo", ev.shiftKey);
    } else if (ev.key === "f" || ev.key === "F") {
      ev.preventDefault();
      stripCallbacks.onToggleMode(activeCh.tabId, "focus", ev.shiftKey);
    } else if (ev.key === "p" || ev.key === "P") {
      ev.preventDefault();
      stripCallbacks.onTogglePin(activeCh.tabId, activeCh);
    } else if (ev.key === "Enter" && document.activeElement?.tagName !== "BUTTON") {
      ev.preventDefault();
      stripCallbacks.onJumpToTab(activeCh.tabId, activeCh.windowId, activeCh.title);
    }
  });

  if (window.matchMedia) {
    window
      .matchMedia("(prefers-color-scheme: light)")
      .addEventListener("change", () => {
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
        if (selectedTabId === null && snapshot.channels.length > 0) {
          selectedTabId = snapshot.channels[0]!.tabId;
        }
        renderAll();
      } else if (msg.type === "VU_BATCH") {
        const t = currentTokens();
        for (const item of msg.levels) {
          const ch = findChannel(item.tabId);
          if (ch) {
            ch.vuLevel = item.vuLevel;
            ch.vuPeak = item.vuPeak;
          }
          const refs = stripMap.get(item.tabId);
          if (refs) {
            paintLedColumn(refs.vu.segs, item.vuLevel, item.vuPeak, t);
          }
        }
        updateMasterBusVu(masterRefs, snapshot.settings, snapshot.channels, t);
      }
    });
    port.onDisconnect.addListener(() => {
      port = null;
    });
  } catch {
    port = null;
  }
}

function bootstrapPopup(): void {
  masterRefs = buildMasterStripDom(() => snapshot.settings.masterDb, stripCallbacks);
  document.getElementById("master-dock")!.appendChild(masterRefs.el);
  setupTopDeckAndKeyboard();
  renderAll();
  connectBackgroundPort();
}

bootstrapPopup();
