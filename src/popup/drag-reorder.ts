import type { TabChannelState, ThemeTokens } from "../shared/types";

/**
 * 상단 그립 핸들(`.grip-bar`) 드래그로 채널 순서를 바꾸고,
 * `재생 중 ↔ 일시정지` 구분선을 넘겨 놓으면 즉시 재생·일시정지 상태를 전환하는 컨트롤러.
 * - 선분 대신 94px 블럭형 드롭 슬롯(`.drop-slot-indicator`)으로 착지 칸과 전환 동작을 직관적으로 표시한다.
 * - 반대편 그룹이 완전히 비어 있을 때만 빈 그룹 안내 블럭(`.drop-zone-empty`)을 노출하고 그 블럭 자체를 드롭 타깃으로 삼는다.
 * - 드래그 진행 중 비동기 SNAPSHOT·토스트 타이머가 DOM 순서를 덮어쓰지 못하도록 활성 드래그 잠금 상태를 제공한다.
 */

let activeDragCount = 0;

export function isChannelReorderDragging(): boolean {
  return activeDragCount > 0;
}

export interface DragReorderOptions {
  ev: PointerEvent;
  movedTabId: number;
  scrollRow: HTMLElement;
  pauseDivider: HTMLElement;
  getChannels: () => TabChannelState[];
  getTokens: () => ThemeTokens;
  onSelectChannel: (tabId: number) => void;
  onCommitReorder: (
    movedTabId: number,
    targetZone: "playing" | "paused",
    orderedPlayingIds: number[],
    orderedPausedIds: number[],
  ) => void;
  onCancel: () => void;
}

