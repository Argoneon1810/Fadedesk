import { DEFAULT_CHANNEL_FX } from "../shared/mixer-math";
import type { TabChannelState, ThemeTokens } from "../shared/types";

/**
 * Sound Manager 0.7.0 실화면 스포트라이트 투어 모듈.
 * 실제 렌더링된 콘솔 요소 위에 어두운 오버레이와 하이라이트 홀을 뚫어 시각적으로 안내한다.
 */

export const DEMO_TOUR_TAB_IDS = [-901, -902] as const;

export function createDemoTourChannels(): TabChannelState[] {
  return [
    {
      tabId: -901,
      windowId: -1,
      title: "예시 · Kiminoshigusamo (음악 탭)",
      domain: "music.youtube.com",
      shortHost: "music",
      favIconUrl: "",
      playing: true,
      audible: true,
      mediaCount: 1,
      db: 0,
      muted: false,
      solo: false,
      focus: true,
      corsCap: false,
      fx: { ...DEFAULT_CHANNEL_FX },
      normTrimDb: -1.8,
      vuLevel: 0.62,
      vuPeak: 0.74,
      firstSeenAt: 1,
      sortOrder: 1,
    },
    {
      tabId: -902,
      windowId: -1,
      title: "예시 · 라이브 토크 방송 (대기)",
      domain: "chzzk.naver.com",
      shortHost: "chzzk",
      favIconUrl: "",
      playing: false,
      audible: false,
      mediaCount: 1,
      db: -6.0,
      muted: false,
      solo: false,
      focus: false,
      corsCap: false,
      fx: { ...DEFAULT_CHANNEL_FX },
      normTrimDb: 0,
      vuLevel: 0,
      vuPeak: 0,
      firstSeenAt: 2,
      sortOrder: 2,
    },
  ];
}

interface TourStepDef {
  step: number;
  title: string;
  desc: string;
  selectors: string[];
  fallbackSelector?: string;
}

const TOUR_STEPS: TourStepDef[] = [
  {
    step: 1,
    title: "상단 테마 · 독립 창 분리(↗)",
    desc: "좌측 색상 점(●)에서 테마·모드를 바꾸고, 창 분리(↗) 버튼으로 콘솔을 별도 창으로 떼어내 항상 띄워 둘 수 있습니다.",
    selectors: ["#theme-dot-btn", "#help-btn", "#popout-btn"],
    fallbackSelector: ".deck-left",
  },
  {
    step: 2,
    title: "채널 헤더 클릭 → 해당 탭 바로 이동(↗)",
    desc: "파비콘·사이트명·↗ 영역을 클릭(또는 Enter)하면 수많은 탭 중에서 소리가 나는 해당 탭·창으로 즉시 이동합니다.",
    selectors: ['.channel-strip [data-ref="header"]'],
    fallbackSelector: ".channel-strip",
  },
  {
    step: 3,
    title: "페이더 노브 드래그 & dB 직접 입력",
    desc: "사각 노브를 끌어 -60dB~+12dB까지 조절하고, 아래 숫자창을 클릭해 원하는 데시벨을 직접 타이핑할 수 있습니다.",
    selectors: ['.channel-strip [data-ref="faderWell"]', '.channel-strip [data-ref="readoutBtn"]'],
    fallbackSelector: ".channel-strip",
  },
  {
    step: 4,
    title: "재생 전환 · 도메인 핀(📌) · 드래그 정렬(⠿)",
    desc: "재생 옆 압정(📌)을 켜면 사이트 기본 볼륨으로 기억되며, 맨 위 6점 핸들(⠿)을 우측 대기 구역에 놓으면 즉시 일시정지됩니다.",
    selectors: [".channel-strip .transport-row"],
    fallbackSelector: ".channel-strip",
  },
  {
    step: 5,
    title: "집중 청취(M · S · F)와 Focus α",
    desc: "F(Focus)를 켜면 이 탭만 또렷하게 유지하고, 다른 탭들은 상단 Focus α 비율만큼 부드럽게 줄여 줍니다.",
    selectors: [".channel-strip .switch-bank"],
    fallbackSelector: ".channel-strip",
  },
  {
    step: 6,
    title: "이지 노멀라이저(균일 N ▾) 3종 프리셋",
    desc: "본체는 자동 볼륨 균일화 ON/OFF이며, 우측 ▾ 버튼에서 곡 내 강약을 살리는 '음악'·'표준'·'야간' 프리셋을 고릅니다.",
    selectors: ["#norm-split-group", "#auto-norm-btn"],
    fallbackSelector: ".deck-right",
  },
  {
    step: 7,
    title: "마스터 버스와 고급 FX 사이드 랙",
    desc: "우측 마스터 버스에서 전체 볼륨·일괄 정지·음소거를 제어하고, 상단 '고급 FX ▸'로 패닝·게이트·컴프레서를 확장합니다.",
    selectors: ["#master-dock"],
    fallbackSelector: "#console-root",
  },
];

