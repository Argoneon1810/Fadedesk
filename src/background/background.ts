import { PALETTES } from "../shared/palettes";
import {
  POPUP_PORT_NAME,
  type BgToBridgeMessage,
  type BgToPopupPortMessage,
  type BridgeToBgMessage,
  type HookCommand,
  type PersistedSettings,
  type PopupActionMessage,
} from "../shared/types";
import { MixerStateStore, type SerializedTabSession } from "./state-store";

/**
 * MV3 백그라운드 서비스 워커.
 * - 모든 창·탭의 미디어 프레임 보고를 집계하고 목표 선형 게인 및 채널 DSP 파라미터를 실시간 배포
 * - 팝업이 열려 있을 때만 VU 미터링 IPC를 구동하여 대기 시 확장 IPC 부하 0% 유지
 * - 툴바 아이콘 배지와 전역 단축키(Master 음소거 · Focus 순환) 처리
 */

const SETTINGS_STORAGE_KEY = "soundManagerSettings_v1";
const SESSION_STORAGE_KEY = "soundManagerTabSession_v1";

const store = new MixerStateStore();
const popupPorts = new Set<chrome.runtime.Port>();
let vuBroadcastTimer: ReturnType<typeof setInterval> | null = null;
let saveSessionTimer: ReturnType<typeof setTimeout> | null = null;
let hydrationPromise: Promise<void> | null = null;

function isInjectableUrl(url?: string): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://");
}

async function ensureHydrated(): Promise<void> {
  if (!hydrationPromise) {
    hydrationPromise = (async () => {
      try {
        const localData = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
        store.hydrateSettings(localData[SETTINGS_STORAGE_KEY] as Partial<PersistedSettings> | undefined);
      } catch {
        // 기본 설정 유지
      }

      try {
        const sessionData = await chrome.storage.session.get(SESSION_STORAGE_KEY);
        store.importSession(sessionData[SESSION_STORAGE_KEY] as SerializedTabSession[] | undefined);
      } catch {
        // 세션 초기 상태 유지
      }

      try {
        const openTabs = await chrome.tabs.query({});
        const openIds = new Set<number>();
        for (const t of openTabs) {
          if (typeof t.id !== "number") continue;
          openIds.add(t.id);
          if (t.audible || store.hasKnownTab(t.id)) {
            store.upsertTabMeta({
              tabId: t.id,
              windowId: t.windowId,
              url: t.url,
              title: t.title,
              favIconUrl: t.favIconUrl,
              audible: t.audible,
            });
          }
        }
        for (const trackedId of store.getTrackedTabIds()) {
          if (!openIds.has(trackedId)) {
            store.removeTab(trackedId);
          }
        }
      } catch {
        // 탭 조회 권한 전 단계 무시
      }

      updateActionBadge();
    })();
  }
  return hydrationPromise;
}

async function persistSettings(): Promise<void> {
  try {
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: store.getSettings() });
  } catch {
    // 저장소 쓰기 오류 무시
  }
}

function scheduleSaveSession(): void {
  if (saveSessionTimer) return;
  saveSessionTimer = setTimeout(() => {
    saveSessionTimer = null;
    void chrome.storage.session
      .set({ [SESSION_STORAGE_KEY]: store.exportSession() })
      .catch(() => {});
  }, 120);
}

function sendCommandToTab(tabId: number, command: HookCommand, frameId?: number): void {
  const message: BgToBridgeMessage = { target: "content-bridge", command };
  const options = typeof frameId === "number" ? { frameId } : undefined;
  try {
    if (options) {
      void chrome.tabs.sendMessage(tabId, message, options).catch(() => {});
    } else {
      void chrome.tabs.sendMessage(tabId, message).catch(() => {});
    }
  } catch {
    // 탭 종료 중 메시지 실패 무시
  }
}

function pushGainToTab(tabId: number, frameId?: number, rampSec?: number): void {
  const targetGain = store.computeTargetGainForTab(tabId);
  const cmd: HookCommand =
    typeof rampSec === "number" && rampSec > 0
      ? { type: "APPLY_GAIN", targetGain, rampSec }
      : { type: "APPLY_GAIN", targetGain };
  sendCommandToTab(tabId, cmd, frameId);
}

function pushDspToTab(tabId: number, frameId?: number): void {
  const dsp = store.computeDspForTab(tabId);
  sendCommandToTab(tabId, { type: "APPLY_DSP", dsp }, frameId);
}

