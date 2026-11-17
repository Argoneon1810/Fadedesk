import { getLocalizedPresetMeta } from "../shared/i18n";
import { fxUi } from "../shared/i18n-fx";
import { isBuiltinPreset } from "../shared/fx-model";
import { formatPan } from "../shared/mixer-math";
import type { CompSlot, GateSlot, NormSlot, UserNormPreset } from "../shared/types";

/**
 * 프리셋 id(기본 4종 · 내 프리셋 "u…" · ""=사용자 지정)를 화면 이름으로 바꾸고, 카드 요약 문구를 만든다.
 * 사용자가 붙인 이름이 섞이므로 호출부는 반드시 textContent로 넣는다.
 */

export function presetName(id: string, userPresets: readonly UserNormPreset[]): string | null {
  if (isBuiltinPreset(id)) return getLocalizedPresetMeta(id).shortLabel;
  const u = userPresets.find((p) => p.id === id);
  return u ? u.name : null;
}

export function normSlotLabel(slot: NormSlot, userPresets: readonly UserNormPreset[]): string {
  const copy = fxUi();
  const name = presetName(slot.presetId, userPresets);
  if (!name) return copy.presetCustom;
  return slot.modified ? `${name}${copy.presetModifiedSuffix}` : name;
}

export function normSummary(slot: NormSlot, userPresets: readonly UserNormPreset[]): string {
  if (!slot.enabled) return fxUi().off;
  return `${normSlotLabel(slot, userPresets)} · ${slot.targetLufs} LUFS`;
}

export function gateSummary(slot: GateSlot): string {
  return slot.enabled ? fxUi().gateSummary(slot.thresholdDb) : fxUi().off;
}

export function compSummary(slot: CompSlot): string {
  return slot.enabled ? fxUi().compSummary(slot.ratio) : fxUi().off;
}

export function panSummary(isGlobal: boolean, value: number): string {
  return isGlobal ? fxUi().balanceSummary(formatPan(value)) : fxUi().panFinal(formatPan(value));
}