export interface TourOverlayRefs {
  el: HTMLElement;
  start: () => void;
  stop: () => void;
  isActive: () => boolean;
  getStepIndex: () => number;
  syncPosition: (demoMode: boolean, t?: ThemeTokens) => void;
}

export function buildTourOverlayDom(
  container: HTMLElement,
  onFinishOrSkip: () => void,
): TourOverlayRefs {
  let active = false;
  let currentStep = 0;
  let lastDemoMode = false;

  container.className = "tour-overlay hidden";
  container.innerHTML = `
    <div class="tour-spotlight-hole" data-ref="hole"></div>
    <div class="tour-card c-surface" data-ref="card" role="dialog" aria-modal="true" aria-label="콘솔 기능 실화면 투어">
      <div class="tour-card-header">
        <div class="tour-card-tags">
          <span class="tour-step-badge tabular" data-ref="stepBadge">STEP 1 / 7</span>
          <span class="tour-demo-pill hidden" data-ref="demoPill">예시 채널 표시 중</span>
        </div>
        <button type="button" class="tour-skip-btn" data-tour-skip>투어 건너뛰기</button>
      </div>
      <h3 class="tour-card-title allow-wrap" data-ref="title"></h3>
      <p class="tour-card-desc allow-wrap" data-ref="desc"></p>
      <div class="tour-card-footer">
        <div class="tour-step-dots" data-ref="dots"></div>
        <div class="tour-nav-actions">
          <button type="button" class="tour-prev-btn" data-tour-prev disabled>이전</button>
          <button type="button" class="tour-next-btn" data-tour-next>다음</button>
        </div>
      </div>
    </div>
  `.trim();

  const holeEl = container.querySelector<HTMLElement>('[data-ref="hole"]')!;
  const cardEl = container.querySelector<HTMLElement>('[data-ref="card"]')!;
  const stepBadge = container.querySelector<HTMLElement>('[data-ref="stepBadge"]')!;
  const demoPill = container.querySelector<HTMLElement>('[data-ref="demoPill"]')!;
  const titleEl = container.querySelector<HTMLElement>('[data-ref="title"]')!;
  const descEl = container.querySelector<HTMLElement>('[data-ref="desc"]')!;
  const dotsWrap = container.querySelector<HTMLElement>('[data-ref="dots"]')!;
  const prevBtn = container.querySelector<HTMLButtonElement>("[data-tour-prev]")!;
  const nextBtn = container.querySelector<HTMLButtonElement>("[data-tour-next]")!;
  const skipBtn = container.querySelector<HTMLButtonElement>("[data-tour-skip]")!;

  // 7개 인디케이터 도트 생성
  dotsWrap.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "tour-step-dot";
    dot.dataset.step = String(i);
    dot.setAttribute("aria-label", `${i + 1}단계`);
    dot.addEventListener("click", () => {
      currentStep = i;
      syncPosition(lastDemoMode);
    });
    dotsWrap.appendChild(dot);
  }

  function getTargetUnionRect(stepDef: TourStepDef): DOMRect | null {
    const rects: DOMRect[] = [];
    for (const sel of stepDef.selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) rects.push(r);
    }

    if (rects.length === 0 && stepDef.fallbackSelector) {
      const fb = document.querySelector(stepDef.fallbackSelector);
      if (fb) {
        const r = fb.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) rects.push(r);
      }
    }

    if (rects.length === 0) return null;

    let minX = rects[0]!.left;
    let minY = rects[0]!.top;
    let maxX = rects[0]!.right;
    let maxY = rects[0]!.bottom;

    for (let i = 1; i < rects.length; i++) {
      const r = rects[i]!;
      if (r.left < minX) minX = r.left;
      if (r.top < minY) minY = r.top;
      if (r.right > maxX) maxX = r.right;
      if (r.bottom > maxY) maxY = r.bottom;
    }

    return new DOMRect(minX, minY, Math.max(16, maxX - minX), Math.max(16, maxY - minY));
  }

  function syncPosition(demoMode = false, _t?: ThemeTokens): void {
    if (!active) return;
    lastDemoMode = demoMode;

    const stepDef = TOUR_STEPS[currentStep] ?? TOUR_STEPS[0]!;
    stepBadge.textContent = `STEP ${currentStep + 1} / 7`;
    demoPill.classList.toggle("hidden", !demoMode);
    titleEl.textContent = stepDef.title;
    descEl.textContent = stepDef.desc;

    prevBtn.disabled = currentStep === 0;
    nextBtn.textContent = currentStep === 6 ? "완료" : "다음";

    const dots = dotsWrap.querySelectorAll<HTMLButtonElement>(".tour-step-dot");
    dots.forEach((d, idx) => {
      d.setAttribute("data-active", String(idx === currentStep));
    });

    const rootEl = document.getElementById("console-root") ?? container.parentElement ?? document.body;
    const rootRect = rootEl.getBoundingClientRect();
    const targetRect = getTargetUnionRect(stepDef);

    const pad = 4;
    let holeL = 10;
    let holeT = 10;
    let holeW = 60;
    let holeH = 30;

    if (targetRect) {
      holeL = Math.max(2, targetRect.left - rootRect.left - pad);
      holeT = Math.max(2, targetRect.top - rootRect.top - pad);
      const holeR = Math.min(rootRect.width - 2, targetRect.right - rootRect.left + pad);
      const holeB = Math.min(rootRect.height - 2, targetRect.bottom - rootRect.top + pad);
      holeW = Math.max(20, holeR - holeL);
      holeH = Math.max(20, holeB - holeT);
    }

    holeEl.style.left = `${Math.round(holeL)}px`;
    holeEl.style.top = `${Math.round(holeT)}px`;
    holeEl.style.width = `${Math.round(holeW)}px`;
    holeEl.style.height = `${Math.round(holeH)}px`;

    // 먼저 카드 가로 폭을 반영한 뒤 실제 높이를 측정
    const cardW = Math.min(300, Math.max(240, rootRect.width - 20));
    cardEl.style.width = `${Math.round(cardW)}px`;
    const cardH = cardEl.offsetHeight > 0 ? cardEl.offsetHeight : 148;

    const rightSpace = rootRect.width - (holeL + holeW);
    const leftSpace = holeL;
    const bottomSpace = rootRect.height - (holeT + holeH);

    let cardLeft: number;
    let cardTop: number;

    if (holeT < 76 && holeH <= 44 && bottomSpace >= cardH + 12) {
      // 상단 데크 컨트롤 강조 시 바로 아래쪽에 배치해 상단 바 전체 시야 확보
      cardLeft = holeL;
      cardTop = holeT + holeH + 8;
    } else if (rightSpace >= cardW + 12) {
      cardLeft = holeL + holeW + 10;
      cardTop = Math.min(holeT, rootRect.height - cardH - 10);
    } else if (leftSpace >= cardW + 12) {
      cardLeft = holeL - cardW - 10;
      cardTop = Math.min(holeT, rootRect.height - cardH - 10);
    } else if (bottomSpace >= cardH + 12) {
      cardLeft = Math.max(10, holeL);
      cardTop = holeT + holeH + 8;
    } else {
      cardLeft = Math.max(10, holeL);
      cardTop = Math.max(10, holeT - cardH - 8);
    }

    // 엄격한 화면 내 클램프 (768px 팝업 및 520x420 창 모두에서 0 OUT_OF_BOUNDS)
    const maxL = Math.max(10, rootRect.width - cardW - 10);
    const maxT = Math.max(10, rootRect.height - cardH - 10);
    cardLeft = Math.max(10, Math.min(cardLeft, maxL));
    cardTop = Math.max(10, Math.min(cardTop, maxT));

    cardEl.style.left = `${Math.round(cardLeft)}px`;
    cardEl.style.top = `${Math.round(cardTop)}px`;
  }

  function start(): void {
    active = true;
    currentStep = 0;
    container.classList.remove("hidden");
    syncPosition(lastDemoMode);
  }

  function stop(): void {
    active = false;
    container.classList.add("hidden");
  }

  skipBtn.addEventListener("click", () => {
    stop();
    onFinishOrSkip();
  });

  prevBtn.addEventListener("click", () => {
    if (currentStep > 0) {
      currentStep--;
      syncPosition(lastDemoMode);
    }
  });

  nextBtn.addEventListener("click", () => {
    if (currentStep < 6) {
      currentStep++;
      syncPosition(lastDemoMode);
    } else {
      stop();
      onFinishOrSkip();
    }
  });

  window.addEventListener("keydown", (ev) => {
    if (!active) return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      stop();
      onFinishOrSkip();
    } else if (ev.key === "ArrowLeft" && currentStep > 0) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      currentStep--;
      syncPosition(lastDemoMode);
    } else if (ev.key === "ArrowRight") {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (currentStep < 6) {
        currentStep++;
        syncPosition(lastDemoMode);
      } else {
        stop();
        onFinishOrSkip();
      }
    }
  });

  return {
    el: container,
    start,
    stop,
    isActive: () => active,
    getStepIndex: () => currentStep,
    syncPosition,
  };
}
