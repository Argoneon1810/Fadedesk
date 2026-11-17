import { ui } from "../shared/i18n";
import { findPresetParams, resolveEffectiveNormalizer } from "../shared/fx-model";
import type {
  NormParams,
  NormSlot,
  NormVizMode,
  PersistedSettings,
  TabChannelState,
  ThemeTokens,
} from "../shared/types";
import { ICONS } from "./icons";

/**
 * 노멀라이저 음압 & 표적 대표 구간 시각화 모듈 (결정 3-A · 4-2).
 * - 고급 FX 세부 창에서 지금 편집 중인 노멀라이저 슬롯(모든 채널 또는 이 채널)의 구간을 그리고, 잠긴 슬롯은 끌어도 바뀌지 않는다.
 * - 고급 FX 사이드 랙 내부에서 [2D 프리퀀시 스펙트럼(상·하 ↕ 임계선)]과 [1D 수평 구간(좌·우 ↔ 브래킷)] 뷰를 즉시 토글한다.
 * - 상단 `균일 N ▾` 팝오버 하단에도 읽기 전용 실시간 미니 음압·대표 구간 프리뷰 바를 렌더링한다.
 */

export interface NormVisualizerRefs {
  rootEl: HTMLElement;
  modeToggleBtn: HTMLButtonElement;
  spec2dWrap: HTMLElement;
  canvas2d: HTMLCanvasElement;
  handleHigh2d: HTMLElement;
  tagHigh2d: HTMLElement;
  targetLine2d: HTMLElement;
  tagTarget2d: HTMLElement;
  handleLow2d: HTMLElement;
  tagLow2d: HTMLElement;
  bar1dWrap: HTMLElement;
  track1d: HTMLElement;
  fill1d: HTMLElement;
  band1d: HTMLElement;
  targetPin1d: HTMLElement;
  handleLow1d: HTMLElement;
  handleHigh1d: HTMLElement;
  lowLbl1d: HTMLElement;
  targetLbl1d: HTMLElement;
  highLbl1d: HTMLElement;
  stateLblEl: HTMLElement;
  bipolarBar: HTMLElement;
  tensionValEl: HTMLElement;
  tensionInput: HTMLInputElement;
}

export function lufsToRatio(lufs: number): number {
  if (!Number.isFinite(lufs)) return 0;
  return Math.max(0, Math.min(1, (lufs + 60) / 60));
}

export function ratioToLufs(ratio: number): number {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return Math.round(-60 + clamped * 60);
}

export interface NormVisualizerDeps {
  getSlot: () => NormSlot;
  isLocked: () => boolean;
  onLocked: () => void;
  onEditNorm: (patch: Partial<NormParams>) => void;
  getSettings: () => PersistedSettings;
  onToggleVizMode: (nextMode: NormVizMode) => void;
}

