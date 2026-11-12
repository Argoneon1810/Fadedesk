import {
  AUTO_NORM_PRESET_META,
  DEFAULT_CHANNEL_FX,
  formatPan,
  resolveEffectiveNormalizer,
} from "../shared/mixer-math";
import type {
  ChannelFxState,
  ChannelNormMode,
  CompRatioPreset,
  NormSpeedPreset,
  PersistedSettings,
  TabChannelState,
  ThemeTokens,
} from "../shared/types";

/**
 * 우측 도킹 고급 FX 사이드 랙(`#side-fx-rack`)의 영속 DOM 생성 및 비파괴 상태 동기화 모듈.
 * 슬라이더 드래그 중 80ms VU 갱신이 들어와도 포커스·포인터 캡처가 끊기지 않도록 단일 DOM 인스턴스를 재사용한다.
 */

export interface FxRackRefs {
  container: HTMLElement;
  titleEl: HTMLElement;
  trimBadge: HTMLElement;
  subDescEl: HTMLElement;
  cardsWrap: HTMLElement;
  normHintEl: HTMLElement;
  normModeBtns: Array<{ mode: ChannelNormMode; btn: HTMLButtonElement }>;
  normTargetValEl: HTMLElement;
  normTargetInput: HTMLInputElement;
  normSpeedBtns: Array<{ speed: NormSpeedPreset; btn: HTMLButtonElement }>;
  panResetBtn: HTMLButtonElement;
  panInput: HTMLInputElement;
  gateToggleBtn: HTMLButtonElement;
  gateThValEl: HTMLElement;
  gateThInput: HTMLInputElement;
  compToggleBtn: HTMLButtonElement;
  compRatioBtns: Array<{ ratio: CompRatioPreset; btn: HTMLButtonElement }>;
}

const NORM_MODE_ITEMS: ReadonlyArray<{ mode: ChannelNormMode; label: string }> = [
  { mode: "follow", label: "전역 따름" },
  { mode: "on", label: "개별 ON" },
  { mode: "off", label: "개별 OFF" },
];

const NORM_SPEED_ITEMS: ReadonlyArray<{ speed: NormSpeedPreset; label: string }> = [
  { speed: "slow", label: "완만" },
  { speed: "std", label: "표준" },
  { speed: "fast", label: "민감" },
];

const COMP_RATIO_ITEMS: ReadonlyArray<{ ratio: CompRatioPreset; label: string }> = [
  { ratio: 2, label: "약 2:1" },
  { ratio: 4, label: "중 4:1" },
  { ratio: 8, label: "강 8:1" },
];

