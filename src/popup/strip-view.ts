import { ui } from "../shared/i18n";
import { fxUi } from "../shared/i18n-fx";
import { effectiveModule, effectivePan, resolveEffectiveNormalizer } from "../shared/fx-model";
import {
  clampDb,
  computeDisplayedEffectiveDb,
  dbToRatio,
  formatDb,
  isChannelPinned,
  LED_COUNT,
  MAX_DB,
  formatPan,
  ratioToDb,
  SCALE_TICKS,
  type MixerContextInput,
} from "../shared/mixer-math";
import type { ExclusiveMode, PersistedSettings, TabChannelState, ThemeTokens } from "../shared/types";
import { attachDbInlineEditor } from "./db-inline-editor";
import { ICONS } from "./icons";

/**
 * 개별 채널 스트립의 DOM 생성, 노브 전용 드래그, 슬롯 투톤 게이지(빗금), VU 미터 동기화 뷰 모듈.
 */

export interface StripCallbacks {
  /** keepScope면 선택만 옮기고 고급 FX 범위("모든 채널")는 바꾸지 않는다 (휠·버튼·페이더 조작) */
  onSelectChannel: (tabId: number, keepScope?: boolean) => void;
  /** MASTER BUS를 눌러 고급 FX를 "모든 채널" 범위로 고른다. openRack이면 닫힌 랙도 연다 */
  onSelectFxGlobal: (openRack: boolean) => void;
  onBeginDragChannel: (ev: PointerEvent, tabId: number) => void;
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
  grip: HTMLElement;
  fxChips: HTMLElement[];
  header: HTMLButtonElement;
  faviconBox: HTMLElement;
  hostLabel: HTMLElement;
  titleEl: HTMLElement;
  track: HTMLElement;
  fill: HTMLElement;
  attenBand: HTMLElement;
  corsZone: HTMLElement;
  knob: HTMLElement;
  knobLine: HTMLElement;
  scaleItems: Array<{ db: number; el: HTMLDivElement }>;
  vu: LedColumnRef;
  vuR: LedColumnRef;
  readoutBtn: HTMLElement;
  dbText: HTMLElement;
  subText: HTMLElement;
  playBtn: HTMLButtonElement;
  playIcon: HTMLElement;
  playLabel: HTMLElement;
  pinBtn: HTMLButtonElement;
  pinDot: HTMLElement;
  muteBtn: HTMLButtonElement;
  mutePip: HTMLElement;
  soloBtn: HTMLButtonElement;
  soloPip: HTMLElement;
  focusBtn: HTMLButtonElement;
  focusPip: HTMLElement;
  renderedFavIcon: string;
  renderedPlaying: boolean | null;
}

/**
 * 페이더·슬라이더 노브 전용 포인터 드래그 핸들러.
 * 빈 트랙이나 실효 볼륨 게이지 클릭 시 의도치 않게 노브가 점프하던 미스디렉션을 차단하고,
 * 더블클릭(0.0dB / 기본값 복귀)만 노브와 트랙 모두에서 허용한다.
 */
/** 누른 곳이 스트립의 조작부(버튼·입력·수치창·페이더·grip)인가 */
export function isStripControl(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("button, input, .readout-btn, .fader-track, .fader-cap, .grip-bar"));
}

export function attachKnobDrag(
  knobEl: HTMLElement,
  trackEl: HTMLElement,
  axis: "x" | "y",
  onRatio: (ratio: number) => void,
  onReset?: () => void,
): void {
  if (onReset) {
    const resetHandler = (ev: MouseEvent): void => {
      ev.preventDefault();
      ev.stopPropagation();
      onReset();
    };
    knobEl.addEventListener("dblclick", resetHandler);
    trackEl.addEventListener("dblclick", resetHandler);
  }
  knobEl.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0 || ev.detail >= 2) return;
    ev.preventDefault();
    ev.stopPropagation();
    const apply = (moveEv: PointerEvent): void => {
      const rect = trackEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const raw =
        axis === "y"
          ? 1 - (moveEv.clientY - rect.top) / rect.height
          : (moveEv.clientX - rect.left) / rect.width;
      onRatio(Math.max(0, Math.min(1, raw)));
    };
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
    seg.style.opacity = isLit ? "0.95" : isPeak ? "0.85" : "0.26";
  }
}

