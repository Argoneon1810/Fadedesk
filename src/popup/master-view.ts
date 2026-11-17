import { ui } from "../shared/i18n";
import { fxUi } from "../shared/i18n-fx";
import { effectivePan } from "../shared/fx-model";
import {
  clampDb,
  computeMasterStereoVu,
  dbToRatio,
  formatDb,
  ratioToDb,
} from "../shared/mixer-math";
import type { PersistedSettings, TabChannelState, ThemeTokens } from "../shared/types";
import { attachDbInlineEditor } from "./db-inline-editor";
import { ICONS } from "./icons";
import {
  attachKnobDrag,
  buildScaleDom,
  createLedColumn,
  isStripControl,
  paintLedColumn,
  type LedColumnRef,
  type StripCallbacks,
} from "./strip-view";

/**
 * 우측 고정 MASTER BUS 스트립의 DOM 생성, 선형 진폭 RSS 스테레오 VU 미터, 마스터 제어 동기화 모듈.
 */

export interface MasterStripRefs {
  el: HTMLElement;
  topAccent: HTMLElement;
  track: HTMLElement;
  fill: HTMLElement;
  knob: HTMLElement;
  knobLine: HTMLElement;
  scaleItems: Array<{ db: number; el: HTMLDivElement }>;
  vuL: LedColumnRef;
  vuR: LedColumnRef;
  readoutBtn: HTMLElement;
  dbText: HTMLElement;
  dbUnit: HTMLElement;
  subText: HTMLElement;
  pauseAllBtn: HTMLButtonElement;
  pauseAllIcon: HTMLElement;
  pauseAllLabel: HTMLElement;
  muteAllBtn: HTMLButtonElement;
  fxBtn: HTMLButtonElement;
  renderedAnyPlaying: boolean | null;
  vuCurL: number;
  vuPeakL: number;
  vuCurR: number;
  vuPeakR: number;
}