export function buildFxRackDom(
  container: HTMLElement,
  getSelectedChannel: () => TabChannelState | undefined,
  onUpdateFx: (tabId: number, patch: Partial<ChannelFxState>) => void,
): FxRackRefs {
  container.innerHTML = `
    <div class="fx-rack-header">
      <div class="fx-rack-title-row">
        <span data-ref="titleEl" class="fx-rack-title truncate">채널 미선택</span>
        <span data-ref="trimBadge" class="fx-trim-badge c-recessed tabular">보정 OFF</span>
      </div>
      <div data-ref="subDescEl" class="fx-rack-sub c-muted truncate">활성 미디어 탭을 선택하세요</div>
    </div>

    <div data-ref="cardsWrap" class="fx-cards-wrap">
      <section class="fx-card c-recessed">
        <div class="fx-card-head">
          <span class="fx-card-title">노멀라이저</span>
          <span data-ref="normHintEl" class="fx-card-hint c-muted tabular">표준 -16</span>
        </div>
        <div data-ref="normModeGrid" class="fx-seg-grid3"></div>
        <div class="fx-meta-row">
          <span class="c-muted">개별 목표 음압</span>
          <span data-ref="normTargetValEl" class="fx-meta-val tabular">-16 LUFS</span>
        </div>
        <input data-ref="normTargetInput" type="range" min="-20" max="-12" step="1" value="-16" class="fx-range" aria-label="개별 목표 음압 LUFS" />
        <div data-ref="normSpeedGrid" class="fx-seg-grid3"></div>
      </section>

      <section class="fx-card c-recessed">
        <div class="fx-card-head">
          <span class="fx-card-title">패닝 (Pan)</span>
          <button data-ref="panResetBtn" type="button" class="console-btn fx-mini-btn tabular" title="클릭 시 중앙(C) 복귀">C</button>
        </div>
        <div class="fx-pan-ticks c-muted">
          <span>L100</span><span>C</span><span>R100</span>
        </div>
        <input data-ref="panInput" type="range" min="-100" max="100" step="5" value="0" class="fx-range" aria-label="스테레오 좌우 패닝" />
      </section>

      <section class="fx-card c-recessed">
        <div class="fx-card-head">
          <span class="fx-card-title">노이즈 게이트</span>
          <button data-ref="gateToggleBtn" type="button" class="console-btn fx-mini-btn">OFF</button>
        </div>
        <div class="fx-meta-row">
          <span class="c-muted">바닥 차단</span>
          <span data-ref="gateThValEl" class="fx-meta-val tabular">-48 dB</span>
        </div>
        <input data-ref="gateThInput" type="range" min="-65" max="-30" step="1" value="-48" class="fx-range" aria-label="노이즈 게이트 임계값 dB" />
      </section>

      <section class="fx-card c-recessed">
        <div class="fx-card-head">
          <span class="fx-card-title">컴프레서</span>
          <button data-ref="compToggleBtn" type="button" class="console-btn fx-mini-btn">OFF</button>
        </div>
        <div data-ref="compRatioGrid" class="fx-seg-grid3"></div>
      </section>
    </div>
  `;

  const q = <T extends HTMLElement>(name: string): T =>
    container.querySelector(`[data-ref="${name}"]`) as T;

  const normModeGrid = q("normModeGrid");
  const normModeBtns = NORM_MODE_ITEMS.map(({ mode, label }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "console-btn fx-seg-btn";
    btn.textContent = label;
    btn.onclick = () => {
      const ch = getSelectedChannel();
      if (!ch || ch.corsCap) return;
      onUpdateFx(ch.tabId, { normMode: mode });
    };
    normModeGrid.appendChild(btn);
    return { mode, btn };
  });

  const normSpeedGrid = q("normSpeedGrid");
  const normSpeedBtns = NORM_SPEED_ITEMS.map(({ speed, label }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "console-btn fx-seg-btn";
    btn.textContent = label;
    btn.onclick = () => {
      const ch = getSelectedChannel();
      if (!ch || ch.corsCap) return;
      const nextMode: ChannelNormMode = ch.fx.normMode === "follow" ? "on" : ch.fx.normMode;
      onUpdateFx(ch.tabId, { normMode: nextMode, normSpeed: speed });
    };
    normSpeedGrid.appendChild(btn);
    return { speed, btn };
  });

  const compRatioGrid = q("compRatioGrid");
  const compRatioBtns = COMP_RATIO_ITEMS.map(({ ratio, label }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "console-btn fx-seg-btn";
    btn.textContent = label;
    btn.onclick = () => {
      const ch = getSelectedChannel();
      if (!ch || ch.corsCap) return;
      onUpdateFx(ch.tabId, { compRatio: ratio });
    };
    compRatioGrid.appendChild(btn);
    return { ratio, btn };
  });

  const normTargetInput = q<HTMLInputElement>("normTargetInput");
  normTargetInput.oninput = () => {
    const ch = getSelectedChannel();
    if (!ch || ch.corsCap) return;
    const nextMode: ChannelNormMode = ch.fx.normMode === "follow" ? "on" : ch.fx.normMode;
    onUpdateFx(ch.tabId, {
      normMode: nextMode,
      normTargetLufs: Number(normTargetInput.value),
    });
  };

  const panInput = q<HTMLInputElement>("panInput");
  panInput.oninput = () => {
    const ch = getSelectedChannel();
    if (!ch || ch.corsCap) return;
    onUpdateFx(ch.tabId, { pan: Number(panInput.value) });
  };
  panInput.ondblclick = () => {
    const ch = getSelectedChannel();
    if (!ch || ch.corsCap) return;
    onUpdateFx(ch.tabId, { pan: 0 });
  };

  const panResetBtn = q<HTMLButtonElement>("panResetBtn");
  panResetBtn.onclick = () => {
    const ch = getSelectedChannel();
    if (!ch || ch.corsCap) return;
    onUpdateFx(ch.tabId, { pan: 0 });
  };

  const gateToggleBtn = q<HTMLButtonElement>("gateToggleBtn");
  gateToggleBtn.onclick = () => {
    const ch = getSelectedChannel();
    if (!ch || ch.corsCap) return;
    onUpdateFx(ch.tabId, { gateEnabled: !ch.fx.gateEnabled });
  };

  const gateThInput = q<HTMLInputElement>("gateThInput");
  gateThInput.oninput = () => {
    const ch = getSelectedChannel();
    if (!ch || ch.corsCap) return;
    onUpdateFx(ch.tabId, { gateThresholdDb: Number(gateThInput.value) });
  };

  const compToggleBtn = q<HTMLButtonElement>("compToggleBtn");
  compToggleBtn.onclick = () => {
    const ch = getSelectedChannel();
    if (!ch || ch.corsCap) return;
    onUpdateFx(ch.tabId, { compEnabled: !ch.fx.compEnabled });
  };

  return {
    container,
    titleEl: q("titleEl"),
    trimBadge: q("trimBadge"),
    subDescEl: q("subDescEl"),
    cardsWrap: q("cardsWrap"),
    normHintEl: q("normHintEl"),
    normModeBtns,
    normTargetValEl: q("normTargetValEl"),
    normTargetInput,
    normSpeedBtns,
    panResetBtn,
    panInput,
    gateToggleBtn,
    gateThValEl: q("gateThValEl"),
    gateThInput,
    compToggleBtn,
    compRatioBtns,
  };
}

