import {
  clampDb,
  computeDisplayedEffectiveDb,
  dbToRatio,
  formatDb,
  isChannelPinned,
  LED_COUNT,
  MAX_DB,
  MIN_DB,
  ratioToDb,
  SCALE_TICKS,
  type MixerContextInput,
} from "../shared/mixer-math";
import type { ExclusiveMode, PersistedSettings, TabChannelState, ThemeTokens } from "../shared/types";
import { attachDbInlineEditor } from "./db-inline-editor";
import { ICONS } from "./icons";

/**
 * 개별 채널 스트립 및 우측 고정 MASTER BUS 스트립의 DOM 생성과 상태 동기화 뷰 모듈.
 */

export interface StripCallbacks {
  onSelectChannel: (tabId: number) => void;
  onSetTabDb: (tabId: number, db: number) => void;
  onToggleMute: (tabId: number) => void;
  onToggleMode: (tabId: number, mode: ExclusiveMode, shiftKey: boolean) => void;
  onTogglePlay: (tabId: number) => void;
  onTogglePin: (tabId: number, ch: TabChannelState) => void;
  onJumpToTab: (tabId: number, windowId: number, title: string) => void;
  onSetMasterDb: (db: number) => void;
  onToggleMasterMute: () => void;
  onToggleAllPlaying: () => void;
  onRefreshUi: () => void;
}

export interface LedColumnRef {
  col: HTMLDivElement;
  segs: HTMLSpanElement[];
}

export interface ChannelStripRefs {
  tabId: number;
  el: HTMLElement;
  topAccent: HTMLElement;
  header: HTMLButtonElement;
  faviconBox: HTMLElement;
  hostLabel: HTMLElement;
  titleEl: HTMLElement;
  track: HTMLElement;
  fill: HTMLElement;
  corsZone: HTMLElement;
  deltaBar: HTMLElement;
  ghostCap: HTMLElement;
  knob: HTMLElement;
  knobLine: HTMLElement;
  scaleItems: Array<{ db: number; el: HTMLDivElement }>;
  vu: LedColumnRef;
  readoutBtn: HTMLElement;
  dbText: HTMLElement;
  subText: HTMLElement;
  playBtn: HTMLButtonElement;
  pinBtn: HTMLButtonElement;
  pinDot: HTMLElement;
  muteBtn: HTMLButtonElement;
  mutePip: HTMLElement;
  soloBtn: HTMLButtonElement;
  soloPip: HTMLElement;
  focusBtn: HTMLButtonElement;
  focusPip: HTMLElement;
  renderedFavIcon: string;
}

export function attachPointerDrag(
  el: HTMLElement,
  axis: "x" | "y",
  onRatio: (ratio: number) => void,
  onReset?: () => void,
): void {
  if (onReset) {
    el.addEventListener("dblclick", (ev) => {
      ev.preventDefault();
      onReset();
    });
  }
  el.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0 || ev.detail >= 2) return;
    ev.preventDefault();
    const apply = (moveEv: PointerEvent): void => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const raw =
        axis === "y"
          ? 1 - (moveEv.clientY - rect.top) / rect.height
          : (moveEv.clientX - rect.left) / rect.width;
      onRatio(Math.max(0, Math.min(1, raw)));
    };
    apply(ev);
    const onMove = (moveEv: PointerEvent): void => apply(moveEv);
    const onUp = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

export function createLedColumn(): LedColumnRef {
  const col = document.createElement("div");
  col.className = "vu-col";
  const segs = Array.from({ length: LED_COUNT }, () => {
    const s = document.createElement("span");
    s.className = "vu-seg";
    col.appendChild(s);
    return s;
  });
  return { col, segs };
}

