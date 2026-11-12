import { DEFAULT_CHANNEL_FX } from "../shared/mixer-math";
import type { TabChannelState, ThemeTokens } from "../shared/types";

/**
 * Sound Manager 실화면 스포트라이트 투어 모듈.
 * SVG evenodd 다중 홀 마스크를 사용해 한 단계에서 연관된 여러 조작부(예: 하단 M·S·F 스위치와 상단 Focus α)를
 * 동시에 또렷하게 비추고, 안내 카드가 어떤 하이라이트 영역도 가리지 않도록 배치한다.
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
  /** 각 내부 배열은 인접 요소를 하나의 스포트라이트 홀로 묶고, 외부 배열은 동시에 뚫을 다중 홀 목록을 뜻한다. */
  holeGroups: string[][];
  fallbackSelector?: string;
}

interface HoleBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const TOUR_STEPS: TourStepDef[] = [
  {
    step: 1,
    title: "상단 테마 · 독립 창 분리(↗)",
    desc: "좌측 색상 점(●)에서 테마·모드를 바꾸고, 창 분리(↗) 버튼으로 콘솔을 별도 창으로 떼어내 항상 띄워 둘 수 있습니다.",
    holeGroups: [["#theme-dot-btn", "#help-btn", "#popout-btn"]],
    fallbackSelector: ".deck-left",
  },
  {
    step: 2,
    title: "채널 헤더 클릭 → 해당 탭 바로 이동(↗)",
    desc: "파비콘·사이트명·↗ 영역을 클릭(또는 Enter)하면 수많은 탭 중에서 소리가 나는 해당 탭·창으로 즉시 이동합니다.",
    holeGroups: [['.channel-strip [data-ref="header"]']],
    fallbackSelector: ".channel-strip",
  },
  {
    step: 3,
    title: "페이더 노브 드래그 & dB 직접 입력",
    desc: "사각 노브를 끌어 -60dB~+12dB까지 조절하고, 아래 숫자창을 클릭해 원하는 데시벨을 직접 타이핑할 수 있습니다.",
    holeGroups: [['.channel-strip [data-ref="faderWell"]', '.channel-strip [data-ref="readoutBtn"]']],
    fallbackSelector: ".channel-strip",
  },
  {
    step: 4,
    title: "재생 전환 · 도메인 핀(📌) · 드래그 정렬(⠿)",
    desc: "재생 옆 압정(📌)을 켜면 사이트 기본 볼륨으로 기억되며, 맨 위 6점 핸들(⠿)을 우측 대기 구역에 놓으면 즉시 일시정지됩니다.",
    holeGroups: [[".channel-strip .transport-row"], [".channel-strip .grip-bar"]],
    fallbackSelector: ".channel-strip",
  },
  {
    step: 5,
    title: "집중 청취(M · S · F)와 상단 Focus α",
    desc: "F(Focus)를 켜면 이 탭만 또렷하게 두고 다른 탭들은 상단 Focus α 비율만큼 줄입니다. Focus α 우측 데시벨 수치도 클릭해 직접 입력할 수 있습니다.",
    holeGroups: [[".channel-strip .switch-bank"], ["#alpha-box", "#reset-modes-btn"]],
    fallbackSelector: ".channel-strip",
  },
  {
    step: 6,
    title: "이지 노멀라이저(균일 N ▾) 3종 프리셋",
    desc: "본체는 자동 음압 정렬 ON/OFF이며, 우측 ▾에서 표준 EBU 계측 창 기반의 '음악(9s)' · '표준(3s)' · '야간(0.4s)' 프리셋을 고릅니다.",
    holeGroups: [["#norm-split-group", "#auto-norm-btn"]],
    fallbackSelector: ".deck-right",
  },
  {
    step: 7,
    title: "마스터 버스와 고급 FX 사이드 랙",
    desc: "우측 마스터 버스에서 전체 볼륨·일괄 정지·음소거를 제어하고, 상단 '고급 FX ▸'로 채널별 LUFS·패닝·게이트·컴프레서를 세밀하게 다룹니다.",
    holeGroups: [["#master-dock"], ["#adv-rack-btn"]],
    fallbackSelector: "#console-root",
  },
];

function roundedRectPath(x: number, y: number, w: number, h: number, r = 7): string {
  const rx = Math.max(0, Math.min(r, w / 2, h / 2));
  return [
    `M ${x + rx} ${y}`,
    `H ${x + w - rx}`,
    `A ${rx} ${rx} 0 0 1 ${x + w} ${y + rx}`,
    `V ${y + h - rx}`,
    `A ${rx} ${rx} 0 0 1 ${x + w - rx} ${y + h}`,
    `H ${x + rx}`,
    `A ${rx} ${rx} 0 0 1 ${x} ${y + h - rx}`,
    `V ${y + rx}`,
    `A ${rx} ${rx} 0 0 1 ${x + rx} ${y}`,
    "Z",
  ].join(" ");
}

