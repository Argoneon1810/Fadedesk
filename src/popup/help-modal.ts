import type { ThemeTokens } from "../shared/types";

/**
 * Sound Manager 0.4.0 튜토리얼 안내 모달 & 중첩 시각 용어 카드 뷰 모듈.
 * 실물 부품 용어 8종에 대해 인라인 SVG 스키매틱 하이라이트 및 호버/클릭 고정 상태 머신 제공 (< 420 lines).
 */

export type HelpTermKey = "fader" | "knob" | "meter" | "readout" | "grip" | "switchBank" | "pin" | "masterBus";

export interface HelpModalRefs {
  backdrop: HTMLElement;
  isNestedPinned: () => boolean;
  clearNestedPin: () => void;
}

interface TermInfo {
  name: string;
  subtitle: string;
  description: string;
}

const TERM_INFO: Record<HelpTermKey, TermInfo> = {
  fader: { name: "페이더 (Fader)", subtitle: "채널 중앙 세로 볼륨 레일 · 조작부", description: "채널 중앙의 볼륨 조절 레일과 슬롯 전체입니다. 위아래로 드래그하거나 휠을 굴려 증폭(+12dB) 및 감쇠(-60dB)를 조절합니다." },
  knob: { name: "노브 (Knob)", subtitle: "볼륨 조절 사각 캡 · 조작부", description: "페이더 및 상단 Focus 슬라이더 위에서 마우스로 잡고 움직이는 사각 캡입니다. 더블클릭하면 기본값(0.0dB)으로 즉시 복귀합니다." },
  meter: { name: "레벨 미터 (Level Meter)", subtitle: "실시간 출력 음량 20단 컬러 막대 · 표시부", description: "실제 출력 음량에 맞춰 실시간으로 점등되는 우측 20단 컬러 막대입니다. 소리가 너무 커서 찌그러지지 않는지 한눈에 확인합니다." },
  readout: { name: "수치 표시창 (Readout)", subtitle: "볼륨 숫자 직접 입력창 · 표시창", description: "페이더 아래 현재 볼륨 숫자를 보여주는 창입니다. 클릭하면 원하는 dB 숫자를 키보드로 직접 입력할 수 있습니다." },
  grip: { name: "드래그 핸들 (Grip Handle)", subtitle: "채널 맨 위 6점(⠿) 이동 손잡이 · 조작부", description: "채널 맨 위 점 6개 모양의 순서·구역 이동 손잡이입니다. 좌우로 끌어 순서를 바꾸거나, 우측 대기 구역에 놓아 즉시 일시정지합니다." },
  switchBank: { name: "스위치 뱅크 (Switch Bank)", subtitle: "M · S · F 3버튼 묶음 · 조작부", description: "채널 맨 아래 3개 버튼입니다. M(음소거), S(단독 청취), F(선택 탭 외 자동 감쇠)로 여러 탭 간의 청취 집중도를 빠르게 제어합니다." },
  pin: { name: "도메인 핀 (Domain Pin)", subtitle: "사이트 기본 볼륨 고정 스위치 · 조작부", description: "재생 버튼 옆 압정 모양 스위치입니다. 켜 두면 이후 같은 사이트를 새 탭으로 열 때 현재 볼륨이 시작 기본값으로 자동 적용됩니다." },
  masterBus: { name: "마스터 버스 (Master Bus)", subtitle: "우측 전체 출력 전용 스트립 · 조작부", description: "콘솔 오른쪽에 고정된 전체 출력 전용 스트립입니다. 모든 탭의 출력 음량을 한 번에 조절하고 전체 일괄 정지·음소거를 제어합니다." },
};

const TERM_CHIP_MAP: Record<string, HelpTermKey> = {
  "페이더": "fader", "노브": "knob", "레벨 미터": "meter", "수치 표시창": "readout",
  "드래그 핸들": "grip", "스위치 뱅크": "switchBank", "도메인 핀": "pin", "마스터 버스": "masterBus",
};