export function paintLedColumn(
  segs: HTMLSpanElement[],
  levelRatio: number,
  peakRatio: number,
  t: ThemeTokens,
): void {
  const litCount = Math.round(levelRatio * LED_COUNT);
  const peakIdx =
    peakRatio > 0.04 ? Math.min(LED_COUNT - 1, Math.max(0, Math.round(peakRatio * LED_COUNT) - 1)) : -1;
  const zeroSeg = Math.round(dbToRatio(0) * LED_COUNT);
  const hotSeg = Math.round(dbToRatio(7.5) * LED_COUNT);

  for (let i = 0; i < LED_COUNT; i++) {
    const seg = segs[i];
    if (!seg) continue;
    const segColor =
      i >= hotSeg ? t.states.danger : i >= zeroSeg ? t.states.warning : t.states.success;
    const isLit = i < litCount;
    const isPeak = i === peakIdx && peakIdx >= litCount;
    seg.style.backgroundColor = isLit || isPeak ? segColor : t.border;
    seg.style.opacity = isLit ? "0.95" : isPeak ? "0.85" : "0.28";
  }
}

function buildScaleDom(): { wrap: HTMLDivElement; items: Array<{ db: number; el: HTMLDivElement }> } {
  const wrap = document.createElement("div");
  wrap.className = "scale-wrap";
  const items = SCALE_TICKS.map((db) => {
    const row = document.createElement("div");
    row.className = "scale-tick tabular";
    row.style.bottom = `calc(${dbToRatio(db) * 100}% - 4.5px)`;
    row.textContent = db > 0 ? `+${db}` : String(db);
    wrap.appendChild(row);
    return { db, el: row };
  });
  return { wrap, items };
}

function syncSwitchStyle(
  btn: HTMLButtonElement,
  pip: HTMLElement,
  active: boolean,
  activeBg: string,
  activeFg: string,
  t: ThemeTokens,
): void {
  btn.style.backgroundColor = active ? activeBg : t.raised;
  btn.style.color = active ? activeFg : t.muted;
  btn.style.borderColor = active ? activeBg : t.border;
  btn.style.fontWeight = active ? "700" : "600";
  pip.style.backgroundColor = active ? activeFg : t.border;
  pip.style.opacity = active ? "0.9" : "0.7";
}

function renderFaviconInto(box: HTMLElement, favIconUrl: string): void {
  box.innerHTML = "";
  if (favIconUrl && (favIconUrl.startsWith("http://") || favIconUrl.startsWith("https://") || favIconUrl.startsWith("data:"))) {
    const img = document.createElement("img");
    img.src = favIconUrl;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.onerror = () => {
      box.innerHTML = ICONS.waveBadge;
    };
    box.appendChild(img);
  } else {
    box.innerHTML = ICONS.waveBadge;
  }
}

