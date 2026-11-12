import type { ThemeTokens } from "../shared/types";
import {
  renderSchematicSvg,
  TERM_CHIP_MAP,
  TERM_INFO,
  type HelpTermKey,
} from "./help-schematic";

/**
 * Sound Manager 0.7.0 튜토리얼 안내 모달 & 중첩 시각 용어 카드 뷰 모듈.
 * 3개 탭(빠른 투어 · 콘솔 사용법 · 노멀라이저·고급 FX) 및 실화면 스포트라이트 투어 연동.
 */

export type HelpTabMode = "tour" | "easy" | "adv";

export interface HelpModalRefs {
  backdrop: HTMLElement;
  isNestedPinned: () => boolean;
  clearNestedPin: () => void;
  setTab: (tab: HelpTabMode) => void;
  getTab: () => HelpTabMode;
}

export interface HelpModalOptions {
  onRequestClose: () => void;
  onStartTour: () => void;
}

interface HelpStep {
  title: string;
  bullets: string[];
}

const EASY_STEPS: HelpStep[] = [
  {
    title: "탭 바로 이동 · 독립 창 분리 · 테마 전환",
    bullets: [
      "채널 상단 [탭 이동 헤더](파비콘 · 사이트명 · ↗)를 클릭하거나 채널 선택 후 Enter를 누르면 해당 미디어가 재생 중인 브라우저 탭·창으로 즉시 포커스가 이동합니다.",
      "상단 [독립 창 분리](↗) 버튼으로 팝업을 별도 창으로 떼어내 상시 띄워 둘 수 있으며(최소 520×420 자동 유지), 좌측 색상 점(●)에서 4종 컬러 테마와 다크·라이트 모드를 전환합니다.",
      "전역 단축키(Alt+Shift+M 전체 음소거, Alt+Shift+F Focus 탭 순환)와 콘솔 내 방향키·0·M/S/F/P 단축 조작을 지원합니다.",
    ],
  },
  {
    title: "탭별 볼륨 증폭 · 노브 조작 · 수치 직접 입력",
    bullets: [
      "실수로 트랙을 건드려 볼륨이 튀는 것을 막기 위해 드래그는 [페이더] 위의 사각 [노브]를 직접 잡고 움직이며, 레일 위에서는 마우스 휠(Shift+휠 미세 조절)과 더블클릭(0.0dB 복귀)이 동작합니다.",
      "0 눈금 위로 올리면 최대 +12dB(약 4배)까지 증폭되며 우측 [레벨 미터]로 실시간 출력 레벨을 확인합니다.",
      "아래 [수치 표시창]을 클릭하면 -8.5처럼 원하는 데시벨 숫자를 키보드로 직접 입력합니다.",
    ],
  },
  {
    title: "집중 청취(M·S·F) · 드래그 정렬 · 도메인 핀",
    bullets: [
      "하단 [스위치 뱅크]에서 F(Focus)를 켜면 선택 탭은 그대로 두고 나머지 탭만 상단 Focus α 비율만큼 줄입니다(우측 데시벨 수치 클릭 시 직접 입력, S 단독 청취, Shift+클릭 다중 선택).",
      "맨 위 좌측 [드래그 핸들]을 끌어 순서를 바꾸거나, 구분선 너머 우측 대기 구역에 놓아 즉시 일시정지·좌측으로 옮겨 즉시 재생합니다.",
      "재생 버튼 오른쪽 [도메인 핀]을 켜면 같은 사이트를 새 탭으로 열 때 현재 볼륨이 초기값으로 자동 적용됩니다.",
    ],
  },
  {
    title: "자동 볼륨 균일화(균일 N ▾)와 전체 마스터 제어",
    bullets: [
      "상단 [균일 N ▾] 본체를 누르면 자동 볼륨 보정을 즉시 켜거나 끄며, 우측 ▾를 눌러 음악(강약 보존) · 표준(영상/방송) · 야간(강한 균일) 프리셋을 전환합니다.",
      "우측 고정 [마스터 버스]에서는 스테레오 출력 레벨을 보며 전체 마스터 볼륨과 전체 정지·전체 음소거를 한 번에 제어합니다.",
    ],
  },
];