function computeOverlapArea(a: HoleBox, b: HoleBox, margin = 4): number {
  const ox = Math.max(0, Math.min(a.left + a.width, b.left + b.width + margin) - Math.max(a.left, b.left - margin));
  const oy = Math.max(0, Math.min(a.top + a.height, b.top + b.height + margin) - Math.max(a.top, b.top - margin));
  return ox * oy;
}

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
    <svg class="tour-backdrop-svg" data-ref="backdropSvg" aria-hidden="true">
      <path data-ref="dimPath" fill="rgba(4, 9, 11, 0.74)" fill-rule="evenodd"></path>
    </svg>
    <div class="tour-rings-layer" data-ref="ringsLayer"></div>
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

  const backdropSvg = container.querySelector<SVGSVGElement>('[data-ref="backdropSvg"]')!;
  const dimPath = container.querySelector<SVGPathElement>('[data-ref="dimPath"]')!;
  const ringsLayer = container.querySelector<HTMLElement>('[data-ref="ringsLayer"]')!;
  const cardEl = container.querySelector<HTMLElement>('[data-ref="card"]')!;
  const stepBadge = container.querySelector<HTMLElement>('[data-ref="stepBadge"]')!;
  const demoPill = container.querySelector<HTMLElement>('[data-ref="demoPill"]')!;
  const titleEl = container.querySelector<HTMLElement>('[data-ref="title"]')!;
  const descEl = container.querySelector<HTMLElement>('[data-ref="desc"]')!;
  const dotsWrap = container.querySelector<HTMLElement>('[data-ref="dots"]')!;
  const prevBtn = container.querySelector<HTMLButtonElement>("[data-tour-prev]")!;
  const nextBtn = container.querySelector<HTMLButtonElement>("[data-tour-next]")!;
  const skipBtn = container.querySelector<HTMLButtonElement>("[data-tour-skip]")!;

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

  function unionSelectorsRect(selectors: string[]): DOMRect | null {
    const rects: DOMRect[] = [];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) rects.push(r);
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

  function resolveHoleBoxes(stepDef: TourStepDef, rootRect: DOMRect): HoleBox[] {
    const pad = 4;
    const rawRects: DOMRect[] = [];
    for (const group of stepDef.holeGroups) {
      const r = unionSelectorsRect(group);
      if (r) rawRects.push(r);
    }
    if (rawRects.length === 0 && stepDef.fallbackSelector) {
      const fb = unionSelectorsRect([stepDef.fallbackSelector]);
      if (fb) rawRects.push(fb);
    }
    if (rawRects.length === 0) {
      return [{ left: 10, top: 10, width: 60, height: 30 }];
    }

    return rawRects.map((targetRect) => {
      const holeL = Math.round(Math.max(2, targetRect.left - rootRect.left - pad));
      const holeT = Math.round(Math.max(2, targetRect.top - rootRect.top - pad));
      const holeR = Math.round(Math.min(rootRect.width - 2, targetRect.right - rootRect.left + pad));
      const holeB = Math.round(Math.min(rootRect.height - 2, targetRect.bottom - rootRect.top + pad));
      return {
        left: holeL,
        top: holeT,
        width: Math.max(20, holeR - holeL),
        height: Math.max(20, holeB - holeT),
      };
    });
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
    const W = Math.max(1, Math.round(rootRect.width));
    const H = Math.max(1, Math.round(rootRect.height));
    const holes = resolveHoleBoxes(stepDef, rootRect);

    // 1. SVG evenodd 배경 패스 및 다중 스포트라이트 링 동기화
    backdropSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    backdropSvg.setAttribute("width", String(W));
    backdropSvg.setAttribute("height", String(H));
    const subPaths = [`M 0 0 H ${W} V ${H} H 0 Z`, ...holes.map((h) => roundedRectPath(h.left, h.top, h.width, h.height, 7))];
    dimPath.setAttribute("d", subPaths.join(" "));

    ringsLayer.innerHTML = "";
    holes.forEach((h, idx) => {
      const ring = document.createElement("div");
      ring.className = "tour-spotlight-hole";
      if (idx === 0) ring.setAttribute("data-ref", "hole");
      ring.dataset.holeIndex = String(idx);
      ring.style.left = `${h.left}px`;
      ring.style.top = `${h.top}px`;
      ring.style.width = `${h.width}px`;
      ring.style.height = `${h.height}px`;
      ringsLayer.appendChild(ring);
    });

    // 2. 다중 홀 모두와 겹치지 않는 최적 카드 위치 산출
    const primary = holes[0]!;
    const cardW = Math.min(300, Math.max(240, W - 20));
    cardEl.style.width = `${Math.round(cardW)}px`;
    const cardH = cardEl.offsetHeight > 0 ? cardEl.offsetHeight : 148;
    const maxL = Math.max(10, W - cardW - 10);
    const maxT = Math.max(10, H - cardH - 10);
    const clampX = (x: number): number => Math.max(10, Math.min(Math.round(x), maxL));
    const clampY = (y: number): number => Math.max(10, Math.min(Math.round(y), maxT));

    const candidates: Array<{ left: number; top: number }> = [];
    if (primary.top < 76 && primary.height <= 44) {
      candidates.push({ left: clampX(primary.left), top: clampY(primary.top + primary.height + 10) });
    }
    candidates.push(
      { left: clampX(primary.left + primary.width + 12), top: clampY(Math.min(primary.top, maxT)) },
      { left: clampX(primary.left + primary.width + 12), top: maxT },
      { left: clampX(primary.left - cardW - 12), top: clampY(Math.max(52, primary.top)) },
      { left: clampX(primary.left - cardW - 12), top: maxT },
      { left: clampX(primary.left), top: clampY(primary.top + primary.height + 10) },
      { left: clampX(primary.left), top: clampY(primary.top - cardH - 10) },
      { left: clampX((W - cardW) / 2), top: maxT },
    );

    let best = candidates[0]!;
    let bestOverlap = Infinity;
    for (const cand of candidates) {
      const box: HoleBox = { left: cand.left, top: cand.top, width: cardW, height: cardH };
      let overlap = 0;
      for (const h of holes) {
        overlap += computeOverlapArea(box, h, 4);
      }
      if (overlap < bestOverlap) {
        bestOverlap = overlap;
        best = cand;
        if (overlap === 0) break;
      }
    }

    cardEl.style.left = `${best.left}px`;
    cardEl.style.top = `${best.top}px`;
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
