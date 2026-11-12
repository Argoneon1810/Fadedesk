import type { ThemeTokens } from "../shared/types";
import { helpCopy } from "./help-copy";
import {
  getTermInfo,
  renderSchematicSvg,
  TERM_CHIP_MAP,
  type HelpTermKey,
} from "./help-schematic";

/**
 * Fadedesk 한·영 튜토리얼 안내 모달, 5단계 안전·유의사항, 중첩 시각 용어 카드 뷰 모듈.
 * 3개 탭(빠른 투어 · 콘솔 사용법[5단계 안전 포함] · 노멀라이저·고급 FX) 및 실화면 스포트라이트 투어 연동.
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

function escapeRegex(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CHIP_PATTERN = Object.keys(TERM_CHIP_MAP)
  .sort((a, b) => b.length - a.length)
  .map(escapeRegex)
  .join("|");

const CHIP_REGEX = new RegExp(`\\[(${CHIP_PATTERN})\\]`, "g");

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

  const copy = helpCopy();
  let currentTab: HelpTabMode = "tour";
  let currentStep = 0;
  let hoveredTerm: HelpTermKey | null = null;
  let pinnedTerm: HelpTermKey | null = null;
  let blurTimer: number | null = null;

  const introListHtml = copy.introItems
    .map(
      (item) =>
        `<li class="tour-intro-item allow-wrap"><strong>${item.lead}</strong>: ${item.body}</li>`,
    )
    .join("");

  const maxDots = Math.max(copy.easySteps.length, copy.advSteps.length);
  const stepDotsHtml = Array.from({ length: maxDots }, (_, idx) => {
    const active = idx === 0;
    return `<button type="button" class="help-step-dot" data-help-step="${idx}" aria-label="${copy.stepAria(idx)}" data-active="${active}"></button>`;
  }).join("");

  backdrop.className = "help-backdrop hidden";
  backdrop.innerHTML = `
<div class="help-modal c-surface" role="dialog" aria-modal="true" aria-label="${copy.dialogAria}">
  <div class="help-header">
    <div class="help-tab-group" role="tablist">
      <button type="button" class="help-tab-btn" data-help-tab="tour" role="tab" aria-selected="true" data-active="true">${copy.tabTour}</button>
      <button type="button" class="help-tab-btn" data-help-tab="easy" role="tab" aria-selected="false" data-active="false">${copy.tabEasy}</button>
      <button type="button" class="help-tab-btn" data-help-tab="adv" role="tab" aria-selected="false" data-active="false">${copy.tabAdv}</button>
    </div>
    <button type="button" class="help-close-btn" data-help-close aria-label="${copy.closeAria}">✕</button>
  </div>

  <div class="help-body">
    <!-- 탭 1: 빠른 투어 런처 -->
    <div class="tour-intro-pane" data-ref="tourIntroPane">
      <div class="tour-intro-head">
        <span class="tour-intro-badge">${copy.introBadge}</span>
        <h3 class="tour-intro-title allow-wrap">${copy.introTitle}</h3>
      </div>
      <ul class="tour-intro-list">${introListHtml}</ul>
      <p class="tour-intro-note allow-wrap">${copy.introNote}</p>
      <div class="tour-intro-actions">
        <button type="button" class="help-tour-start-btn" data-tour-start>${copy.tourStartBtn}</button>
        <button type="button" class="help-tour-skip-btn" data-tour-skip>${copy.tourSkipBtn}</button>
      </div>
      <div class="tour-intro-sub allow-wrap">${copy.introSub}</div>
    </div>

    <!-- 탭 2/3: 콘솔 사용법 & 노멀라이저 FX 뷰 -->
    <div class="help-step-pane hidden" data-ref="stepPane">
      <div class="help-step-head">
        <span class="help-step-badge tabular" data-ref="stepBadge">1 / ${copy.easySteps.length}</span>
        <h3 class="help-step-title" data-ref="stepTitle"></h3>
      </div>
      <div class="help-hint-line allow-wrap" data-ref="hintLine">${copy.easyHint}</div>
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
    <div class="help-step-dots" role="tablist">${stepDotsHtml}</div>
    <div class="help-nav-actions">
      <button type="button" class="help-nav-btn help-prev-btn" data-help-prev disabled>${copy.prevBtn}</button>
      <button type="button" class="help-nav-btn help-next-btn" data-help-next>${copy.nextBtn}</button>
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

  function activeSteps() {
    return currentTab === "easy" ? copy.easySteps : copy.advSteps;
  }

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
    const info = getTermInfo(activeKey);
    cardSvgWrap.innerHTML = renderSchematicSvg(activeKey);
    cardTitle.textContent = info ? info.name : activeKey;
    cardSub.textContent = info ? info.subtitle : "";
    cardDesc.textContent = info ? info.description : "";
    cardTip.textContent = isPinnedCard ? copy.pinnedTip : copy.unpinnedTip;
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

    const steps = activeSteps();
    if (currentStep >= steps.length) currentStep = 0;
    const step = steps[currentStep] ?? steps[0]!;

    stepBadge.textContent = `${currentStep + 1} / ${steps.length}`;
    stepTitle.textContent = step.title;

    hintLine.textContent =
      currentTab === "easy" && currentStep === steps.length - 1
        ? copy.safetyHint
        : currentTab === "easy"
          ? copy.easyHint
          : copy.advHint;

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
      const outOfRange = idx >= steps.length;
      dot.classList.toggle("hidden", outOfRange);
      const active = !outOfRange && idx === currentStep;
      dot.setAttribute("data-active", String(active));
      dot.setAttribute("aria-selected", String(active));
    });

    prevBtn.disabled = currentStep === 0;
    nextBtn.disabled = currentStep >= steps.length - 1;
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
      const steps = activeSteps();
      if (isNaN(idx) || idx < 0 || idx >= steps.length || idx === currentStep) return;
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
    const steps = activeSteps();
    if (currentStep < steps.length - 1) {
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