const ADV_STEPS: HelpStep[] = [
  {
    title: "BS.1770 게이팅 노멀라이저 원리와 이지 프리셋",
    bullets: [
      "노멀라이저는 방송 표준(ITU-R BS.1770-4 K-가중 · -10 LU 상대 게이트, EBU 3341 계측 창) 단일 엔진으로 동작합니다. 곡 중간의 무음·잔향(프리즈) 구간은 상대 게이트가 자동 배제해 직후 타격음이 튀지 않습니다.",
      "단기·순간 창(3s·0.4s)에서는 한 곡 안의 조용한 도입부~폭발적인 후렴 대비에도 반응해 역동성이 줄어들 수 있습니다. 이는 버그가 아닌 단기 평준화의 물리적 특성입니다.",
      "상단 [균일 N ▾]의 음악(9s 완만) · 표준(3s 단기) · 야간(0.4s 순간) 프리셋은 우측 고급 FX ▸의 목표 LUFS와 응답 속도(완만·표준·민감)를 표준 조합으로 바로 지정합니다.",
    ],
  },
  {
    title: "채널별 2계층 노멀라이저 (전역 따름 · 개별 ON/OFF)",
    bullets: [
      "상단 고급 FX ▸를 열면 선택 채널을 전역 따름, 개별 ON, 개별 OFF 중 하나로 지정할 수 있으며, 전역 스위치를 껐다 켜도 개별 설정값은 지워지지 않습니다.",
      "개별 ON을 고르면 채널마다 목표 음압(-20 ~ -12 LUFS)과 반응 속도(완만 · 표준 · 민감)를 직접 지정합니다.",
    ],
  },
  {
    title: "스테레오 패닝(Pan) & 노이즈 게이트",
    bullets: [
      "패닝 (L100 ~ C ~ R100): 각 탭의 소리를 좌우 공간에 배치해 여러 방송·음악을 동시에 들을 때 명료도를 높입니다(더블클릭 또는 C 버튼으로 중앙 복귀).",
      "노이즈 게이트 (-65 ~ -30 dB): 대사 사이 무음 구간의 마이크 화이트노이즈·바닥 잡음을 차단합니다.",
    ],
  },
  {
    title: "다이내믹 컴프레서 & 교차 출처 보안 0dB 상한",
    bullets: [
      "컴프레서 (약 2:1 · 중 4:1 · 강 8:1): 갑작스럽게 튀는 비명이나 폭발음 피크를 매끄럽게 눌러 귀를 보호합니다.",
      "보안 0dB 상한: 외부 출처(CORS)·DRM 보안이 걸린 일부 미디어는 브라우저 정책상 무음 사고를 막기 위해 기본 볼륨 제어(0dB 이하 감쇠)로 자동 전환되며 [페이더] 상단에 빗금이 표시됩니다.",
    ],
  },
];

const CHIP_REGEX = /\[(탭 이동 헤더|독립 창 분리|균일 N ▾|페이더|노브|레벨 미터|수치 표시창|드래그 핸들|도메인 핀|스위치 뱅크|마스터 버스)\]/g;

function formatBulletText(text: string): string {
  return text.replace(CHIP_REGEX, (_, term: string) => {
    const key = TERM_CHIP_MAP[term];
    if (!key) return term;
    return `<button type="button" class="term-chip" data-term="${key}">${term}</button>`;
  });
}

