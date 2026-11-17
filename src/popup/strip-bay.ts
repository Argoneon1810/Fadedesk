import { ui } from "../shared/i18n";
import type { TabChannelState } from "../shared/types";
import { isChannelReorderDragging } from "./drag-reorder";
import { ICONS } from "./icons";
import { buildChannelStripDom, type ChannelStripRefs, type StripCallbacks } from "./strip-view";

/**
 * 채널 스트립 줄(`#channels-scroll`)의 DOM을 채널 목록에 맞춘다.
 * 재생 구역 → 대기 구분선 → 대기 구역 순서를 지키고, 채널이 없으면 빈 콘솔 안내를 보인다.
 */

export const stripMap = new Map<number, ChannelStripRefs>();
export const pauseDivider = document.createElement("div");
pauseDivider.className = "pause-divider";

const emptyBay = document.createElement("div");
emptyBay.className = "empty-bay";

export function syncEmptyBayCopy(): void {
  const dict = ui();
  emptyBay.innerHTML = `<div class="empty-icon">${ICONS.consoleEmpty}</div><div class="empty-title">${dict.emptyTitle}</div><div class="empty-desc">${dict.emptyDesc}</div>`;
}

/** 스트립 DOM을 맞추고, 사라진 채널이 선택돼 있었으면 새 선택 탭 id를 돌려준다. */
export function reconcileChannelStrips(
  channels: TabChannelState[],
  selectedTabId: number | null,
  findChannel: (tabId: number) => TabChannelState | undefined,
  callbacks: StripCallbacks,
): number | null {
  if (isChannelReorderDragging()) return selectedTabId;
  const scrollRow = document.getElementById("channels-scroll")!;
  const liveIds = new Set(channels.map((c) => c.tabId));

  for (const [tabId, ref] of stripMap.entries()) {
    if (!liveIds.has(tabId)) { ref.el.remove(); stripMap.delete(tabId); }
  }
  let nextSel = selectedTabId;
  if (nextSel !== null && !liveIds.has(nextSel)) nextSel = channels[0]?.tabId ?? null;
  if (channels.length === 0) {
    pauseDivider.remove();
    if (!emptyBay.isConnected) scrollRow.appendChild(emptyBay);
    return nextSel;
  }
  emptyBay.remove();

  for (const ch of channels) {
    if (!stripMap.has(ch.tabId)) {
      stripMap.set(ch.tabId, buildChannelStripDom(ch, () => findChannel(ch.tabId), callbacks));
    }
  }

  const playing = channels.filter((c) => c.playing);
  const paused = channels.filter((c) => !c.playing);
  const desiredNodes: HTMLElement[] = [];
  for (const ch of playing) desiredNodes.push(stripMap.get(ch.tabId)!.el);
  if (playing.length > 0 && paused.length > 0) desiredNodes.push(pauseDivider);
  for (const ch of paused) desiredNodes.push(stripMap.get(ch.tabId)!.el);
  if (playing.length === 0 || paused.length === 0) pauseDivider.remove();

  desiredNodes.forEach((node, idx) => {
    const currentAtIdx = scrollRow.children[idx];
    if (currentAtIdx !== node) scrollRow.insertBefore(node, currentAtIdx ?? null);
  });
  return nextSel;
}