export function buildScaleDom(): { wrap: HTMLDivElement; items: Array<{ db: number; el: HTMLDivElement }> } {
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
  if (
    favIconUrl &&
    (favIconUrl.startsWith("http://") ||
      favIconUrl.startsWith("https://") ||
      favIconUrl.startsWith("data:"))
  ) {
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
  const copy = ui();
  const zeroPct = dbToRatio(0) * 100;
  const el = document.createElement("section");
  el.className = "channel-strip";
  el.dataset.tabId = String(initialCh.tabId);
  el.innerHTML = `
    <div data-ref="topAccent" class="strip-top-accent"></div>
    <div data-ref="grip" class="grip-bar" title="${copy.gripTitle}">
      <span class="grip-dots">${ICONS.grip}</span>
      <span class="fx-chips"><i data-chip="norm">N</i><i data-chip="gate">G</i><i data-chip="comp">C</i><i data-chip="pan">P</i></span>
    </div>
    <button data-ref="header" type="button" class="strip-header">
      <div class="strip-header-row1">
        <span data-ref="faviconBox" class="favicon-box">${ICONS.waveBadge}</span>
        <span data-ref="hostLabel" class="host-label truncate"></span>
        <span class="jump-icon">${ICONS.jump}</span>
      </div>
      <div data-ref="titleEl" class="strip-title truncate"></div>
    </button>

    <div data-ref="faderWell" class="fader-well">
      <div data-ref="track" class="fader-track" title="${copy.faderTrackTitle}">
        <span class="unity-wing-l" style="bottom:${zeroPct}%"></span>
        <span class="unity-wing-r" style="bottom:${zeroPct}%"></span>
        <div class="fader-slot">
          <div data-ref="fill" class="fader-fill"></div>
          <div data-ref="attenBand" class="attenuated-band hidden"></div>
          <div data-ref="corsZone" class="cors-zone hidden" style="height:${100 - zeroPct}%"></div>
        </div>
        <div data-ref="knob" class="fader-cap" title="${copy.faderKnobTitle}">
          <span class="cap-groove-sub"></span>
          <span data-ref="knobLine" class="cap-groove-main"></span>
          <span class="cap-groove-sub"></span>
        </div>
      </div>
    </div>

    <div data-ref="readoutBtn" role="button" tabindex="0" title="${copy.readoutTitle}" class="readout-btn c-recessed">
      <div data-ref="displayRow" class="readout-row1">
        <span data-ref="dbText" class="readout-db tabular"></span>
        <span class="readout-unit">dB</span>
      </div>
      <div data-ref="editRow" class="readout-edit-row hidden">
        <input data-ref="dbInput" type="text" inputmode="decimal" spellcheck="false" autocomplete="off" class="readout-input tabular" aria-label="${copy.channelDbAria}" />
        <span class="readout-unit">dB</span>
      </div>
      <div data-ref="subText" class="readout-sub truncate tabular"></div>
    </div>

    <div class="transport-row">
      <button data-ref="playBtn" type="button" class="console-btn play-btn" title="${copy.playToggleTitle}">
        <span data-ref="playIcon"></span><span data-ref="playLabel"></span>
      </button>
      <button data-ref="pinBtn" type="button" class="console-btn pin-btn">
        ${ICONS.pin}
        <span data-ref="pinDot" class="pin-dot"></span>
      </button>
    </div>

    <div class="switch-bank c-recessed">
      <button data-ref="muteBtn" type="button" class="console-btn switch-btn" title="${copy.muteTitle}">
        <span data-ref="mutePip" class="switch-pip"></span><span class="switch-lbl">M</span>
      </button>
      <button data-ref="soloBtn" type="button" class="console-btn switch-btn" title="${copy.soloTitle}">
        <span data-ref="soloPip" class="switch-pip"></span><span class="switch-lbl">S</span>
      </button>
      <button data-ref="focusBtn" type="button" class="console-btn switch-btn" title="${copy.focusTitle}">
        <span data-ref="focusPip" class="switch-pip"></span><span class="switch-lbl">F</span>
      </button>
    </div>
  `;

  const scale = buildScaleDom();
  const vu = createLedColumn();
  const vuR = createLedColumn();
  const stereoPair = document.createElement("div");
  stereoPair.className = "stereo-vu-pair";
  stereoPair.appendChild(vu.col);
  stereoPair.appendChild(vuR.col);
  const well = el.querySelector('[data-ref="faderWell"]')!;
  well.appendChild(scale.wrap);
  well.appendChild(stereoPair);

  const q = <T extends HTMLElement>(name: string): T => el.querySelector(`[data-ref="${name}"]`) as T;
  const refs: ChannelStripRefs = {
    tabId: initialCh.tabId,
    el,
    topAccent: q("topAccent"),
    grip: q("grip"),
    fxChips: Array.from(el.querySelectorAll<HTMLElement>(".fx-chips i")),
    header: q("header"),
    faviconBox: q("faviconBox"),
    hostLabel: q("hostLabel"),
    titleEl: q("titleEl"),
    track: q("track"),
    fill: q("fill"),
    attenBand: q("attenBand"),
    corsZone: q("corsZone"),
    knob: q("knob"),
    knobLine: q("knobLine"),
    scaleItems: scale.items,
    vu,
    vuR,
    readoutBtn: q("readoutBtn"),
    dbText: q("dbText"),
    subText: q("subText"),
    playBtn: q("playBtn"),
    playIcon: q("playIcon"),
    playLabel: q("playLabel"),
    pinBtn: q("pinBtn"),
    pinDot: q("pinDot"),
    muteBtn: q("muteBtn"),
    mutePip: q("mutePip"),
    soloBtn: q("soloBtn"),
    soloPip: q("soloPip"),
    focusBtn: q("focusBtn"),
    focusPip: q("focusPip"),
    renderedFavIcon: "__UNSET__",
    renderedPlaying: null,
  };

  // 스트립 빈 곳을 누르면 그 채널을 고급 FX 대상으로 고르고, 조작부(버튼·페이더·수치창·grip)는 범위를 바꾸지 않는다
  el.addEventListener(
    "pointerdown",
    (ev) => cb.onSelectChannel(initialCh.tabId, isStripControl(ev.target)),
    { passive: true },
  );
  refs.grip.addEventListener("pointerdown", (ev) => cb.onBeginDragChannel(ev, initialCh.tabId));
  el.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      const ch = getLatestCh();
      if (!ch) return;
      cb.onSelectChannel(ch.tabId, true);
      const step = ev.shiftKey ? 0.5 : 1.5;
      const next = clampDb(ch.db + (ev.deltaY < 0 ? step : -step), ch.corsCap);
      cb.onSetTabDb(ch.tabId, next);
    },
    { passive: false },
  );

  attachKnobDrag(
    refs.knob,
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
    onSelect: () => cb.onSelectChannel(initialCh.tabId, true),
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

export function paintChannelStereoVu(
  r: ChannelStripRefs,
  ch: TabChannelState,
  t: ThemeTokens,
  globalPan = 0,
): void {
  const pan = effectivePan(globalPan, ch.fx, ch.corsCap);
  const hasExplicit =
    !ch.corsCap &&
    typeof ch.vuLevelL === "number" &&
    typeof ch.vuLevelR === "number" &&
    (ch.vuLevelL !== ch.vuLevel || ch.vuLevelR !== ch.vuLevel);
  let lvlL = ch.vuLevel;
  let lvlR = ch.vuLevel;
  if (hasExplicit) {
    lvlL = ch.vuLevelL!;
    lvlR = ch.vuLevelR!;
  } else if (!ch.corsCap && ch.vuLevel > 0 && pan !== 0) {
    const amp = Math.pow(10, (-60 + ch.vuLevel * 72) / 20);
    const gL = pan <= 0 ? 1 : Math.cos((pan / 100) * (Math.PI / 2));
    const gR = pan >= 0 ? 1 : Math.cos((-pan / 100) * (Math.PI / 2));
    lvlL = gL <= 0.001 ? 0 : Math.max(0, Math.min(1, (20 * Math.log10(amp * gL) + 60) / 72));
    lvlR = gR <= 0.001 ? 0 : Math.max(0, Math.min(1, (20 * Math.log10(amp * gR) + 60) / 72));
  }
  const peakL = lvlL >= ch.vuPeak ? lvlL : Math.min(ch.vuPeak, lvlL + 0.08);
  const peakR = lvlR >= ch.vuPeak ? lvlR : Math.min(ch.vuPeak, lvlR + 0.08);
  paintLedColumn(r.vu.segs, lvlL, peakL, t);
  paintLedColumn(r.vuR.segs, lvlR, peakR, t);
}

export function syncChannelReadoutSub(
  r: ChannelStripRefs,
  ch: TabChannelState,
  settings: PersistedSettings,
  ctx: MixerContextInput,
  t: ThemeTokens,
): void {
  if (r.readoutBtn.dataset.editing === "true") return;
  const effDb = computeDisplayedEffectiveDb(ch, ctx);
  const userPct = dbToRatio(ch.db) * 100;
  const effPct = Number.isFinite(effDb) ? dbToRatio(Math.min(MAX_DB, effDb)) * 100 : 0;
  const attenuated = (ctx.anyFocus || ctx.anySolo) && ch.playing && !ch.muted && userPct - effPct > 0.5;
  const pinned = isChannelPinned(settings.domainDefaults, ch.domain, ch.db);
  const norm = resolveEffectiveNormalizer(settings.globalFx, ch.fx, ch.corsCap);

  const copy = ui();
  if (ch.corsCap) {
    r.subText.textContent = copy.subCorsCap;
    r.subText.style.color = t.muted;
  } else if (!ch.playing) {
    r.subText.textContent = copy.subPaused;
    r.subText.style.color = t.muted;
  } else if (ch.muted) {
    r.subText.textContent = copy.subMuted;
    r.subText.style.color = t.states.danger;
  } else if (attenuated) {
    r.subText.textContent = copy.subAttenuated(formatDb(effDb));
    r.subText.style.color = ctx.anySolo ? t.accent : t.focus;
  } else if (norm.active) {
    const sign = ch.normTrimDb >= 0 ? "+" : "";
    r.subText.textContent = copy.subNormTrim(`${sign}${ch.normTrimDb.toFixed(1)}`);
    r.subText.style.color = norm.source === "custom-on" ? t.text : t.primary;
  } else {
    r.subText.textContent = pinned ? copy.subPinned : copy.subIndividual;
    r.subText.style.color = pinned ? t.accent : t.muted;
  }
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
  // 페이더는 높지만 실제로 덜/안 들리는 몫(빗금). 빗금 색이 원인을 말한다: 음소거 = 빨강, Solo로 꺼짐 = Solo 색, Focus 감쇠 = Focus 색
  const silencedByMute = ch.muted || settings.masterMuted;
  const attenuated =
    userPct - effPct > 0.5 && (silencedByMute || (ch.playing && (ctx.anySolo || ctx.anyFocus)));
  const hatchColor = silencedByMute
    ? t.states.danger
    : ctx.anySolo && !ch.solo
      ? t.accent
      : t.focus;
  const pinned = isChannelPinned(settings.domainDefaults, ch.domain, ch.db);

  r.el.dataset.selected = String(selected);
  r.el.dataset.zone = ch.playing ? "playing" : "paused";
  r.el.style.backgroundColor = ch.playing ? t.raised : t.surface;
  r.el.style.borderColor = ch.focus ? t.focus : ch.solo ? t.accent : t.border;
  r.el.style.opacity = ch.playing ? "1" : "0.74";
  r.topAccent.style.backgroundColor = ch.focus
    ? t.focus
    : ch.solo
      ? t.accent
      : ch.muted
        ? t.states.danger
        : "transparent";

  const copy = ui();
  syncFxChips(r, ch, settings, t);

  r.header.title = copy.headerJumpTitle(ch.title, ch.domain);
  r.faviconBox.style.borderColor = ch.focus ? t.focus : t.border;
  r.faviconBox.style.color = ch.focus ? t.focus : ch.solo ? t.accent : t.text;
  if (r.renderedFavIcon !== ch.favIconUrl) {
    r.renderedFavIcon = ch.favIconUrl;
    renderFaviconInto(r.faviconBox, ch.favIconUrl);
  }
  r.hostLabel.textContent = ch.shortHost;
  r.titleEl.textContent = ch.title;

  if (attenuated) {
    r.fill.style.height = `${effPct}%`;
    r.fill.style.opacity = "0.9";
    r.attenBand.style.setProperty("--hc", hatchColor);
    r.attenBand.classList.remove("hidden");
    r.attenBand.style.bottom = `${effPct}%`;
    r.attenBand.style.height = `${userPct - effPct}%`;
  } else {
    r.fill.style.height = `${userPct}%`;
    r.fill.style.opacity = "0.85";
    r.attenBand.classList.add("hidden");
  }
  r.fill.style.backgroundColor = ch.solo ? t.accent : ch.focus ? t.focus : t.primary;
  r.corsZone.classList.toggle("hidden", !ch.corsCap);

  for (const { db, el: sEl } of r.scaleItems) {
    sEl.style.color = db === 0 ? t.text : t.muted;
    sEl.style.opacity = ch.corsCap && db > 0 ? "0.32" : db === 0 ? "0.95" : "0.68";
    sEl.style.fontWeight = db === 0 ? "700" : "400";
  }

  r.knob.style.bottom = `calc(${userPct}% - 7px)`;
  r.knob.style.backgroundColor = ch.focus ? t.focus : ch.solo ? t.accent : t.surface;
  r.knob.style.borderColor = ch.focus ? t.focus : ch.solo ? t.accent : ch.muted ? t.states.danger : t.muted;
  r.knob.style.color = ch.focus ? t.onFocus : ch.solo ? t.onAccent : t.text;
  r.knobLine.style.backgroundColor = ch.focus ? t.onFocus : ch.solo ? t.onAccent : t.text;

  paintChannelStereoVu(r, ch, t, settings.globalPan);

  if (r.readoutBtn.dataset.editing === "true") {
    r.readoutBtn.style.borderColor = t.primary;
    r.subText.style.color = t.primary;
  } else {
    r.readoutBtn.style.borderColor = t.border;
    r.dbText.textContent = formatDb(ch.db);
    r.dbText.style.color = ch.muted ? t.states.danger : ch.db > 0 ? t.states.warning : t.text;
    syncChannelReadoutSub(r, ch, settings, ctx, t);
  }

  if (r.renderedPlaying !== ch.playing) {
    r.renderedPlaying = ch.playing;
    r.playIcon.innerHTML = ch.playing ? ICONS.pause : ICONS.play;
    r.playLabel.textContent = ch.playing ? copy.playActiveLabel : copy.playIdleLabel;
  }
  r.playBtn.style.backgroundColor = ch.playing ? t.surface : t.bg;
  r.playBtn.style.borderColor = ch.playing ? t.primary : t.border;
  r.playBtn.style.color = ch.playing ? t.primary : t.muted;

  const savedDomainDb = ch.domain ? settings.domainDefaults[ch.domain] : undefined;
  r.pinBtn.disabled = !ch.domain;
  r.pinBtn.title = !ch.domain
    ? copy.pinDisabledTitle
    : savedDomainDb !== undefined
      ? copy.pinSavedTitle(ch.domain, formatDb(savedDomainDb))
      : copy.pinSetTitle(formatDb(ch.db), ch.domain);
  r.pinBtn.style.backgroundColor = pinned ? t.accent : t.surface;
  r.pinBtn.style.borderColor = pinned ? t.accent : t.border;
  r.pinBtn.style.color = pinned ? t.onAccent : t.muted;
  r.pinDot.style.backgroundColor =
    savedDomainDb !== undefined ? (pinned ? t.onAccent : t.accent) : "transparent";

  syncSwitchStyle(r.muteBtn, r.mutePip, ch.muted, t.states.danger, t.states.onDanger, t);
  syncSwitchStyle(r.soloBtn, r.soloPip, ch.solo, t.accent, t.onAccent, t);
  syncSwitchStyle(r.focusBtn, r.focusPip, ch.focus, t.focus, t.onFocus, t);
}

/** grip 줄의 N·G·C·P 칩: 청록 = 모든 채널 설정을 따라 켜짐, 글자색 칩 = 이 채널만 따로 켜짐, 흐림 = 꺼짐 */
function syncFxChips(r: ChannelStripRefs, ch: TabChannelState, settings: PersistedSettings, t: ThemeTokens): void {
  const copy = fxUi();
  for (const chip of r.fxChips) {
    const key = chip.dataset.chip as "norm" | "gate" | "comp" | "pan";
    let on: boolean;
    let own: boolean;
    let title: string;
    if (key === "pan") {
      const p = effectivePan(settings.globalPan, ch.fx, ch.corsCap);
      on = p !== 0;
      own = ch.fx.pan !== 0;
      title = copy.chipPan(formatPan(p));
    } else {
      const eff = effectiveModule(settings.globalFx, ch.fx, key);
      on = !ch.corsCap && eff.slot.enabled;
      own = eff.own;
      const name = copy.modTitle[key];
      title = on ? (own ? copy.chipOwn(name) : copy.chipFollow(name)) : copy.chipOff(name);
    }
    chip.title = title;
    chip.dataset.state = on ? (own ? "own" : "follow") : "off";
    chip.style.backgroundColor = on ? (own ? t.text : "transparent") : "transparent";
    chip.style.color = on ? (own ? t.bg : t.primary) : t.muted;
    chip.style.borderColor = on ? (own ? t.text : t.primary) : t.border;
    chip.style.opacity = on ? "1" : "0.45";
  }
}