function pushGainsToAllTabs(rampSec?: number): void {
  for (const tabId of store.getTrackedTabIds()) {
    pushGainToTab(tabId, undefined, rampSec);
  }
}

function pushDspToAllTabs(): void {
  for (const tabId of store.getTrackedTabIds()) {
    pushDspToTab(tabId);
  }
}

function setMeteringOnAllTabs(active: boolean): void {
  for (const tabId of store.getTrackedTabIds()) {
    sendCommandToTab(tabId, { type: "SET_METERING", active });
  }
}

function updateActionBadge(): void {
  const snap = store.buildSnapshot();
  const playingCount = snap.channels.filter((c) => c.playing).length;
  const anySolo = snap.channels.some((c) => c.solo);
  const anyFocus = snap.channels.some((c) => c.focus);
  const palette = PALETTES[snap.settings.theme].dark;

  let text = "";
  let bgColor = palette.raised;

  if (snap.settings.masterMuted && snap.channels.length > 0) {
    text = "M";
    bgColor = palette.states.danger;
  } else if (playingCount > 0) {
    text = anySolo ? `${playingCount}S` : anyFocus ? `${playingCount}F` : String(playingCount);
    bgColor = anySolo ? palette.accent : anyFocus ? palette.primary : palette.states.success;
  }

  void chrome.action.setBadgeText({ text }).catch(() => {});
  void chrome.action.setBadgeBackgroundColor({ color: bgColor }).catch(() => {});
}

function broadcastToPopups(msg: BgToPopupPortMessage): void {
  for (const port of popupPorts) {
    try {
      port.postMessage(msg);
    } catch {
      popupPorts.delete(port);
    }
  }
}

function broadcastSnapshotAndBadge(): void {
  updateActionBadge();
  scheduleSaveSession();
  if (popupPorts.size > 0) {
    broadcastToPopups({ type: "SNAPSHOT", snapshot: store.buildSnapshot() });
  }
}

function syncVuBroadcastLoop(): void {
  if (popupPorts.size > 0 && !vuBroadcastTimer) {
    vuBroadcastTimer = setInterval(() => {
      if (popupPorts.size === 0) return;
      broadcastToPopups({ type: "VU_BATCH", levels: store.collectVuLevels() });
    }, 80);
  } else if (popupPorts.size === 0 && vuBroadcastTimer) {
    clearInterval(vuBroadcastTimer);
    vuBroadcastTimer = null;
  }
}

async function probeExistingOpenTabs(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (typeof tab.id !== "number" || !isInjectableUrl(tab.url)) continue;
      const tabId = tab.id;
      void chrome.scripting
        .executeScript({
          target: { tabId, allFrames: true },
          files: ["audio-hook.js"],
          world: "MAIN",
        })
        .then(() =>
          chrome.scripting.executeScript({
            target: { tabId, allFrames: true },
            files: ["content-bridge.js"],
            world: "ISOLATED",
          }),
        )
        .catch(() => {});
    }
  } catch {
    // 탭 조회 실패 무시
  }
}

async function openOrFocusStandaloneWindow(): Promise<void> {
  const targetUrl = chrome.runtime.getURL("popup.html?view=window");
  try {
    const wins = await chrome.windows.getAll({ populate: true });
    const existing = wins.find((w) => w.tabs?.some((t) => t.url === targetUrl));
    if (existing && typeof existing.id === "number") {
      await chrome.windows.update(existing.id, {
        focused: true,
        ...(existing.state === "minimized" ? { state: "normal" } : {}),
      });
      return;
    }
  } catch {
    // 창 목록 조회 실패 시 신규 창 생성으로 폴백
  }

  const { popoutWidth, popoutHeight } = store.getSettings();
  try {
    await chrome.windows.create({
      url: targetUrl,
      type: "popup",
      width: popoutWidth,
      height: popoutHeight,
      focused: true,
    });
  } catch {
    // 창 생성 실패 무시
  }
}