export function buildNormVisualizerDom(deps: NormVisualizerDeps): NormVisualizerRefs {
  const { getSettings, onToggleVizMode } = deps;
  const copy = ui();
  const rootEl = document.createElement("div");
  rootEl.className = "norm-viz-deck";
  rootEl.innerHTML = `
    <div class="fx-meta-row">
      <span data-ref="stateLblEl" class="norm-viz-state tabular">${copy.fxStateIdle}</span>
      <button data-ref="modeToggleBtn" type="button" class="console-btn norm-viz-icon-btn" title="${copy.fxVizCollapseTitle}" aria-label="${copy.fxVizCollapseTitle}">${ICONS.vizCollapse}</button>
    </div>

    <div data-ref="spec2dWrap" class="norm-spec2d-box">
      <canvas data-ref="canvas2d" class="norm-spec2d-canvas" width="186" height="84"></canvas>
      <div data-ref="handleHigh2d" class="norm-bound-line norm-bound-high">
        <span data-ref="tagHigh2d" class="norm-bound-tag tabular"></span>
      </div>
      <div data-ref="targetLine2d" class="norm-target-line">
        <span data-ref="tagTarget2d" class="norm-target-tag tabular"></span>
      </div>
      <div data-ref="handleLow2d" class="norm-bound-line norm-bound-low">
        <span data-ref="tagLow2d" class="norm-bound-tag tabular"></span>
      </div>
    </div>

    <div data-ref="bar1dWrap" class="norm-bar1d-box hidden">
      <div data-ref="track1d" class="norm-bar1d-track">
        <div data-ref="fill1d" class="norm-bar1d-fill"></div>
        <div data-ref="band1d" class="norm-bar1d-band"></div>
        <div data-ref="targetPin1d" class="norm-bar1d-target"></div>
        <div data-ref="handleLow1d" class="norm-bar1d-handle"><span class="norm-bar1d-grip">[</span></div>
        <div data-ref="handleHigh1d" class="norm-bar1d-handle"><span class="norm-bar1d-grip">]</span></div>
      </div>
      <div class="norm-bar1d-scale tabular">
        <span data-ref="lowLbl1d"></span>
        <span data-ref="targetLbl1d"></span>
        <span data-ref="highLbl1d"></span>
      </div>
    </div>

    <div class="norm-bipolar-wrap">
      <div class="norm-bipolar-track">
        <span class="norm-bipolar-zero"></span>
        <div data-ref="bipolarBar" class="norm-bipolar-bar"></div>
      </div>
      <div class="fx-meta-row">
        <span class="c-muted">${copy.fxTensionLabel}</span>
        <span data-ref="tensionValEl" class="fx-meta-val tabular">0.35 dB/s</span>
      </div>
      <input data-ref="tensionInput" type="range" min="0.05" max="1.50" step="0.05" value="0.35" class="fx-range" aria-label="${copy.fxTensionAria}" />
    </div>
  `;

  const q = <T extends HTMLElement>(name: string): T =>
    rootEl.querySelector(`[data-ref="${name}"]`) as T;

  const modeToggleBtn = q<HTMLButtonElement>("modeToggleBtn");
  const spec2dWrap = q("spec2dWrap");
  const handleHigh2d = q("handleHigh2d");
  const handleLow2d = q("handleLow2d");
  const track1d = q("track1d");
  const handleLow1d = q("handleLow1d");
  const handleHigh1d = q("handleHigh1d");
  const tensionInput = q<HTMLInputElement>("tensionInput");

  modeToggleBtn.onclick = () => {
    const cur = getSettings().normVizMode ?? "spectrum2d";
    onToggleVizMode(cur === "spectrum2d" ? "bar1d" : "spectrum2d");
  };

  const commitBounds = (isHigh: boolean, nextLufs: number): void => {
    if (deps.isLocked()) return deps.onLocked();
    const cur = deps.getSlot();
    if (isHigh) {
      const high = Math.max(cur.rangeLowLufs + 4, Math.min(-2, nextLufs));
      if (high !== cur.rangeHighLufs) deps.onEditNorm({ rangeHighLufs: high });
    } else {
      const low = Math.min(cur.rangeHighLufs - 4, Math.max(-56, nextLufs));
      if (low !== cur.rangeLowLufs) deps.onEditNorm({ rangeLowLufs: low });
    }
  };

  const bindDrag = (handleEl: HTMLElement, containerEl: HTMLElement, axis: "x" | "y", isHigh: boolean): void => {
    handleEl.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (deps.isLocked()) return deps.onLocked();
      const onMove = (me: PointerEvent): void => {
        const rect = containerEl.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const ratio =
          axis === "y"
            ? 1 - (me.clientY - rect.top) / rect.height
            : (me.clientX - rect.left) / rect.width;
        commitBounds(isHigh, ratioToLufs(ratio));
      };
      const onUp = (): void => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  };

  bindDrag(handleHigh2d, spec2dWrap, "y", true);
  bindDrag(handleLow2d, spec2dWrap, "y", false);
  bindDrag(handleLow1d, track1d, "x", false);
  bindDrag(handleHigh1d, track1d, "x", true);

  tensionInput.oninput = () => {
    if (deps.isLocked()) {
      tensionInput.value = String(deps.getSlot().zeroReturnRate);
      return deps.onLocked();
    }
    deps.onEditNorm({ zeroReturnRate: Number(tensionInput.value) });
  };

  return {
    rootEl,
    modeToggleBtn,
    spec2dWrap,
    canvas2d: q<HTMLCanvasElement>("canvas2d"),
    handleHigh2d,
    tagHigh2d: q("tagHigh2d"),
    targetLine2d: q("targetLine2d"),
    tagTarget2d: q("tagTarget2d"),
    handleLow2d,
    tagLow2d: q("tagLow2d"),
    bar1dWrap: q("bar1dWrap"),
    track1d,
    fill1d: q("fill1d"),
    band1d: q("band1d"),
    targetPin1d: q("targetPin1d"),
    handleLow1d,
    handleHigh1d,
    lowLbl1d: q("lowLbl1d"),
    targetLbl1d: q("targetLbl1d"),
    highLbl1d: q("highLbl1d"),
    stateLblEl: q("stateLblEl"),
    bipolarBar: q("bipolarBar"),
    tensionValEl: q("tensionValEl"),
    tensionInput,
  };
}