export function buildMasterStripDom(
  getMasterDb: () => number,
  cb: StripCallbacks,
): MasterStripRefs {
  const copy = ui();
  const zeroPct = dbToRatio(0) * 100;
  const el = document.createElement("section");
  el.className = "master-strip";
  el.innerHTML = `
    <div data-ref="topAccent" class="strip-top-accent"></div>
    <div class="master-header">
      <div class="master-kicker">MASTER BUS</div>
      <div class="strip-title" style="white-space:nowrap">${copy.masterTitle}</div>
    </div>
    <button data-ref="fxBtn" type="button" class="console-btn master-fx-btn" title="${fxUi().masterFxTitle}">${fxUi().masterFxBtn}</button>
    <div data-ref="faderWell" class="fader-well">
      <div data-ref="track" class="fader-track" title="${copy.masterTrackTitle}">
        <span class="unity-wing-l" style="bottom:${zeroPct}%"></span>
        <span class="unity-wing-r" style="bottom:${zeroPct}%"></span>
        <div class="fader-slot">
          <div data-ref="fill" class="fader-fill"></div>
        </div>
        <div data-ref="knob" class="fader-cap c-raised" title="${copy.faderKnobTitle}">
          <span class="cap-groove-sub" style="width:11px"></span>
          <span data-ref="knobLine" class="cap-groove-main" style="width:14px"></span>
          <span class="cap-groove-sub" style="width:11px"></span>
        </div>
      </div>
    </div>
    <div data-ref="readoutBtn" role="button" tabindex="0" title="${copy.masterReadoutTitle}" class="readout-btn c-recessed">
      <div data-ref="displayRow" class="readout-row1">
        <span data-ref="dbText" class="readout-db tabular"></span>
        <span data-ref="dbUnit" class="readout-unit">dB</span>
      </div>
      <div data-ref="editRow" class="readout-edit-row hidden">
        <input data-ref="dbInput" type="text" inputmode="decimal" spellcheck="false" autocomplete="off" class="readout-input tabular" aria-label="${copy.masterInputAria}" />
        <span class="readout-unit">dB</span>
      </div>
      <div data-ref="subText" class="readout-sub truncate c-muted">${copy.masterSub}</div>
    </div>
    <button data-ref="pauseAllBtn" type="button" class="console-btn master-action-btn c-raised">
      <span data-ref="pauseAllIcon"></span><span data-ref="pauseAllLabel"></span>
    </button>
    <button data-ref="muteAllBtn" type="button" class="console-btn master-mute-btn">
      <span>${ICONS.speakerOff}</span><span>${copy.masterMuteAll}</span>
    </button>
  `;

  const scale = buildScaleDom();
  const vuL = createLedColumn();
  const vuR = createLedColumn();
  const stereoPair = document.createElement("div");
  stereoPair.className = "stereo-vu-pair";
  stereoPair.appendChild(vuL.col);
  stereoPair.appendChild(vuR.col);
  const well = el.querySelector('[data-ref="faderWell"]')!;
  well.appendChild(scale.wrap);
  well.appendChild(stereoPair);

  const q = <T extends HTMLElement>(name: string): T => el.querySelector(`[data-ref="${name}"]`) as T;
  const refs: MasterStripRefs = {
    el,
    topAccent: q("topAccent"),
    track: q("track"),
    fill: q("fill"),
    knob: q("knob"),
    knobLine: q("knobLine"),
    scaleItems: scale.items,
    vuL,
    vuR,
    readoutBtn: q("readoutBtn"),
    dbText: q("dbText"),
    dbUnit: q("dbUnit"),
    subText: q("subText"),
    pauseAllBtn: q("pauseAllBtn"),
    pauseAllIcon: q("pauseAllIcon"),
    pauseAllLabel: q("pauseAllLabel"),
    muteAllBtn: q("muteAllBtn"),
    fxBtn: q("fxBtn"),
    renderedAnyPlaying: null,
    vuCurL: 0,
    vuPeakL: 0,
    vuCurR: 0,
    vuPeakR: 0,
  };

  el.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      const step = ev.shiftKey ? 0.5 : 1.5;
      cb.onSetMasterDb(clampDb(getMasterDb() + (ev.deltaY < 0 ? step : -step), false));
    },
    { passive: false },
  );

  attachKnobDrag(
    refs.knob,
    refs.track,
    "y",
    (ratio) => cb.onSetMasterDb(ratioToDb(ratio, false)),
    () => cb.onSetMasterDb(0),
  );
  attachDbInlineEditor({
    box: refs.readoutBtn,
    displayRow: q("displayRow"),
    editRow: q("editRow"),
    input: q<HTMLInputElement>("dbInput"),
    subEl: refs.subText,
    getCurrentDb: () => getMasterDb(),
    isCorsCapped: () => false,
    onCommitDb: (nextDb) => cb.onSetMasterDb(nextDb),
    onAfterExit: () => cb.onRefreshUi(),
  });
  refs.pauseAllBtn.onclick = () => cb.onToggleAllPlaying();
  refs.muteAllBtn.onclick = () => cb.onToggleMasterMute();
  // 마스터 빈 곳을 누르면 "모든 채널"을 고르고, 조작부(전체 FX 버튼 제외)는 범위를 바꾸지 않는다
  el.addEventListener(
    "pointerdown",
    (ev) => {
      if (isStripControl(ev.target) && !(ev.target as Element).closest(".master-fx-btn")) return;
      cb.onSelectFxGlobal(false);
    },
    { passive: true },
  );
  refs.fxBtn.onclick = () => cb.onSelectFxGlobal(true);

  return refs;
}