export function buildChannelStripDom(
  initialCh: TabChannelState,
  getLatestCh: () => TabChannelState | undefined,
  cb: StripCallbacks,
): ChannelStripRefs {
  const zeroPct = dbToRatio(0) * 100;
  const el = document.createElement("section");
  el.className = "channel-strip";
  el.dataset.tabId = String(initialCh.tabId);
  el.innerHTML = `
    <div data-ref="topAccent" class="strip-top-accent"></div>
    <button data-ref="header" type="button" class="strip-header">
      <div class="strip-header-row1">
        <span data-ref="faviconBox" class="favicon-box">${ICONS.waveBadge}</span>
        <span data-ref="hostLabel" class="host-label truncate"></span>
        <span class="jump-icon">${ICONS.jump}</span>
      </div>
      <div data-ref="titleEl" class="strip-title truncate"></div>
    </button>

    <div class="fader-well">
      <div data-ref="track" class="fader-track" title="드래그·휠 조절 (Shift+휠 미세) · 더블클릭 0.0dB 복귀">
        <span class="unity-wing-l" style="bottom:${zeroPct}%"></span>
        <span class="unity-wing-r" style="bottom:${zeroPct}%"></span>
        <div class="fader-slot">
          <div data-ref="fill" class="fader-fill"></div>
          <div data-ref="corsZone" class="cors-zone hidden" style="height:${100 - zeroPct}%"></div>
        </div>
        <div data-ref="deltaBar" class="delta-bar hidden"></div>
        <div data-ref="ghostCap" class="ghost-cap hidden"></div>
        <div data-ref="knob" class="fader-cap">
          <span class="cap-groove-sub"></span>
          <span data-ref="knobLine" class="cap-groove-main"></span>
          <span class="cap-groove-sub"></span>
        </div>
      </div>
      <div data-ref="scaleSlot" style="height:100%;display:flex;align-items:center"></div>
      <div data-ref="vuSlot" style="height:100%;display:flex;align-items:center"></div>
    </div>

    <div data-ref="readoutBtn" role="button" tabindex="0" title="클릭하여 dB 직접 입력 (Enter 적용 · Esc 취소)" class="readout-btn c-recessed">
      <div data-ref="displayRow" class="readout-row1">
        <span data-ref="dbText" class="readout-db tabular"></span>
        <span class="readout-unit">dB</span>
      </div>
      <div data-ref="editRow" class="readout-edit-row hidden">
        <input data-ref="dbInput" type="text" inputmode="decimal" spellcheck="false" autocomplete="off" class="readout-input tabular" aria-label="채널 데시벨 직접 입력" />
        <span class="readout-unit">dB</span>
      </div>
      <div data-ref="subText" class="readout-sub truncate tabular"></div>
    </div>

    <div class="transport-row">
      <button data-ref="playBtn" type="button" class="console-btn play-btn" title="재생 / 일시정지"></button>
      <button data-ref="pinBtn" type="button" class="console-btn pin-btn">
        ${ICONS.pin}
        <span data-ref="pinDot" class="pin-dot"></span>
      </button>
    </div>

    <div class="switch-bank c-recessed">
      <button data-ref="muteBtn" type="button" class="console-btn switch-btn" title="음소거 (Mute)">
        <span data-ref="mutePip" class="switch-pip"></span><span class="switch-lbl">M</span>
      </button>
      <button data-ref="soloBtn" type="button" class="console-btn switch-btn" title="Solo (클릭: 단독 전환/해제 · Shift+클릭: 다중 · Focus와 상호 배타)">
        <span data-ref="soloPip" class="switch-pip"></span><span class="switch-lbl">S</span>
      </button>
      <button data-ref="focusBtn" type="button" class="console-btn switch-btn" title="Focus (클릭: 단독 전환/해제 · Shift+클릭: 다중 · Solo와 상호 배타)">
        <span data-ref="focusPip" class="switch-pip"></span><span class="switch-lbl">F</span>
      </button>
    </div>
  `;

  const scale = buildScaleDom();
  const vu = createLedColumn();
  el.querySelector('[data-ref="scaleSlot"]')!.appendChild(scale.wrap);
  el.querySelector('[data-ref="vuSlot"]')!.appendChild(vu.col);

  const q = <T extends HTMLElement>(name: string): T => el.querySelector(`[data-ref="${name}"]`) as T;
  const refs: ChannelStripRefs = {
    tabId: initialCh.tabId,
    el,
    topAccent: q("topAccent"),
    header: q("header"),
    faviconBox: q("faviconBox"),
    hostLabel: q("hostLabel"),
    titleEl: q("titleEl"),
    track: q("track"),
    fill: q("fill"),
    corsZone: q("corsZone"),
    deltaBar: q("deltaBar"),
    ghostCap: q("ghostCap"),
    knob: q("knob"),
    knobLine: q("knobLine"),
    scaleItems: scale.items,
    vu,
    readoutBtn: q("readoutBtn"),
    dbText: q("dbText"),
    subText: q("subText"),
    playBtn: q("playBtn"),
    pinBtn: q("pinBtn"),
    pinDot: q("pinDot"),
    muteBtn: q("muteBtn"),
    mutePip: q("mutePip"),
    soloBtn: q("soloBtn"),
    soloPip: q("soloPip"),
    focusBtn: q("focusBtn"),
    focusPip: q("focusPip"),
    renderedFavIcon: "__UNSET__",
  };

  el.addEventListener("pointerdown", () => cb.onSelectChannel(initialCh.tabId), { passive: true });
  el.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      const ch = getLatestCh();
      if (!ch) return;
      cb.onSelectChannel(ch.tabId);
      const step = ev.shiftKey ? 0.5 : 1.5;
      const next = clampDb(ch.db + (ev.deltaY < 0 ? step : -step), ch.corsCap);
      cb.onSetTabDb(ch.tabId, next);
    },
    { passive: false },
  );

  attachPointerDrag(
    refs.track,
    "y",
    (ratio) => {
      const ch = getLatestCh();
      if (!ch) return;
      cb.onSetTabDb(ch.tabId, ratioToDb(ratio, ch.corsCap));
    },
    () => cb.onSetTabDb(initialCh.tabId, 0),
  );

  attachDbInlineEditor({
    box: refs.readoutBtn,
    displayRow: q("displayRow"),
    editRow: q("editRow"),
    input: q<HTMLInputElement>("dbInput"),
    subEl: refs.subText,
    getCurrentDb: () => getLatestCh()?.db ?? initialCh.db,
    isCorsCapped: () => Boolean(getLatestCh()?.corsCap),
    onSelect: () => cb.onSelectChannel(initialCh.tabId),
    onCommitDb: (nextDb) => cb.onSetTabDb(initialCh.tabId, nextDb),
    onAfterExit: () => cb.onRefreshUi(),
  });
  refs.header.onclick = () => {
    const ch = getLatestCh();
    if (ch) cb.onJumpToTab(ch.tabId, ch.windowId, ch.title);
  };
  refs.playBtn.onclick = () => cb.onTogglePlay(initialCh.tabId);
  refs.pinBtn.onclick = () => {
    const ch = getLatestCh();
    if (ch) cb.onTogglePin(ch.tabId, ch);
  };
  refs.muteBtn.onclick = () => cb.onToggleMute(initialCh.tabId);
  refs.soloBtn.onclick = (ev) => cb.onToggleMode(initialCh.tabId, "solo", ev.shiftKey);
  refs.focusBtn.onclick = (ev) => cb.onToggleMode(initialCh.tabId, "focus", ev.shiftKey);

  return refs;
}