function drawSpectrum2dCanvas(
  canvas: HTMLCanvasElement,
  inputLufs: number,
  spectrumBins: readonly number[] | undefined,
  lowLufs: number,
  highLufs: number,
  inBand: boolean,
  t: ThemeTokens,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const padL = 20;

  ctx.clearRect(0, 0, W, H);

  ctx.font = "8px Consolas, monospace";
  ctx.textAlign = "right";
  for (const db of [-12, -24, -36, -48]) {
    const y = (1 - lufsToRatio(db)) * H;
    ctx.strokeStyle = t.border;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = t.muted;
    ctx.fillText(String(db), padL - 2, y + 3);
  }
  ctx.globalAlpha = 1;

  const highY = (1 - lufsToRatio(highLufs)) * H;
  const lowY = (1 - lufsToRatio(lowLufs)) * H;
  ctx.fillStyle = inBand ? t.primary : t.muted;
  ctx.globalAlpha = inBand ? 0.16 : 0.08;
  ctx.fillRect(padL, highY, W - padL, Math.max(2, lowY - highY));
  ctx.globalAlpha = 1;

  const hasRealSpectrum =
    Boolean(spectrumBins && spectrumBins.length >= 4 && spectrumBins.some((v) => v > -59.5));

  if (inputLufs > -59.5) {
    const strokeColor = inBand ? t.primary : inputLufs > highLufs ? t.states.warning : t.muted;
    if (hasRealSpectrum && spectrumBins) {
      ctx.beginPath();
      ctx.moveTo(padL, H);
      spectrumBins.forEach((bDb, idx) => {
        const x = padL + (idx / Math.max(1, spectrumBins.length - 1)) * (W - padL);
        const y = (1 - lufsToRatio(bDb)) * H;
        ctx.lineTo(x, y);
      });
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = strokeColor;
      ctx.globalAlpha = 0.25;
      ctx.fill();

      ctx.beginPath();
      spectrumBins.forEach((bDb, idx) => {
        const x = padL + (idx / Math.max(1, spectrumBins.length - 1)) * (W - padL);
        const y = (1 - lufsToRatio(bDb)) * H;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    const inY = (1 - lufsToRatio(inputLufs)) * H;
    ctx.strokeStyle = inBand ? t.states.success : t.states.warning;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(padL, inY);
    ctx.lineTo(W, inY);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

export function syncNormVisualizerDom(
  v: NormVisualizerRefs,
  ch: TabChannelState | undefined,
  slot: NormSlot,
  settings: PersistedSettings,
  t: ThemeTokens,
): void {
  const copy = ui();
  const vizMode: NormVizMode = settings.normVizMode ?? "spectrum2d";
  const is2d = vizMode === "spectrum2d";

  const toggleTitle = is2d ? copy.fxVizCollapseTitle : copy.fxVizExpandTitle;
  const wantIcon = is2d ? "collapse" : "expand";
  if (v.modeToggleBtn.dataset.iconState !== wantIcon) {
    v.modeToggleBtn.dataset.iconState = wantIcon;
    v.modeToggleBtn.innerHTML = is2d ? ICONS.vizCollapse : ICONS.vizExpand;
  }
  v.modeToggleBtn.title = toggleTitle;
  v.modeToggleBtn.setAttribute("aria-label", toggleTitle);
  v.modeToggleBtn.style.backgroundColor = t.surface;
  v.modeToggleBtn.style.color = t.primary;
  v.modeToggleBtn.style.borderColor = t.border;

  v.spec2dWrap.classList.toggle("hidden", !is2d);
  v.bar1dWrap.classList.toggle("hidden", is2d);

  const resolved = { active: slot.enabled && !ch?.corsCap, targetLufs: slot.targetLufs };
  const bounds = slot;

  const inputLufs =
    ch && ch.playing && !ch.corsCap
      ? typeof ch.inputLufs === "number" && ch.inputLufs > -90
        ? ch.inputLufs
        : ch.vuLevel > 0.02
          ? Math.round((-60 + ch.vuLevel * 60) * 10) / 10
          : -100
      : -100;

  const inBand =
    resolved.active &&
    inputLufs >= bounds.rangeLowLufs &&
    inputLufs <= bounds.rangeHighLufs;

  if (!ch || !ch.playing || !resolved.active || inputLufs <= -59.5) {
    v.stateLblEl.textContent = copy.fxStateIdle;
    v.stateLblEl.style.color = t.muted;
  } else if (inBand) {
    v.stateLblEl.textContent = `${inputLufs.toFixed(1)} · ${copy.fxStateInBand}`;
    v.stateLblEl.style.color = t.primary;
  } else {
    v.stateLblEl.textContent = `${inputLufs.toFixed(1)} · ${copy.fxStateReturnZero}`;
    v.stateLblEl.style.color = t.states.warning;
  }

  const highTopPct = (1 - lufsToRatio(bounds.rangeHighLufs)) * 100;
  const lowTopPct = (1 - lufsToRatio(bounds.rangeLowLufs)) * 100;
  const targetTopPct = (1 - lufsToRatio(resolved.targetLufs)) * 100;

  v.handleHigh2d.style.top = `${highTopPct}%`;
  v.handleLow2d.style.top = `${lowTopPct}%`;
  v.targetLine2d.style.top = `${targetTopPct}%`;
  v.tagHigh2d.textContent = copy.fxBoundHighTag(bounds.rangeHighLufs);
  v.tagLow2d.textContent = copy.fxBoundLowTag(bounds.rangeLowLufs);
  v.tagTarget2d.textContent = copy.fxTargetPinTag(resolved.targetLufs);

  if (is2d) {
    drawSpectrum2dCanvas(
      v.canvas2d,
      inputLufs,
      ch?.spectrumBins,
      bounds.rangeLowLufs,
      bounds.rangeHighLufs,
      inBand,
      t,
    );
  } else {
    const lowPct = lufsToRatio(bounds.rangeLowLufs) * 100;
    const highPct = lufsToRatio(bounds.rangeHighLufs) * 100;
    const targetPct = lufsToRatio(resolved.targetLufs) * 100;
    const inPct = lufsToRatio(inputLufs) * 100;

    v.band1d.style.left = `${lowPct}%`;
    v.band1d.style.width = `${Math.max(2, highPct - lowPct)}%`;
    v.handleLow1d.style.left = `${lowPct}%`;
    v.handleHigh1d.style.left = `${highPct}%`;
    v.targetPin1d.style.left = `${targetPct}%`;
    v.fill1d.style.width = `${inPct}%`;
    v.fill1d.style.backgroundColor = inBand ? t.primary : t.states.warning;

    v.lowLbl1d.textContent = `${bounds.rangeLowLufs}`;
    v.targetLbl1d.textContent = `${copy.fxTargetPinTag(resolved.targetLufs)}`;
    v.highLbl1d.textContent = `${bounds.rangeHighLufs}`;
  }

  const trimDb = ch && resolved.active ? ch.normTrimDb : 0;
  const zeroPct = 64; // -16dB ~ +9dB
  const trimPct = Math.max(0, Math.min(100, ((trimDb + 16) / 25) * 100));
  v.bipolarBar.style.left = `${Math.min(zeroPct, trimPct)}%`;
  v.bipolarBar.style.width = `${Math.max(1.5, Math.abs(trimPct - zeroPct))}%`;
  v.bipolarBar.style.backgroundColor = inBand ? t.primary : t.states.warning;

  v.tensionValEl.textContent = `${bounds.zeroReturnRate.toFixed(2)} dB/s`;
  v.tensionValEl.style.color = t.text;
  if (document.activeElement !== v.tensionInput) {
    v.tensionInput.value = String(bounds.zeroReturnRate);
  }
}

/** 상단 `균일 N ▾` 팝오버 하단 읽기 전용 미니 실시간 음압·대표 구간 바 생성 (결정 4-2 + 호버 프리뷰) */
export function buildPopoverMiniVizDom(
  ch: TabChannelState | undefined,
  settings: PersistedSettings,
  t: ThemeTokens,
): HTMLElement {
  const copy = ui();
  const wrap = document.createElement("div");
  wrap.className = "norm-pop-mini-viz c-recessed";
  wrap.dataset.hoveredPreset = "";
  wrap.innerHTML = `
    <div class="fx-meta-row">
      <span class="c-muted">${copy.normMiniTitle}</span>
      <span data-ref="miniSummary" class="tabular" style="font-weight:700"></span>
    </div>
    <div class="norm-bar1d-track" style="height:10px">
      <div data-ref="miniFill" class="norm-bar1d-fill"></div>
      <div data-ref="miniBand" class="norm-bar1d-band"></div>
      <div data-ref="miniTarget" class="norm-bar1d-target"></div>
      <div data-ref="previewBand" class="norm-bar1d-preview-band hidden"></div>
      <div data-ref="previewTarget" class="norm-bar1d-preview-target hidden"></div>
    </div>
  `;
  syncPopoverMiniVizDom(wrap, ch, settings, t, null);
  return wrap;
}

/** 팝오버 미니 대표 구간 바의 현재 상태 및 프리셋 호버(변경 후 구간) 오버레이 동기화 */
export function syncPopoverMiniVizDom(
  wrap: HTMLElement,
  ch: TabChannelState | undefined,
  settings: PersistedSettings,
  t: ThemeTokens,
  hoveredPreset?: string | null,
): void {
  if (hoveredPreset !== undefined) {
    wrap.dataset.hoveredPreset = hoveredPreset ?? "";
  }
  const activeHover = wrap.dataset.hoveredPreset || "";
  const copy = ui();

  // 팝오버는 "모든 채널" 노멀라이저를 다루므로 구간은 전역 슬롯, 실시간 음압은 선택 채널에서 읽는다
  const bounds = settings.globalFx.norm;
  const resolved = ch
    ? resolveEffectiveNormalizer(settings.globalFx, { own: {}, pan: 0 }, ch.corsCap)
    : { active: settings.globalFx.norm.enabled, targetLufs: bounds.targetLufs };

  const inputLufs =
    ch && ch.playing && !ch.corsCap
      ? typeof ch.inputLufs === "number" && ch.inputLufs > -90
        ? ch.inputLufs
        : ch.vuLevel > 0.02
          ? Math.round((-60 + ch.vuLevel * 60) * 10) / 10
          : -100
      : -100;
  const inBand =
    resolved.active &&
    inputLufs >= bounds.rangeLowLufs &&
    inputLufs <= bounds.rangeHighLufs;

  const lowPct = lufsToRatio(bounds.rangeLowLufs) * 100;
  const highPct = lufsToRatio(bounds.rangeHighLufs) * 100;
  const targetPct = lufsToRatio(resolved.targetLufs) * 100;
  const inPct = lufsToRatio(inputLufs) * 100;

  const statusStr =
    !ch || !ch.playing || inputLufs <= -59.5
      ? copy.fxStateIdle
      : inBand
        ? copy.fxStateInBand
        : copy.fxStateReturnZero;

  const miniSummary = wrap.querySelector<HTMLElement>('[data-ref="miniSummary"]');
  const miniFill = wrap.querySelector<HTMLElement>('[data-ref="miniFill"]');
  const miniBand = wrap.querySelector<HTMLElement>('[data-ref="miniBand"]');
  const miniTarget = wrap.querySelector<HTMLElement>('[data-ref="miniTarget"]');
  const previewBand = wrap.querySelector<HTMLElement>('[data-ref="previewBand"]');
  const previewTarget = wrap.querySelector<HTMLElement>('[data-ref="previewTarget"]');

  if (miniFill) {
    miniFill.style.width = `${inPct}%`;
    miniFill.style.backgroundColor = inBand ? t.primary : t.states.warning;
  }
  if (miniBand) {
    miniBand.style.left = `${lowPct}%`;
    miniBand.style.width = `${Math.max(2, highPct - lowPct)}%`;
  }
  if (miniTarget) {
    miniTarget.style.left = `${targetPct}%`;
  }

  const hoverMeta = activeHover ? findPresetParams(activeHover, settings.userPresets) : null;
  const showPreview =
    Boolean(hoverMeta) &&
    (activeHover !== settings.globalFx.norm.presetId ||
      bounds.rangeLowLufs !== hoverMeta!.rangeLowLufs ||
      bounds.rangeHighLufs !== hoverMeta!.rangeHighLufs ||
      resolved.targetLufs !== hoverMeta!.targetLufs);

  if (showPreview && hoverMeta && previewBand && previewTarget) {
    const pLowPct = lufsToRatio(hoverMeta.rangeLowLufs) * 100;
    const pHighPct = lufsToRatio(hoverMeta.rangeHighLufs) * 100;
    const pTargetPct = lufsToRatio(hoverMeta.targetLufs) * 100;
    previewBand.classList.remove("hidden");
    previewBand.style.left = `${pLowPct}%`;
    previewBand.style.width = `${Math.max(2, pHighPct - pLowPct)}%`;
    previewTarget.classList.remove("hidden");
    previewTarget.style.left = `${pTargetPct}%`;
    if (miniSummary) {
      miniSummary.textContent = copy.fxRangePreview(
        bounds.rangeLowLufs,
        bounds.rangeHighLufs,
        hoverMeta.rangeLowLufs,
        hoverMeta.rangeHighLufs,
      );
      miniSummary.style.color = t.accent;
    }
  } else {
    previewBand?.classList.add("hidden");
    previewTarget?.classList.add("hidden");
    if (miniSummary) {
      miniSummary.textContent = `${copy.fxRangeSummary(bounds.rangeLowLufs, bounds.rangeHighLufs)} · ${statusStr}`;
      miniSummary.style.color = inBand ? t.primary : t.muted;
    }
  }
}