interface HelpStep {
  title: string;
  bullets: string[];
}

const EASY_STEPS: HelpStep[] = [
  {
    title: "탭별 볼륨 조절과 직접 입력",
    bullets: [
      "모든 창의 재생 탭을 한곳에서 개별 제어합니다.",
      "채널 중앙 [페이더]의 사각 [노브]를 잡고 위아래로 드래그하거나 마우스 휠을 굴려 볼륨을 조절합니다(0 눈금 위로 올리면 원본 최대치 이상으로 증폭되며 우측 [레벨 미터]로 현재 출력 크기를 확인).",
      "아래 [수치 표시창]을 클릭하면 숫자를 직접 입력할 수 있고, [노브]를 더블클릭하면 기본값(0.0)으로 복귀합니다.",
    ],
  },
  {
    title: "자동 볼륨 균일화 (균일 N)",
    bullets: [
      "영상·음원마다 제각각인 볼륨 편차를 자동으로 맞춥니다.",
      "상단 균일 N을 켜 두면 탭마다 기준 볼륨이 다르거나 다음 곡·쇼츠로 넘어갈 때, 지나치게 큰 소리는 낮추고 작은 소리는 끌어올려 [노브]를 매번 다시 만지지 않아도 일정한 청취 볼륨을 유지합니다.",
    ],
  },
  {
    title: "집중 청취와 전체 제어 (M · S · F & 마스터)",
    bullets: [
      "주목할 탭만 또렷하게 남기고 배경 탭 볼륨을 정리합니다.",
      "하단 [스위치 뱅크]에서 F를 누르면 선택 탭은 유지하고 나머지 탭만 일정 비율로 낮추며, S는 단독 청취, M은 개별 음소거로 동작합니다.",
      "콘솔 우측 [마스터 버스]에서는 모든 탭의 전체 출력 볼륨과 일괄 정지·음소거를 한 번에 제어합니다.",
    ],
  },
  {
    title: "채널 정렬 · 빠른 일시정지 · 기본값 고정",
    bullets: [
      "자주 쓰는 배치와 사이트별 시작 볼륨을 유지합니다.",
      "상단 [드래그 핸들]을 좌우로 끌어 채널 순서를 바꾸며, 중앙 구분선 너머 우측(대기 구역)에 놓으면 즉시 일시정지되고 좌측으로 옮기면 즉시 재생됩니다.",
      "[도메인 핀]을 켜 두면 이후 같은 사이트를 새 탭으로 열 때 현재 볼륨이 초기값으로 자동 적용됩니다.",
    ],
  },
];

const ADV_STEPS: HelpStep[] = [
  {
    title: "사이드 FX 랙 및 노멀라이저 설정",
    bullets: [
      "상단 고급 FX ▸ 버튼을 누르면 우측에 채널별 정밀 신호 처리 사이드 랙이 펼쳐집니다.",
      "노멀라이저는 전역 스위치 추종(follow), 항상 켜짐(on), 꺼짐(off)을 개별 지정할 수 있습니다.",
      "목표 기준 음압(-20 ~ -12 LUFS)과 반응 속도(느림 · 표준 · 빠름)를 채널 성격에 맞게 최적화합니다.",
    ],
  },
  {
    title: "스테레오 패닝 (Pan)",
    bullets: [
      "각 탭의 소리를 좌우 스테레오 공간(-100 L ~ +100 R)에 자유롭게 배치합니다.",
      "여러 탭의 방송이나 음악을 동시에 들을 때 위치를 분리해 청취 명료도를 높일 수 있습니다.",
      "패닝 슬라이더를 더블클릭하면 즉시 중앙(C, 0)으로 복귀합니다.",
    ],
  },
  {
    title: "노이즈 게이트 (Noise Gate)",
    bullets: [
      "음성이 나오지 않는 구간의 바닥 잡음(화이트노이즈·마이크 잡음)을 차단합니다.",
      "차단 임계값(-65 ~ -30 dB)을 설정하여 배경 소음을 지우고 유효한 음성만 통과시킵니다.",
    ],
  },
  {
    title: "다이내믹 컴프레서 (Compressor)",
    bullets: [
      "갑작스럽게 튀는 폭음이나 자극적인 음량을 부드럽게 눌러 귀를 보호합니다.",
      "압축 비율(2:1, 4:1, 8:1)을 원클릭 프리셋으로 선택해 균일한 다이내믹 레인지를 확보합니다.",
    ],
  },
];