export function syncChannelStripDom(
  r: ChannelStripRefs,
  ch: TabChannelState,
  settings: PersistedSettings,
  ctx: MixerContextInput,
  selected: boolean,
  t: ThemeTokens,
): void {
  const effDb = computeDisplayedEffectiveDb(ch, ctx);
  const userPct = dbToRatio(ch.db) * 100;
  const effPct = Number.isFinite(effDb) ? dbToRatio(Math.min(MAX_DB, effDb)) * 100 : 0;
  const dimmed = Number.isFinite(effDb) && Math.abs(effDb - (ch.db + settings.masterDb)) > 0.1;
  const silencedByMode = !Number.isFinite(effDb) && ch.playing && !ch.muted && ch.db > MIN_DB;
  const pinned = isChannelPinned(settings.domainDefaults, ch.domain, ch.db);

  r.el.dataset.selected = String(selected);
  r.el.style.backgroundColor = ch.playing ? t.raised : t.surface;
  r.el.style.borderColor = ch.focus ? t.primary : ch.solo ? t.accent : t.border;
  r.el.style.opacity = ch.playing ? "1" : "0.74";
  r.topAccent.style.backgroundColor = ch.focus
    ? t.primary
    : ch.solo
      ? t.accent
      : ch.muted
        ? t.states.danger
        : "transparent";

  r.header.title = `${ch.title}${ch.domain ? ` (${ch.domain})` : ""} — 클릭 시 해당 탭·창으로 이동`;
  r.faviconBox.style.borderColor = ch.focus ? t.primary : t.border;
  r.faviconBox.style.color = ch.focus ? t.primary : ch.solo ? t.accent : t.text;
  if (r.renderedFavIcon !== ch.favIconUrl) {
    r.renderedFavIcon = ch.favIconUrl;
    renderFaviconInto(r.faviconBox, ch.favIconUrl);
  }
  r.hostLabel.textContent = ch.shortHost;
  r.titleEl.textContent = ch.title;

  r.fill.style.height = `${userPct}%`;
  r.fill.style.backgroundColor = ch.muted
    ? t.muted
    : ch.solo
      ? t.accent
      : ch.focus || !(ctx.anyFocus || ctx.anySolo)
        ? t.primary
        : t.muted;
  r.fill.style.opacity = ch.muted ? "0.25" : dimmed || silencedByMode ? "0.45" : "0.85";
  r.corsZone.classList.toggle("hidden", !ch.corsCap);

  for (const { db, el: sEl } of r.scaleItems) {
    sEl.style.color = db === 0 ? t.text : t.muted;
    sEl.style.opacity = ch.corsCap && db > 0 ? "0.32" : db === 0 ? "0.95" : "0.68";
    sEl.style.fontWeight = db === 0 ? "700" : "400";
  }

  if (dimmed || silencedByMode) {
    r.deltaBar.classList.remove("hidden");
    r.deltaBar.style.bottom = `${Math.min(userPct, effPct)}%`;
    r.deltaBar.style.height = `${Math.abs(userPct - effPct)}%`;
    r.deltaBar.style.backgroundColor = t.primary;
    r.deltaBar.style.opacity = "0.45";
    r.ghostCap.classList.remove("hidden");
    r.ghostCap.style.bottom = `calc(${effPct}% - 2.5px)`;
    r.ghostCap.style.borderColor = t.primary;
  } else {
    r.deltaBar.classList.add("hidden");
    r.ghostCap.classList.add("hidden");
  }

  r.knob.style.bottom = `calc(${userPct}% - 7px)`;
  r.knob.style.backgroundColor = ch.focus ? t.primary : ch.solo ? t.accent : t.surface;
  r.knob.style.borderColor = ch.focus ? t.primary : ch.solo ? t.accent : t.muted;
  r.knob.style.color = ch.focus ? t.onPrimary : ch.solo ? t.onAccent : t.text;
  r.knobLine.style.backgroundColor = ch.focus ? t.onPrimary : ch.solo ? t.onAccent : t.text;

  paintLedColumn(r.vu.segs, ch.vuLevel, ch.vuPeak, t);

  if (r.readoutBtn.dataset.editing === "true") {
    r.readoutBtn.style.borderColor = t.primary;
    r.subText.style.color = t.primary;
  } else {
    r.readoutBtn.style.borderColor = t.border;
    r.dbText.textContent = formatDb(ch.db);
    r.dbText.style.color = ch.muted ? t.states.danger : ch.db > 0 ? t.states.warning : t.text;

    if (ch.corsCap) {
      r.subText.textContent = "보안 0dB 상한";
      r.subText.style.color = t.muted;
    } else if (!ch.playing) {
      r.subText.textContent = "일시정지";
      r.subText.style.color = t.muted;
    } else if (ch.muted) {
      r.subText.textContent = "음소거";
      r.subText.style.color = t.states.danger;
    } else if (dimmed || silencedByMode) {
      r.subText.textContent = `실효 ${formatDb(effDb)}dB`;
      r.subText.style.color = t.primary;
    } else {
      r.subText.textContent = pinned ? "도메인 고정" : "개별 볼륨";
      r.subText.style.color = pinned ? t.accent : t.muted;
    }
  }

  r.playBtn.innerHTML = ch.playing
    ? `${ICONS.pause}<span>재생</span>`
    : `${ICONS.play}<span>대기</span>`;
  r.playBtn.style.backgroundColor = ch.playing ? t.surface : t.bg;
  r.playBtn.style.borderColor = ch.playing ? t.primary : t.border;
  r.playBtn.style.color = ch.playing ? t.primary : t.muted;

  const savedDomainDb = ch.domain ? settings.domainDefaults[ch.domain] : undefined;
  r.pinBtn.disabled = !ch.domain;
  r.pinBtn.title = !ch.domain
    ? "도메인 정보를 사용할 수 없는 탭입니다"
    : savedDomainDb !== undefined
      ? `${ch.domain} 기본값 (${formatDb(savedDomainDb)} dB) · 클릭하여 고정/해제`
      : `현재 볼륨(${formatDb(ch.db)} dB)을 ${ch.domain} 새 탭 기본값으로 고정`;
  r.pinBtn.style.backgroundColor = pinned ? t.accent : t.surface;
  r.pinBtn.style.borderColor = pinned ? t.accent : t.border;
  r.pinBtn.style.color = pinned ? t.onAccent : t.muted;
  r.pinDot.style.backgroundColor =
    savedDomainDb !== undefined ? (pinned ? t.onAccent : t.accent) : "transparent";

  syncSwitchStyle(r.muteBtn, r.mutePip, ch.muted, t.states.danger, t.states.onDanger, t);
  syncSwitchStyle(r.soloBtn, r.soloPip, ch.solo, t.accent, t.onAccent, t);
  syncSwitchStyle(r.focusBtn, r.focusPip, ch.focus, t.primary, t.onPrimary, t);
}
