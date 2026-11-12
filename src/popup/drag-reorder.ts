import type { TabChannelState, ThemeTokens } from "../shared/types";

/**
 * 상단 그립 핸들(`.grip-bar`) 드래그로 채널 순서를 바꾸고,
 * `재생 중 ↔ 일시정지` 구분선을 넘겨 놓으면 즉시 재생·일시정지 상태를 전환하는 컨트롤러.
 */

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

  if (ev.button !== 0) return;
  ev.preventDefault();
  ev.stopPropagation();
  onSelectChannel(movedTabId);

  const startX = ev.clientX;
  const channels = getChannels();
  const movedCh = channels.find((c) => c.tabId === movedTabId);
  if (!movedCh) return;

  let dragging = false;
  let targetZone: "playing" | "paused" = movedCh.playing ? "playing" : "paused";
  let targetIdx = 0;

  const marker = document.createElement("div");
  marker.className = "drop-marker";

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
    if (draggedEl) draggedEl.dataset.dragging = "true";
    pauseDivider.style.backgroundColor = t.primary;
    emptyPlayZone.style.borderColor = t.primary;
    emptyPauseZone.style.borderColor = t.primary;

    const allCards = Array.from(scrollRow.querySelectorAll<HTMLElement>(".channel-strip"));
    const firstPaused = allCards.find((c) => c.dataset.zone === "paused");
    if (!pauseDivider.isConnected) {
      scrollRow.insertBefore(pauseDivider, firstPaused ?? null);
    }

    const otherPlay = allCards.filter(
      (c) => c.dataset.zone === "playing" && Number(c.dataset.tabId) !== movedTabId,
    );
    const otherPause = allCards.filter(
      (c) => c.dataset.zone === "paused" && Number(c.dataset.tabId) !== movedTabId,
    );

    if (otherPlay.length === 0 && !emptyPlayZone.isConnected) {
      scrollRow.insertBefore(emptyPlayZone, pauseDivider);
    }
    if (otherPause.length === 0 && !emptyPauseZone.isConnected) {
      scrollRow.appendChild(emptyPauseZone);
    }
  };

  const cleanupDom = (): void => {
    marker.remove();
    emptyPlayZone.remove();
    emptyPauseZone.remove();
    pauseDivider.style.backgroundColor = "";
    if (draggedEl) delete draggedEl.dataset.dragging;
  };

  const onMove = (moveEv: PointerEvent): void => {
    if (!dragging) {
      if (Math.abs(moveEv.clientX - startX) < 4) return;
      dragging = true;
      prepareDragZones();
    }

    const divRect = pauseDivider.getBoundingClientRect();
    targetZone = moveEv.clientX > divRect.left + divRect.width / 2 ? "paused" : "playing";

    const zoneCards = Array.from(
      scrollRow.querySelectorAll<HTMLElement>(`.channel-strip[data-zone="${targetZone}"]`),
    ).filter((el) => Number(el.dataset.tabId) !== movedTabId);

    let idx = zoneCards.length;
    for (let i = 0; i < zoneCards.length; i++) {
      const r = zoneCards[i]!.getBoundingClientRect();
      if (moveEv.clientX < r.left + r.width / 2) {
        idx = i;
        break;
      }
    }
    targetIdx = idx;

    marker.remove();
    if (idx < zoneCards.length) {
      scrollRow.insertBefore(marker, zoneCards[idx]!);
    } else if (targetZone === "playing") {
      scrollRow.insertBefore(marker, pauseDivider);
    } else {
      scrollRow.appendChild(marker);
    }
  };

  const onUp = (): void => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    cleanupDom();

    if (!dragging) {
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
  window.addEventListener("pointercancel", onUp);
}