function formatBulletText(text: string, isEasy: boolean): string {
  if (!isEasy) return text;
  return text.replace(/\[(페이더|노브|레벨 미터|수치 표시창|드래그 핸들|스위치 뱅크|도메인 핀|마스터 버스)\]/g, (_, term) => {
    const key = TERM_CHIP_MAP[term];
    return `<button type="button" class="term-chip" data-term="${key}">${term}</button>`;
  });
}

function renderSchematicSvg(active: HelpTermKey | null): string {
  const is = (k: HelpTermKey) => (active === k ? "highlighted" : "");
  return `<svg class="nested-schematic-svg" viewBox="0 0 84 118" width="84" height="118" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="4" y="4" width="48" height="110" rx="4" class="svg-strip-box" />
  <g class="svg-part svg-grip ${is("grip")}" data-schematic="grip">
    <rect x="14" y="8" width="28" height="7" rx="2" class="svg-part-box" />
    <circle cx="21" cy="11.5" r="1" /><circle cx="25" cy="11.5" r="1" /><circle cx="28" cy="11.5" r="1" /><circle cx="31" cy="11.5" r="1" /><circle cx="35" cy="11.5" r="1" />
  </g>
  <g class="svg-part svg-pin ${is("pin")}" data-schematic="pin">
    <rect x="8" y="19" width="11" height="10" rx="2" class="svg-part-box" />
    <path d="M13.5 21 v3 M11.5 22.5 h4 M12 25.5 l1.5 2 l1.5 -2" stroke-width="1" stroke="currentColor" fill="none" />
  </g>
  <rect x="22" y="21" width="26" height="6" rx="1.5" class="svg-dim-placeholder" />
  <g class="svg-part svg-fader ${is("fader")}" data-schematic="fader">
    <rect x="15" y="33" width="6" height="48" rx="3" class="svg-part-box" />
    <line x1="10" y1="36" x2="13" y2="36" stroke="currentColor" stroke-width="0.8" /><line x1="9" y1="50" x2="13" y2="50" stroke="currentColor" stroke-width="1.2" />
    <line x1="10" y1="65" x2="13" y2="65" stroke="currentColor" stroke-width="0.8" /><line x1="9" y1="78" x2="13" y2="78" stroke="currentColor" stroke-width="0.8" />
  </g>
  <g class="svg-part svg-knob ${is("knob")}" data-schematic="knob">
    <rect x="11" y="47" width="14" height="8" rx="2" class="svg-part-box" /><line x1="13" y1="51" x2="23" y2="51" stroke="currentColor" stroke-width="1" />
  </g>
  <g class="svg-part svg-meter ${is("meter")}" data-schematic="meter">
    <rect x="25" y="33" width="7" height="48" rx="2" class="svg-part-box" />
    <rect x="26.5" y="35" width="4" height="4" rx="0.5" /><rect x="26.5" y="41" width="4" height="4" rx="0.5" /><rect x="26.5" y="47" width="4" height="4" rx="0.5" />
    <rect x="26.5" y="53" width="4" height="4" rx="0.5" /><rect x="26.5" y="59" width="4" height="4" rx="0.5" /><rect x="26.5" y="65" width="4" height="4" rx="0.5" /><rect x="26.5" y="71" width="4" height="4" rx="0.5" />
  </g>
  <g class="svg-part svg-readout ${is("readout")}" data-schematic="readout">
    <rect x="11" y="84" width="22" height="9" rx="2" class="svg-part-box" /><text x="22" y="91" font-size="5.5" font-family="monospace" text-anchor="middle" font-weight="bold">0.0</text>
  </g>
  <g class="svg-part svg-switchBank ${is("switchBank")}" data-schematic="switchBank">
    <rect x="8" y="97" width="40" height="13" rx="2" class="svg-part-box" />
    <rect x="10" y="99" width="10" height="9" rx="1.5" /><text x="15" y="106" font-size="5" font-weight="bold" text-anchor="middle">M</text>
    <rect x="23" y="99" width="10" height="9" rx="1.5" /><text x="28" y="106" font-size="5" font-weight="bold" text-anchor="middle">S</text>
    <rect x="36" y="99" width="10" height="9" rx="1.5" /><text x="41" y="106" font-size="5" font-weight="bold" text-anchor="middle">F</text>
  </g>
  <g class="svg-part svg-masterBus ${is("masterBus")}" data-schematic="masterBus">
    <rect x="56" y="4" width="24" height="110" rx="4" class="svg-part-box svg-master-frame" /><text x="68" y="14" font-size="5" font-weight="800" text-anchor="middle" letter-spacing="0.5">MST</text>
    <rect x="60" y="20" width="4" height="61" rx="2" /><rect x="58" y="44" width="8" height="7" rx="1.5" /><rect x="68" y="20" width="4" height="61" rx="1" />
    <rect x="59" y="85" width="18" height="8" rx="2" /><text x="68" y="91" font-size="4.5" font-weight="bold" text-anchor="middle">0.0</text>
    <rect x="59" y="97" width="18" height="13" rx="2" /><text x="68" y="106" font-size="5" font-weight="bold" text-anchor="middle">ALL</text>
  </g>
</svg>`.trim();
}