export function syncMasterStripDom(
  m: MasterStripRefs,
  settings: PersistedSettings,
  channels: TabChannelState[],
  t: ThemeTokens,
  fxGlobalSelected = false,
): void {
  const mPct = dbToRatio(settings.masterDb) * 100;
  const fxSel = fxGlobalSelected && settings.advRackOpen;
  m.el.dataset.selected = String(fxSel);
  m.fxBtn.style.backgroundColor = fxSel ? t.primary : "transparent";
  m.fxBtn.style.color = fxSel ? t.onPrimary : t.primary;
  m.fxBtn.style.borderColor = t.primary;
  m.fxBtn.setAttribute("aria-pressed", String(fxSel));
  const anyPlaying = channels.some((c) => c.playing);

  m.topAccent.style.backgroundColor = settings.masterMuted ? t.states.danger : t.primary;
  m.fill.style.height = `${mPct}%`;
  m.fill.style.backgroundColor = settings.masterMuted ? t.muted : t.primary;
  m.fill.style.opacity = settings.masterMuted ? "0.25" : "0.78";
  m.knob.style.bottom = `calc(${mPct}% - 7.5px)`;
  m.knob.style.borderColor = settings.masterMuted ? t.states.danger : t.text;
  m.knobLine.style.backgroundColor = settings.masterMuted ? t.states.danger : t.primary;

  for (const { db, el: sEl } of m.scaleItems) {
    sEl.style.color = db === 0 ? t.text : t.muted;
    sEl.style.opacity = db === 0 ? "0.95" : "0.68";
    sEl.style.fontWeight = db === 0 ? "700" : "400";
  }

  paintLedColumn(m.vuL.segs, m.vuCurL, m.vuPeakL, t);
  paintLedColumn(m.vuR.segs, m.vuCurR, m.vuPeakR, t);

  const copy = ui();
  if (m.readoutBtn.dataset.editing === "true") {
    m.readoutBtn.style.borderColor = t.primary;
    m.subText.style.color = t.primary;
  } else {
    m.readoutBtn.style.borderColor = t.border;
    m.subText.textContent = copy.masterSub;
    m.subText.style.color = t.muted;
    m.dbText.textContent = settings.masterMuted ? "MUTE" : formatDb(settings.masterDb);
    m.dbText.style.color = settings.masterMuted
      ? t.states.danger
      : settings.masterDb > 0
        ? t.states.warning
        : t.text;
    m.dbUnit.style.display = settings.masterMuted ? "none" : "inline";
  }

  m.pauseAllBtn.disabled = channels.length === 0;
  if (m.renderedAnyPlaying !== anyPlaying) {
    m.renderedAnyPlaying = anyPlaying;
    m.pauseAllIcon.innerHTML = anyPlaying ? ICONS.pause : ICONS.play;
    m.pauseAllLabel.textContent = anyPlaying ? copy.masterPauseAll : copy.masterPlayAll;
  }

  m.muteAllBtn.style.backgroundColor = settings.masterMuted ? t.states.danger : t.raised;
  m.muteAllBtn.style.borderColor = settings.masterMuted ? t.states.danger : t.border;
  m.muteAllBtn.style.color = settings.masterMuted ? t.states.onDanger : t.text;
  m.muteAllBtn.style.fontWeight = settings.masterMuted ? "700" : "500";
}

export function updateMasterBusVu(
  m: MasterStripRefs,
  settings: PersistedSettings,
  channels: TabChannelState[],
  t: ThemeTokens,
): void {
  const { left: tgtL, right: tgtR } = computeMasterStereoVu(
    channels.map((c) => ({ ...c, pan: effectivePan(settings.globalPan, c.fx, c.corsCap) })),
    settings.masterMuted,
  );
  m.vuCurL = tgtL > m.vuCurL ? m.vuCurL + (tgtL - m.vuCurL) * 0.65 : Math.max(0, m.vuCurL - 0.05);
  m.vuCurR = tgtR > m.vuCurR ? m.vuCurR + (tgtR - m.vuCurR) * 0.65 : Math.max(0, m.vuCurR - 0.05);
  m.vuPeakL = m.vuCurL >= m.vuPeakL ? m.vuCurL : Math.max(m.vuCurL, m.vuPeakL - 0.016);
  m.vuPeakR = m.vuCurR >= m.vuPeakR ? m.vuCurR : Math.max(m.vuCurR, m.vuPeakR - 0.016);

  paintLedColumn(m.vuL.segs, m.vuCurL, m.vuPeakL, t);
  paintLedColumn(m.vuR.segs, m.vuCurR, m.vuPeakR, t);
}
