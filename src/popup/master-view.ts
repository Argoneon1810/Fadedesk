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
  createLedColumn,
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
  vuL: LedColumnRef;
  vuR: LedColumnRef;
  readoutBtn: HTMLElement;
  dbText: HTMLElement;
  dbUnit: HTMLElement;
  subText: HTMLElement;
  pauseAllBtn: HTMLButtonElement;
  muteAllBtn: HTMLButtonElement;
  vuCurL: number;
  vuPeakL: number;
  vuCurR: number;
  vuPeakR: number;
}

export function buildMasterStripDom(
  getMasterDb: () => number,
  cb: StripCallbacks,
): MasterStripRefs {
  const zeroPct = dbToRatio(0) * 100;
  const el = document.createElement("section");
  el.className = "master-strip";
  el.innerHTML = `
    <div data-ref="topAccent" class="strip-top-accent"></div>
    <div class="master-header">
      <div class="master-kicker">MASTER BUS</div>
      <div class="strip-title" style="white-space:nowrap">전체 출력</div>
    </div>
    <div data-ref="faderWell" class="fader-well">
      <div data-ref="track" class="fader-track" title="노브 드래그 · 휠 조절 · 더블클릭 0.0dB 복귀">
        <span class="unity-wing-l" style="bottom:${zeroPct}%"></span>
        <span class="unity-wing-r" style="bottom:${zeroPct}%"></span>
        <div class="fader-slot">
          <div data-ref="fill" class="fader-fill"></div>
        </div>
        <div data-ref="knob" class="fader-cap c-raised" title="노브를 잡아 위아래로 드래그 · 더블클릭 시 0.0dB 복귀">
          <span class="cap-groove-sub" style="width:11px"></span>
          <span data-ref="knobLine" class="cap-groove-main" style="width:14px"></span>
          <span class="cap-groove-sub" style="width:11px"></span>
        </div>
      </div>
    </div>
    <div data-ref="readoutBtn" role="button" tabindex="0" title="클릭하여 마스터 dB 직접 입력 (Enter 적용 · Esc 취소)" class="readout-btn c-recessed">
      <div data-ref="displayRow" class="readout-row1">
        <span data-ref="dbText" class="readout-db tabular"></span>
        <span data-ref="dbUnit" class="readout-unit">dB</span>
      </div>
      <div data-ref="editRow" class="readout-edit-row hidden">
        <input data-ref="dbInput" type="text" inputmode="decimal" spellcheck="false" autocomplete="off" class="readout-input tabular" aria-label="마스터 데시벨 직접 입력" />
        <span class="readout-unit">dB</span>
      </div>
      <div data-ref="subText" class="readout-sub truncate c-muted">마스터 게인</div>
    </div>
    <button data-ref="pauseAllBtn" type="button" class="console-btn master-action-btn c-raised"></button>
    <button data-ref="muteAllBtn" type="button" class="console-btn master-mute-btn"></button>
  `;

  const vuL = createLedColumn();
  const vuR = createLedColumn();
  const well = el.querySelector('[data-ref="faderWell"]')!;
  const track = el.querySelector('[data-ref="track"]')!;
  well.insertBefore(vuL.col, track);
  well.appendChild(vuR.col);

  const q = <T extends HTMLElement>(name: string): T => el.querySelector(`[data-ref="${name}"]`) as T;
  const refs: MasterStripRefs = {
    el,
    topAccent: q("topAccent"),
    track: q("track"),
    fill: q("fill"),
    knob: q("knob"),
    knobLine: q("knobLine"),
    vuL,
    vuR,
    readoutBtn: q("readoutBtn"),
    dbText: q("dbText"),
    dbUnit: q("dbUnit"),
    subText: q("subText"),
    pauseAllBtn: q("pauseAllBtn"),
    muteAllBtn: q("muteAllBtn"),
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

  return refs;
}

export function syncMasterStripDom(
  m: MasterStripRefs,
  settings: PersistedSettings,
  channels: TabChannelState[],
  t: ThemeTokens,
): void {
  const mPct = dbToRatio(settings.masterDb) * 100;
  const anyPlaying = channels.some((c) => c.playing);

  m.topAccent.style.backgroundColor = settings.masterMuted ? t.states.danger : t.primary;
  m.fill.style.height = `${mPct}%`;
  m.fill.style.backgroundColor = settings.masterMuted ? t.muted : t.primary;
  m.fill.style.opacity = settings.masterMuted ? "0.25" : "0.78";
  m.knob.style.bottom = `calc(${mPct}% - 7.5px)`;
  m.knob.style.borderColor = settings.masterMuted ? t.states.danger : t.text;
  m.knobLine.style.backgroundColor = settings.masterMuted ? t.states.danger : t.primary;

  paintLedColumn(m.vuL.segs, m.vuCurL, m.vuPeakL, t);
  paintLedColumn(m.vuR.segs, m.vuCurR, m.vuPeakR, t);

  if (m.readoutBtn.dataset.editing === "true") {
    m.readoutBtn.style.borderColor = t.primary;
    m.subText.style.color = t.primary;
  } else {
    m.readoutBtn.style.borderColor = t.border;
    m.subText.textContent = "마스터 게인";
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
  m.pauseAllBtn.innerHTML = anyPlaying
    ? `${ICONS.pause}<span>전체 정지</span>`
    : `${ICONS.play}<span>전체 재생</span>`;

  m.muteAllBtn.innerHTML = `${ICONS.speakerOff}<span>전체 음소거</span>`;
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
  const { left: tgtL, right: tgtR } = computeMasterStereoVu(channels, settings.masterMuted);
  m.vuCurL = tgtL > m.vuCurL ? m.vuCurL + (tgtL - m.vuCurL) * 0.65 : Math.max(0, m.vuCurL - 0.05);
  m.vuCurR = tgtR > m.vuCurR ? m.vuCurR + (tgtR - m.vuCurR) * 0.65 : Math.max(0, m.vuCurR - 0.05);
  m.vuPeakL = m.vuCurL >= m.vuPeakL ? m.vuCurL : Math.max(m.vuCurL, m.vuPeakL - 0.016);
  m.vuPeakR = m.vuCurR >= m.vuPeakR ? m.vuCurR : Math.max(m.vuCurR, m.vuPeakR - 0.016);

  paintLedColumn(m.vuL.segs, m.vuCurL, m.vuPeakL, t);
  paintLedColumn(m.vuR.segs, m.vuCurR, m.vuPeakR, t);
}