export function syncFxRackTrimBadge(
  r: FxRackRefs,
  ch: TabChannelState | undefined,
  settings: PersistedSettings,
  t: ThemeTokens,
): void {
  if (!ch) {
    r.trimBadge.textContent = "대기";
    r.trimBadge.style.color = t.muted;
    return;
  }
  const resolved = resolveEffectiveNormalizer(
    settings.autoNormEnabled,
    ch.fx,
    ch.corsCap,
    settings.autoNormPreset,
  );
  if (ch.corsCap) {
    r.trimBadge.textContent = "보안 0dB · 우회";
    r.trimBadge.style.color = t.states.warning;
  } else if (resolved.active) {
    const sign = ch.normTrimDb >= 0 ? "+" : "";
    r.trimBadge.textContent = `보정 ${sign}${ch.normTrimDb.toFixed(1)}dB`;
    r.trimBadge.style.color = resolved.source === "custom-on" ? t.accent : t.primary;
  } else {
    r.trimBadge.textContent = "보정 OFF";
    r.trimBadge.style.color = t.muted;
  }
}

function paintMiniToggle(btn: HTMLButtonElement, active: boolean, t: ThemeTokens): void {
  btn.style.backgroundColor = active ? t.primary : t.surface;
  btn.style.color = active ? t.onPrimary : t.muted;
  btn.style.borderColor = active ? t.primary : t.border;
  btn.style.fontWeight = active ? "700" : "500";
}