async function handlePopupAction(msg: PopupActionMessage): Promise<void> {
  switch (msg.type) {
    case "GET_SNAPSHOT":
      broadcastSnapshotAndBadge();
      break;

    case "SET_TAB_DB":
      if (store.setTabDb(msg.tabId, msg.db)) {
        pushGainToTab(msg.tabId);
        broadcastSnapshotAndBadge();
      }
      break;

    case "TOGGLE_TAB_MUTE":
      if (store.toggleTabMute(msg.tabId)) {
        pushGainToTab(msg.tabId);
        broadcastSnapshotAndBadge();
      }
      break;

    case "TOGGLE_TAB_MODE":
      if (store.toggleTabMode(msg.tabId, msg.mode, msg.shiftKey)) {
        pushGainsToAllTabs();
        broadcastSnapshotAndBadge();
      }
      break;

    case "CLEAR_MODES":
      store.clearModes();
      pushGainsToAllTabs();
      broadcastSnapshotAndBadge();
      break;

    case "TOGGLE_TAB_PLAY": {
      const nextPlay = typeof msg.shouldPlay === "boolean" ? msg.shouldPlay : !store.isTabPlaying(msg.tabId);
      store.setTabPlaying(msg.tabId, nextPlay);
      sendCommandToTab(msg.tabId, { type: "SET_PLAYING", shouldPlay: nextPlay });
      pushGainsToAllTabs();
      broadcastSnapshotAndBadge();
      break;
    }

    case "TOGGLE_DOMAIN_PIN":
      if (store.toggleDomainPin(msg.tabId)) {
        await persistSettings();
        broadcastSnapshotAndBadge();
      }
      break;

    case "JUMP_TO_TAB":
      try {
        await chrome.tabs.update(msg.tabId, { active: true });
        await chrome.windows.update(msg.windowId, { focused: true });
      } catch {
        const { releasedLastSolo } = store.removeTab(msg.tabId);
        if (releasedLastSolo) pushGainsToAllTabs(0.3);
        broadcastSnapshotAndBadge();
      }
      break;

    case "SET_ALPHA":
      store.setAlpha(msg.alpha);
      pushGainsToAllTabs();
      await persistSettings();
      broadcastSnapshotAndBadge();
      break;

    case "SET_MASTER_DB":
      store.setMasterDb(msg.masterDb);
      pushGainsToAllTabs();
      await persistSettings();
      broadcastSnapshotAndBadge();
      break;

    case "TOGGLE_MASTER_MUTE":
      store.toggleMasterMute();
      pushGainsToAllTabs();
      await persistSettings();
      broadcastSnapshotAndBadge();
      break;

    case "TOGGLE_AUTO_NORM":
      store.toggleAutoNorm();
      pushDspToAllTabs();
      await persistSettings();
      broadcastSnapshotAndBadge();
      break;

    case "SET_AUTO_NORM_PRESET":
      store.setAutoNormPreset(msg.preset, msg.enable);
      pushDspToAllTabs();
      await persistSettings();
      broadcastSnapshotAndBadge();
      break;

    case "COMPLETE_ONBOARDING":
      if (store.completeOnboarding()) {
        await persistSettings();
        broadcastSnapshotAndBadge();
      }
      break;

    case "SET_ADV_RACK_OPEN":
      store.setAdvRackOpen(msg.open);
      await persistSettings();
      broadcastSnapshotAndBadge();
      break;

    case "UPDATE_TAB_FX":
      if (store.updateTabFx(msg.tabId, msg.patch)) {
        pushDspToTab(msg.tabId);
        broadcastSnapshotAndBadge();
      }
      break;

    case "REORDER_CHANNELS": {
      store.reorderChannels(
        msg.movedTabId,
        msg.targetZone,
        msg.orderedPlayingIds,
        msg.orderedPausedIds,
      );
      const shouldPlay = msg.targetZone === "playing";
      store.setTabPlaying(msg.movedTabId, shouldPlay);
      sendCommandToTab(msg.movedTabId, { type: "SET_PLAYING", shouldPlay });
      pushGainsToAllTabs();
      await persistSettings();
      broadcastSnapshotAndBadge();
      break;
    }

    case "SET_ALL_PLAYING": {
      const snap = store.buildSnapshot();
      for (const ch of snap.channels) {
        store.setTabPlaying(ch.tabId, msg.shouldPlay);
        sendCommandToTab(ch.tabId, { type: "SET_PLAYING", shouldPlay: msg.shouldPlay });
      }
      pushGainsToAllTabs();
      broadcastSnapshotAndBadge();
      break;
    }

    case "SET_THEME":
      store.setTheme(msg.theme, msg.modePref);
      await persistSettings();
      broadcastSnapshotAndBadge();
      break;

    case "OPEN_STANDALONE_WINDOW":
      await openOrFocusStandaloneWindow();
      break;

    case "SAVE_POPOUT_BOUNDS":
      if (store.setPopoutBounds(msg.width, msg.height)) {
        await persistSettings();
      }
      break;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureHydrated().then(() => probeExistingOpenTabs());
});