export function buildHelpModalDom(
  backdrop: HTMLElement,
  options: HelpModalOptions | (() => void),
): HelpModalRefs {
  const opts: HelpModalOptions =
    typeof options === "function"
      ? { onRequestClose: options, onStartTour: () => {} }
      : options;

  let currentTab: HelpTabMode = "tour";
  let currentStep = 0;
  let hoveredTerm: HelpTermKey | null = null;
  let pinnedTerm: HelpTermKey | null = null;
  let blurTimer: number | null = null;

  backdrop.className = "help-backdrop hidden";
  backdrop.innerHTML = `
<div class="help-modal c-surface" role="dialog" aria-modal="true" aria-label="Sound Manager 사용법 안내">
  <div class="help-header">
    <div class="help-tab-group" role="tablist">
      <button type="button" class="help-tab-btn" data-help-tab="tour" role="tab" aria-selected="true" data-active="true">빠른 투어</button>
      <button type="button" class="help-tab-btn" data-help-tab="easy" role="tab" aria-selected="false" data-active="false">콘솔 사용법</button>
      <button type="button" class="help-tab-btn" data-help-tab="adv" role="tab" aria-selected="false" data-active="false">노멀라이저 · 고급 FX</button>
    </div>
    <button type="button" class="help-close-btn" data-help-close aria-label="도움말 닫기">✕</button>
  </div>

  <div class="help-body">
    <!-- 탭 1: 빠른 투어 런처 -->
    <div class="tour-intro-pane" data-ref="tourIntroPane">
      <div class="tour-intro-head">
        <span class="tour-intro-badge">GUIDED TOUR</span>
        <h3 class="tour-intro-title allow-wrap">실제 콘솔 화면 위에서 주요 기능을 바로 익혀 보세요</h3>
      </div>
      <ul class="tour-intro-list">
        <li class="tour-intro-item allow-wrap">
          <strong>앱 전환 & 창 분리</strong>: 채널 헤더(↗)를 눌러 재생 중인 탭으로 바로 이동하거나, 상단 창 분리(↗)로 콘솔을 독립 창에 띄워 둡니다.
        </li>
        <li class="tour-intro-item allow-wrap">
          <strong>정밀 볼륨 & 집중 청취</strong>: 탭별 -60 ~ +12dB 증폭, 직접 숫자 입력, 배경 탭만 부드럽게 줄이는 Focus(F)를 제공합니다.
        </li>
        <li class="tour-intro-item allow-wrap">
          <strong>음악·영상·야간 맞춤 노멀라이저</strong>: 곡 내부 강약을 보존하는 음악 모드부터 표준·야간까지 원클릭 프리셋을 지원합니다.
        </li>
      </ul>
      <p class="tour-intro-note allow-wrap">
        열린 미디어 탭이 없어도 투어 동안 예시 채널 2개가 임시로 표시되며, 끝나거나 건너뛰면 즉시 원래 화면으로 돌아갑니다.
      </p>
      <div class="tour-intro-actions">
        <button type="button" class="help-tour-start-btn" data-tour-start>실화면 투어 시작 ▸</button>
        <button type="button" class="help-tour-skip-btn" data-tour-skip>바로 쓰기 (건너뛰기)</button>
      </div>
      <div class="tour-intro-sub allow-wrap">
        상단 ? 버튼에서 언제든 다시 열 수 있습니다 · Esc 또는 바깥 클릭으로 닫기
      </div>
    </div>

    <!-- 탭 2/3: 콘솔 사용법 & 노멀라이저 FX 뷰 -->
    <div class="help-step-pane hidden" data-ref="stepPane">
      <div class="help-step-head">
        <span class="help-step-badge tabular" data-ref="stepBadge">1 / 4</span>
        <h3 class="help-step-title" data-ref="stepTitle"></h3>
      </div>
      <div class="help-hint-line" data-ref="hintLine">밑줄 친 부품 이름에 커서를 올리면 위치를 미리 보고, 클릭하면 고정됩니다.</div>
      <ul class="help-bullet-list" data-ref="bulletList"></ul>
    </div>
  </div>

  <div data-ref="nestedCard" class="nested-term-card c-raised hidden" aria-live="polite">
    <div class="nested-card-svg-wrap" data-ref="cardSvgWrap"></div>
    <div class="nested-card-info">
      <div class="nested-card-header">
        <span class="nested-card-title" data-ref="cardTitle"></span>
        <span class="nested-card-sub c-muted" data-ref="cardSub"></span>
      </div>
      <p class="nested-card-desc allow-wrap" data-ref="cardDesc"></p>
      <div class="nested-card-tip c-muted" data-ref="cardTip"></div>
    </div>
  </div>

  <div class="help-footer hidden" data-ref="helpFooter">
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
</div>
  `.trim();

  const modalEl = backdrop.querySelector<HTMLElement>(".help-modal")!;
  const tabBtns = modalEl.querySelectorAll<HTMLButtonElement>("[data-help-tab]");
  const closeBtn = modalEl.querySelector<HTMLButtonElement>("[data-help-close]")!;
  const tourIntroPane = modalEl.querySelector<HTMLElement>('[data-ref="tourIntroPane"]')!;
  const stepPane = modalEl.querySelector<HTMLElement>('[data-ref="stepPane"]')!;
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
  const helpFooter = modalEl.querySelector<HTMLElement>('[data-ref="helpFooter"]')!;
  const dots = modalEl.querySelectorAll<HTMLButtonElement>("[data-help-step]");
  const prevBtn = modalEl.querySelector<HTMLButtonElement>("[data-help-prev]")!;
  const nextBtn = modalEl.querySelector<HTMLButtonElement>("[data-help-next]")!;
  const tourStartBtn = modalEl.querySelector<HTMLButtonElement>("[data-tour-start]")!;
  const tourSkipBtn = modalEl.querySelector<HTMLButtonElement>("[data-tour-skip]")!;

  function updateNestedCard(): void {
    const activeKey = pinnedTerm ?? hoveredTerm;
    const chips = bulletList.querySelectorAll<HTMLButtonElement>(".term-chip");
    chips.forEach((c) => {
      const isPinned = c.dataset.term === pinnedTerm && pinnedTerm !== null;
      if (isPinned) c.setAttribute("data-pinned", "true");
      else c.removeAttribute("data-pinned");
    });

    if (!activeKey || currentTab === "tour") {
      nestedCard.classList.add("hidden");
      nestedCard.dataset.pinned = "false";
      return;
    }

    const isPinnedCard = pinnedTerm === activeKey;
    nestedCard.classList.remove("hidden");
    nestedCard.dataset.pinned = String(isPinnedCard);
    const info = TERM_INFO[activeKey];
    cardSvgWrap.innerHTML = renderSchematicSvg(activeKey);
    cardTitle.textContent = info ? info.name : activeKey;
    cardSub.textContent = info ? info.subtitle : "";
    cardDesc.textContent = info ? info.description : "";
    cardTip.textContent = isPinnedCard
      ? "✓ 클릭으로 고정됨 · 칩 다시 클릭 또는 바깥 클릭 시 닫힘"
      : "💡 칩을 클릭하면 화면에 고정됩니다";
  }

  function renderTab(): void {
    tabBtns.forEach((b) => {
      const act = b.dataset.helpTab === currentTab;
      b.setAttribute("data-active", String(act));
      b.setAttribute("aria-selected", String(act));
    });

    if (currentTab === "tour") {
      tourIntroPane.classList.remove("hidden");
      stepPane.classList.add("hidden");
      helpFooter.classList.add("hidden");
      nestedCard.classList.add("hidden");
      return;
    }

    tourIntroPane.classList.add("hidden");
    stepPane.classList.remove("hidden");
    helpFooter.classList.remove("hidden");

    const steps = currentTab === "easy" ? EASY_STEPS : ADV_STEPS;
    const step = steps[currentStep] ?? steps[0]!;

    stepBadge.textContent = `${currentStep + 1} / 4`;
    stepTitle.textContent = step.title;

    hintLine.textContent =
      currentTab === "easy"
        ? "밑줄 친 부품 이름에 커서를 올리면 위치를 미리 보고, 클릭하면 고정됩니다."
        : "밑줄 친 프리셋·부품 이름에 커서를 올려 도면 위치를 확인할 수 있습니다.";

    bulletList.innerHTML = "";
    step.bullets.forEach((bText) => {
      const li = document.createElement("li");
      li.className = "allow-wrap";
      li.innerHTML = formatBulletText(bText);
      bulletList.appendChild(li);
    });

    const chips = bulletList.querySelectorAll<HTMLButtonElement>(".term-chip");
    chips.forEach((chip) => {
      const key = chip.dataset.term as HelpTermKey;
      if (!key) return;

      chip.addEventListener("pointerenter", () => {
        hoveredTerm = key;
        updateNestedCard();
      });

      chip.addEventListener("pointerleave", () => {
        hoveredTerm = null;
        updateNestedCard();
      });

      chip.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (blurTimer) {
          clearTimeout(blurTimer);
          blurTimer = null;
        }
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
            pinnedTerm = null;
            updateNestedCard();
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

  function setTab(tab: HelpTabMode): void {
    if (tab === currentTab) return;
    currentTab = tab;
    currentStep = 0;
    hoveredTerm = null;
    pinnedTerm = null;
    renderTab();
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.helpTab as HelpTabMode;
      if (mode) setTab(mode);
    });
  });

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const idx = Number(dot.dataset.helpStep);
      if (isNaN(idx) || idx === currentStep) return;
      currentStep = idx;
      hoveredTerm = null;
      pinnedTerm = null;
      renderTab();
    });
  });

  prevBtn.addEventListener("click", () => {
    if (currentStep > 0) {
      currentStep--;
      hoveredTerm = null;
      pinnedTerm = null;
      renderTab();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (currentStep < 3) {
      currentStep++;
      hoveredTerm = null;
      pinnedTerm = null;
      renderTab();
    }
  });

  closeBtn.addEventListener("click", () => {
    hoveredTerm = null;
    pinnedTerm = null;
    opts.onRequestClose();
  });

  tourStartBtn.addEventListener("click", () => {
    hoveredTerm = null;
    pinnedTerm = null;
    opts.onStartTour();
  });

  tourSkipBtn.addEventListener("click", () => {
    hoveredTerm = null;
    pinnedTerm = null;
    opts.onRequestClose();
  });

  backdrop.addEventListener("click", (ev) => {
    if (ev.target === backdrop) {
      hoveredTerm = null;
      pinnedTerm = null;
      opts.onRequestClose();
    }
  });

  modalEl.addEventListener("pointerdown", (ev) => {
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    if (target.closest(".term-chip") || target.closest(".nested-term-card")) return;
    if (pinnedTerm !== null) {
      pinnedTerm = null;
      hoveredTerm = null;
      updateNestedCard();
    }
  });

  renderTab();

  return {
    backdrop,
    isNestedPinned: () => pinnedTerm !== null,
    clearNestedPin: () => {
      pinnedTerm = null;
      hoveredTerm = null;
      updateNestedCard();
    },
    setTab,
    getTab: () => currentTab,
  };
}

export function syncHelpModalDom(
  refs: HelpModalRefs,
  open: boolean,
  _t?: ThemeTokens,
): void {
  refs.backdrop.classList.toggle("hidden", !open);
  if (!open) {
    refs.clearNestedPin();
  }
}