export function syncFxRackDom(
  r: FxRackRefs,
  ch: TabChannelState | undefined,
  settings: PersistedSettings,
  t: ThemeTokens,
): void {
  r.container.classList.toggle("hidden", !settings.advRackOpen);
  if (!settings.advRackOpen) return;

  const fx = ch?.fx ?? DEFAULT_CHANNEL_FX;
  const disabled = !ch || ch.corsCap;
  r.cardsWrap.classList.toggle("fx-cards-disabled", disabled);

  const presetMeta =
    AUTO_NORM_PRESET_META[settings.autoNormPreset] ?? AUTO_NORM_PRESET_META.standard;

  if (!ch) {
    r.titleEl.textContent = "활성 채널 없음";
    r.subDescEl.textContent = "미디어 재생 시 채널별 고급 FX가 활성화됩니다";
  } else if (ch.corsCap) {
    r.titleEl.textContent = ch.title;
    r.subDescEl.textContent = "교차 출처·DRM 보안으로 DSP 자동 우회";
  } else {
    const resolved = resolveEffectiveNormalizer(
      settings.autoNormEnabled,
      fx,
      false,
      settings.autoNormPreset,
    );
    const modeNote =
      resolved.source === "custom-on"
        ? "개별 고정 ON"
        : resolved.source === "custom-off"
          ? "전역 제외 OFF"
          : settings.autoNormEnabled
            ? `전역 균일(${presetMeta.shortLabel})`
            : "전역 대기";
    r.titleEl.textContent = ch.title;
    r.subDescEl.textContent = `${ch.shortHost} · ${modeNote}`;
  }

  syncFxRackTrimBadge(r, ch, settings, t);

  r.normHintEl.textContent =
    fx.normMode === "follow"
      ? `${presetMeta.shortLabel} ${presetMeta.targetLufs}`
      : `개별 ${fx.normTargetLufs}`;
  for (const { mode, btn } of r.normModeBtns) {
    const active = fx.normMode === mode;
    const isCustomOn = mode === "on";
    const isFollowLit = mode === "follow" && settings.autoNormEnabled;
    btn.style.backgroundColor = active
      ? isCustomOn
        ? t.accent
        : isFollowLit
          ? t.primary
          : t.raised
      : t.surface;
    btn.style.color = active
      ? isCustomOn
        ? t.onAccent
        : isFollowLit
          ? t.onPrimary
          : t.text
      : t.muted;
    btn.style.borderColor = active ? (isCustomOn ? t.accent : t.primary) : t.border;
    btn.style.fontWeight = active ? "700" : "500";
  }

  r.normTargetValEl.textContent = `${fx.normTargetLufs} LUFS`;
  r.normTargetValEl.style.color = t.text;
  if (document.activeElement !== r.normTargetInput) {
    r.normTargetInput.value = String(fx.normTargetLufs);
  }
  for (const { speed, btn } of r.normSpeedBtns) {
    paintMiniToggle(btn, fx.normSpeed === speed, t);
  }

  r.panResetBtn.textContent = formatPan(fx.pan);
  paintMiniToggle(r.panResetBtn, fx.pan !== 0, t);
  if (document.activeElement !== r.panInput) {
    r.panInput.value = String(fx.pan);
  }

  r.gateToggleBtn.textContent = fx.gateEnabled ? "ON" : "OFF";
  paintMiniToggle(r.gateToggleBtn, fx.gateEnabled, t);
  r.gateThValEl.textContent = `${fx.gateThresholdDb} dB`;
  r.gateThValEl.style.color = t.text;
  if (document.activeElement !== r.gateThInput) {
    r.gateThInput.value = String(fx.gateThresholdDb);
  }

  r.compToggleBtn.textContent = fx.compEnabled ? "ON" : "OFF";
  paintMiniToggle(r.compToggleBtn, fx.compEnabled, t);
  for (const { ratio, btn } of r.compRatioBtns) {
    paintMiniToggle(btn, fx.compRatio === ratio, t);
  }
}