export function buildHelpModalDom(backdrop: HTMLElement, onRequestClose: () => void): HelpModalRefs {
  let currentTab: "easy" | "adv" = "easy";
  let currentStep = 0;
  let hoveredTerm: HelpTermKey | null = null;
  let pinnedTerm: HelpTermKey | null = null;
  let blurTimer: number | null = null;

  backdrop.className = "help-backdrop hidden";
  backdrop.innerHTML = `<div class="help-modal c-surface" role="dialog" aria-modal="true" aria-label="Sound Manager 사용법 안내">
  <div class="help-header">
    <div class="help-tab-group" role="tablist">
      <button type="button" class="help-tab-btn" data-help-tab="easy" role="tab" aria-selected="true" data-active="true">기본 사용법</button>
      <button type="button" class="help-tab-btn" data-help-tab="adv" role="tab" aria-selected="false" data-active="false">고급 제어</button>
    </div>
    <button type="button" class="help-close-btn" data-help-close aria-label="도움말 닫기">✕</button>
  </div>
  <div class="help-body">
    <div class="help-step-head">
      <span class="help-step-badge tabular" data-ref="stepBadge">1 / 4</span>
      <h3 class="help-step-title" data-ref="stepTitle"></h3>
    </div>
    <div class="help-hint-line" data-ref="hintLine">밑줄 친 부품 이름에 커서를 올리면 위치를 미리 보고, 클릭하면 고정됩니다.</div>
    <ul class="help-bullet-list" data-ref="bulletList"></ul>
  </div>
  <div data-ref="nestedCard" class="nested-term-card c-raised hidden" aria-live="polite">
    <div class="nested-card-svg-wrap" data-ref="cardSvgWrap"></div>
    <div class="nested-card-info">
      <div class="nested-card-header">
        <span class="nested-card-title" data-ref="cardTitle"></span>
        <span class="nested-card-sub c-muted" data-ref="cardSub"></span>
      </div>
      <p class="nested-card-desc" data-ref="cardDesc"></p>
      <div class="nested-card-tip c-muted" data-ref="cardTip"></div>
    </div>
  </div>
  <div class="help-footer">
    <div class="help-step-dots" role="tablist">
      <button type="button" class="help-step-dot" data-help-step="0" aria-label="1단계" data-active="true"></button>
      <button type="button" class="help-step-dot" data-help-step="1" aria-label="2단계" data-active="false"></button>
      <button type="button" class="help-step-dot" data-help-step="2" aria-label="3단계" data-active="false"></button>
      <button type="button" class="help-step-dot" data-help-step="3" aria-label="4단계" data-active="false"></button>
    </div>
    <div class="help-nav-actions">
      <button type="button" class="help-nav-btn help-prev-btn" data-help-prev disabled>이전</button>
      <button type="button" class="help-nav-btn help-next-btn" data-help-next>다음</button>
    </div>
  </div>
</div>`.trim();

  const modalEl = backdrop.querySelector<HTMLElement>(".help-modal")!;
  const tabBtns = modalEl.querySelectorAll<HTMLButtonElement>("[data-help-tab]");
  const closeBtn = modalEl.querySelector<HTMLButtonElement>("[data-help-close]")!;
  const stepBadge = modalEl.querySelector<HTMLElement>('[data-ref="stepBadge"]')!;
  const stepTitle = modalEl.querySelector<HTMLElement>('[data-ref="stepTitle"]')!;
  const hintLine = modalEl.querySelector<HTMLElement>('[data-ref="hintLine"]')!;
  const bulletList = modalEl.querySelector<HTMLUListElement>('[data-ref="bulletList"]')!;
  const nestedCard = modalEl.querySelector<HTMLElement>('[data-ref="nestedCard"]')!;
  const cardSvgWrap = modalEl.querySelector<HTMLElement>('[data-ref="cardSvgWrap"]')!;
  const cardTitle = modalEl.querySelector<HTMLElement>('[data-ref="cardTitle"]')!;
  const cardSub = modalEl.querySelector<HTMLElement>('[data-ref="cardSub"]')!;
  const cardDesc = modalEl.querySelector<HTMLElement>('[data-ref="cardDesc"]')!;
  const cardTip = modalEl.querySelector<HTMLElement>('[data-ref="cardTip"]')!;
  const dots = modalEl.querySelectorAll<HTMLButtonElement>("[data-help-step]");
  const prevBtn = modalEl.querySelector<HTMLButtonElement>("[data-help-prev]")!;
  const nextBtn = modalEl.querySelector<HTMLButtonElement>("[data-help-next]")!;

  function updateNestedCard(): void {
    const activeKey = pinnedTerm ?? hoveredTerm;
    const chips = bulletList.querySelectorAll<HTMLButtonElement>(".term-chip");
    chips.forEach((c) => {
      const isPinned = c.dataset.term === pinnedTerm && pinnedTerm !== null;
      if (isPinned) c.setAttribute("data-pinned", "true");
      else c.removeAttribute("data-pinned");
    });

    if (!activeKey) {
      nestedCard.classList.add("hidden");
      return;
    }

    nestedCard.classList.remove("hidden");
    const info = TERM_INFO[activeKey];
    cardSvgWrap.innerHTML = renderSchematicSvg(activeKey);
    cardTitle.textContent = info.name;
    cardSub.textContent = info.subtitle;
    cardDesc.textContent = info.description;
    cardTip.textContent = pinnedTerm === activeKey
      ? "✓ 클릭으로 고정됨 · 칩 다시 클릭 또는 바깥 클릭 시 닫힘"
      : "💡 칩을 클릭하면 화면에 고정됩니다";
  }

  function renderStepContent(): void {
    const steps = currentTab === "easy" ? EASY_STEPS : ADV_STEPS;
    const step = steps[currentStep] ?? steps[0]!;

    stepBadge.textContent = `${currentStep + 1} / 4`;
    stepTitle.textContent = step.title;

    if (currentTab === "easy") {
      hintLine.classList.remove("hidden");
      hintLine.textContent = "밑줄 친 부품 이름에 커서를 올리면 위치를 미리 보고, 클릭하면 고정됩니다.";
    } else {
      hintLine.classList.add("hidden");
    }

    bulletList.innerHTML = "";
    step.bullets.forEach((bText) => {
      const li = document.createElement("li");
      li.innerHTML = formatBulletText(bText, currentTab === "easy");
      bulletList.appendChild(li);
    });

    const chips = bulletList.querySelectorAll<HTMLButtonElement>(".term-chip");
    chips.forEach((chip) => {
      const key = chip.dataset.term as HelpTermKey;
      if (!key) return;

      chip.addEventListener("pointerenter", () => {
        hoveredTerm = key; updateNestedCard();
      });

      chip.addEventListener("pointerleave", () => {
        hoveredTerm = null; updateNestedCard();
      });

      chip.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
        pinnedTerm = pinnedTerm === key ? null : key;
        if (pinnedTerm) chip.focus();
        updateNestedCard();
      });

      chip.addEventListener("blur", () => {
        if (blurTimer) clearTimeout(blurTimer);
        blurTimer = window.setTimeout(() => {
          const act = document.activeElement;
          if (act && (act.closest(".term-chip") || act.closest(".nested-term-card"))) return;
          if (pinnedTerm === key) {
            pinnedTerm = null; updateNestedCard();
          }
        }, 120);
      });
    });

    dots.forEach((dot, idx) => {
      const active = idx === currentStep;
      dot.setAttribute("data-active", String(active));
      dot.setAttribute("aria-selected", String(active));
    });

    prevBtn.disabled = currentStep === 0;
    nextBtn.disabled = currentStep === 3;
    updateNestedCard();
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.helpTab as "easy" | "adv";
      if (mode === currentTab) return;
      currentTab = mode; currentStep = 0; hoveredTerm = null; pinnedTerm = null;
      tabBtns.forEach((b) => {
        const act = b.dataset.helpTab === currentTab;
        b.setAttribute("data-active", String(act)); b.setAttribute("aria-selected", String(act));
      });
      renderStepContent();
    });
  });

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const idx = Number(dot.dataset.helpStep);
      if (isNaN(idx) || idx === currentStep) return;
      currentStep = idx; hoveredTerm = null; pinnedTerm = null; renderStepContent();
    });
  });

  prevBtn.addEventListener("click", () => {
    if (currentStep > 0) { currentStep--; hoveredTerm = null; pinnedTerm = null; renderStepContent(); }
  });

  nextBtn.addEventListener("click", () => {
    if (currentStep < 3) { currentStep++; hoveredTerm = null; pinnedTerm = null; renderStepContent(); }
  });

  closeBtn.addEventListener("click", () => {
    hoveredTerm = null; pinnedTerm = null; onRequestClose();
  });

  backdrop.addEventListener("click", (ev) => {
    if (ev.target === backdrop) {
      hoveredTerm = null; pinnedTerm = null; onRequestClose();
    }
  });

  modalEl.addEventListener("pointerdown", (ev) => {
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    if (target.closest(".term-chip") || target.closest(".nested-term-card")) return;
    if (pinnedTerm !== null) {
      pinnedTerm = null; hoveredTerm = null; updateNestedCard();
    }
  });

  renderStepContent();

  return {
    backdrop,
    isNestedPinned: () => pinnedTerm !== null,
    clearNestedPin: () => {
      pinnedTerm = null; hoveredTerm = null; updateNestedCard();
    },
  };
}

export function syncHelpModalDom(refs: HelpModalRefs, open: boolean, _t: ThemeTokens): void {
  refs.backdrop.classList.toggle("hidden", !open);
  if (!open) {
    refs.clearNestedPin();
  }
}