chrome.runtime.onStartup.addListener(() => {
  void ensureHydrated().then(() => probeExistingOpenTabs());
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== POPUP_PORT_NAME) return;
  popupPorts.add(port);

  void ensureHydrated().then(() => {
    setMeteringOnAllTabs(true);
    syncVuBroadcastLoop();
    port.postMessage({ type: "SNAPSHOT", snapshot: store.buildSnapshot() } satisfies BgToPopupPortMessage);
    void probeExistingOpenTabs();
  });

  port.onMessage.addListener((msg: unknown) => {
    const typed = msg as PopupActionMessage | undefined;
    if (typed && typed.source === "popup") {
      void ensureHydrated().then(() => handlePopupAction(typed));
    }
  });

  port.onDisconnect.addListener(() => {
    popupPorts.delete(port);
    syncVuBroadcastLoop();
    if (popupPorts.size === 0) {
      setMeteringOnAllTabs(false);
    }
  });
});

chrome.runtime.onMessage.addListener((rawMsg: unknown, sender, sendResponse) => {
  const bridgeMsg = rawMsg as BridgeToBgMessage | PopupActionMessage | undefined;
  if (!bridgeMsg) return false;

  if (bridgeMsg.source === "content-bridge") {
    const tab = sender.tab;
    if (!tab || typeof tab.id !== "number") return false;
    const tabId = tab.id;
    const frameId = typeof sender.frameId === "number" ? sender.frameId : 0;

    void ensureHydrated().then(() => {
      if (bridgeMsg.type === "FRAME_REPORT") {
        store.updateFrameReport(
          {
            tabId,
            windowId: tab.windowId,
            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl,
            audible: tab.audible,
          },
          frameId,
          bridgeMsg.payload,
        );
        pushGainToTab(tabId, frameId);
        pushDspToTab(tabId, frameId);
        if (popupPorts.size > 0) {
          sendCommandToTab(tabId, { type: "SET_METERING", active: true }, frameId);
        }
        broadcastSnapshotAndBadge();
      } else if (bridgeMsg.type === "FRAME_VU") {
        store.updateFrameVu(tabId, frameId, bridgeMsg.vuLevel, bridgeMsg.vuPeak, bridgeMsg.normTrimDb);
      } else if (bridgeMsg.type === "FRAME_UNLOAD") {
        store.removeFrame(tabId, frameId);
        broadcastSnapshotAndBadge();
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  if (bridgeMsg.source === "popup") {
    void ensureHydrated().then(async () => {
      await handlePopupAction(bridgeMsg);
      sendResponse({ snapshot: store.buildSnapshot() });
    });
    return true;
  }

  return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.audible === undefined &&
    changeInfo.title === undefined &&
    changeInfo.favIconUrl === undefined &&
    changeInfo.url === undefined
  ) {
    return;
  }
  void ensureHydrated().then(() => {
    if (!tab.audible && !store.hasKnownTab(tabId)) return;
    store.upsertTabMeta({
      tabId,
      windowId: tab.windowId,
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
      audible: tab.audible,
    });
    if (changeInfo.url !== undefined) {
      pushGainToTab(tabId);
      pushDspToTab(tabId);
    }
    broadcastSnapshotAndBadge();
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void ensureHydrated().then(() => {
    if (!store.hasKnownTab(tabId)) return;
    const { releasedLastSolo } = store.removeTab(tabId);
    pushGainsToAllTabs(releasedLastSolo ? 0.3 : undefined);
    broadcastSnapshotAndBadge();
  });
});

chrome.commands.onCommand.addListener((command) => {
  void ensureHydrated().then(async () => {
    if (command === "toggle-master-mute") {
      store.toggleMasterMute();
      pushGainsToAllTabs();
      await persistSettings();
      broadcastSnapshotAndBadge();
    } else if (command === "cycle-focus-channel") {
      store.cycleFocusChannel();
      pushGainsToAllTabs();
      broadcastSnapshotAndBadge();
    }
  });
});