export function startChannelReorderDrag(opts: DragReorderOptions): void {
  const {
    ev,
    movedTabId,
    scrollRow,
    pauseDivider,
    getChannels,
    getTokens,
    onSelectChannel,
    onCommitReorder,
    onCancel,
  } = opts;

  if (ev.button !== 0 || activeDragCount > 0) return;
  ev.preventDefault();
  ev.stopPropagation();
  onSelectChannel(movedTabId);

  const channels = getChannels();
  const movedCh = channels.find((c) => c.tabId === movedTabId);
  if (!movedCh) return;

  const activePointerId = ev.pointerId;
  const startX = ev.clientX;
  const origPlaying = movedCh.playing;
  const origZone: "playing" | "paused" = origPlaying ? "playing" : "paused";

  const initialZoneCards = Array.from(
    scrollRow.querySelectorAll<HTMLElement>(`.channel-strip[data-zone="${origZone}"]`),
  );
  const origIdx = Math.max(
    0,
    initialZoneCards.findIndex((el) => Number(el.dataset.tabId) === movedTabId),
  );

  let dragging = false;
  let cleanedUp = false;
  let targetZone: "playing" | "paused" = origZone;
  let targetIdx = origIdx;

  activeDragCount++;

  const slotIndicator = document.createElement("div");
  slotIndicator.className = "drop-slot-indicator";

  const emptyPlayZone = document.createElement("div");
  emptyPlayZone.className = "drop-zone-empty";
  emptyPlayZone.textContent = "여기에 놓아 재생";

  const emptyPauseZone = document.createElement("div");
  emptyPauseZone.className = "drop-zone-empty";
  emptyPauseZone.textContent = "여기에 놓아 일시정지";

  const draggedEl = scrollRow.querySelector<HTMLElement>(
    `.channel-strip[data-tab-id="${movedTabId}"]`,
  );

  const prepareDragZones = (): void => {
    const t = getTokens();
    document.documentElement.dataset.reordering = "true";
    if (draggedEl) draggedEl.dataset.dragging = "true";
    pauseDivider.style.backgroundColor = t.primary;

    const allCards = Array.from(scrollRow.querySelectorAll<HTMLElement>(".channel-strip"));
    const allPlayCards = allCards.filter((c) => c.dataset.zone === "playing");
    const allPauseCards = allCards.filter((c) => c.dataset.zone === "paused");

    // 구분선을 항상 첫 일시정지 카드 앞(없으면 맨 끝)에 정확히 고정
    scrollRow.insertBefore(pauseDivider, allPauseCards[0] ?? null);

    // 반대편 그룹에 채널이 단 하나도 없을 때만 빈 그룹 드롭 슬롯을 표시
    if (!origPlaying && allPlayCards.length === 0) {
      scrollRow.insertBefore(emptyPlayZone, pauseDivider);
    }
    if (origPlaying && allPauseCards.length === 0) {
      scrollRow.appendChild(emptyPauseZone);
    }
  };

  const cleanupDom = (): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    activeDragCount = Math.max(0, activeDragCount - 1);
    delete document.documentElement.dataset.reordering;
    slotIndicator.remove();
    emptyPlayZone.remove();
    emptyPauseZone.remove();
    delete emptyPlayZone.dataset.active;
    delete emptyPauseZone.dataset.active;
    pauseDivider.style.backgroundColor = "";
    if (draggedEl) delete draggedEl.dataset.dragging;
  };

  const unshiftedCenter = (el: HTMLElement, shift: number): number => {
    const r = el.getBoundingClientRect();
    const isFollowing =
      shift > 0 &&
      slotIndicator.isConnected &&
      Boolean(slotIndicator.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
    const left = isFollowing ? r.left - shift : r.left;
    return left + r.width / 2;
  };

  const renderDropTarget = (zoneCards: HTMLElement[]): void => {
    delete emptyPlayZone.dataset.active;
    delete emptyPauseZone.dataset.active;

    // 빈 반대 그룹 안내 블럭이 떠 있고 그 구역이 선택된 경우, 별도 표시기를 옆에 만들지 않고 블럭 자체를 강조
    if (targetZone === "paused" && emptyPauseZone.isConnected) {
      slotIndicator.remove();
      emptyPauseZone.dataset.active = "true";
      return;
    }
    if (targetZone === "playing" && emptyPlayZone.isConnected) {
      slotIndicator.remove();
      emptyPlayZone.dataset.active = "true";
      return;
    }

    // 원래 자기 자리(변화 없음)일 때는 중복 블럭을 띄우지 않음
    if (targetZone === origZone && targetIdx === origIdx) {
      slotIndicator.remove();
      return;
    }

    slotIndicator.textContent =
      targetZone !== origZone
        ? targetZone === "paused"
          ? "여기에 놓아 일시정지"
          : "여기에 놓아 재생"
        : "여기에 배치";

    const refNode =
      targetIdx < zoneCards.length
        ? zoneCards[targetIdx]!
        : targetZone === "playing"
          ? pauseDivider
          : null;

    if (slotIndicator.parentElement !== scrollRow || slotIndicator.nextSibling !== refNode) {
      scrollRow.insertBefore(slotIndicator, refNode);
    }
  };

  const onMove = (moveEv: PointerEvent): void => {
    if (moveEv.pointerId !== activePointerId) return;
    if (!dragging) {
      if (Math.abs(moveEv.clientX - startX) < 4) return;
      dragging = true;
      prepareDragZones();
    }

    // 포인터가 이미 열린 블럭 슬롯 내부에 머물러 있으면 경계 진동 방지를 위해 현재 슬롯 유지
    if (slotIndicator.isConnected) {
      const indRect = slotIndicator.getBoundingClientRect();
      if (moveEv.clientX >= indRect.left - 3 && moveEv.clientX <= indRect.right + 3) {
        return;
      }
    }

    const shift = slotIndicator.isConnected ? slotIndicator.getBoundingClientRect().width + 8 : 0;
    const divCenter = unshiftedCenter(pauseDivider, shift);
    targetZone = moveEv.clientX > divCenter ? "paused" : "playing";

    const zoneCards = Array.from(
      scrollRow.querySelectorAll<HTMLElement>(`.channel-strip[data-zone="${targetZone}"]`),
    ).filter((el) => Number(el.dataset.tabId) !== movedTabId);

    let idx = zoneCards.length;
    for (let i = 0; i < zoneCards.length; i++) {
      if (moveEv.clientX < unshiftedCenter(zoneCards[i]!, shift)) {
        idx = i;
        break;
      }
    }
    targetIdx = idx;
    renderDropTarget(zoneCards);
  };

  const detachListeners = (): void => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancelPointer);
    window.removeEventListener("keydown", onKeyDown, true);
  };

  const finishCancel = (): void => {
    detachListeners();
    cleanupDom();
    onCancel();
  };

  const onCancelPointer = (cancelEv: PointerEvent): void => {
    if (cancelEv.pointerId !== activePointerId) return;
    finishCancel();
  };

  const onKeyDown = (keyEv: KeyboardEvent): void => {
    if (keyEv.key === "Escape") {
      keyEv.preventDefault();
      keyEv.stopPropagation();
      finishCancel();
    }
  };

  const onUp = (upEv: PointerEvent): void => {
    if (upEv.pointerId !== activePointerId) return;
    detachListeners();
    cleanupDom();

    if (!dragging || (targetZone === origZone && targetIdx === origIdx)) {
      onCancel();
      return;
    }

    const latest = getChannels().filter((c) => c.tabId !== movedTabId);
    const playIds = latest.filter((c) => c.playing).map((c) => c.tabId);
    const pauseIds = latest.filter((c) => !c.playing).map((c) => c.tabId);

    if (targetZone === "playing") {
      playIds.splice(Math.min(targetIdx, playIds.length), 0, movedTabId);
    } else {
      pauseIds.splice(Math.min(targetIdx, pauseIds.length), 0, movedTabId);
    }
    onCommitReorder(movedTabId, targetZone, playIds, pauseIds);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancelPointer);
  window.addEventListener("keydown", onKeyDown, true);
}
