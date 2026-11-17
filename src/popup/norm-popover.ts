import { getLocalizedPresetMeta, ui } from "../shared/i18n";
import { fxUi } from "../shared/i18n-fx";
import { BUILTIN_PRESET_KEYS, isBuiltinPreset } from "../shared/fx-model";
import type { PersistedSettings, TabChannelState, ThemeTokens } from "../shared/types";
import { normSlotLabel } from "./fx-labels";
import { buildPopoverMiniVizDom, syncPopoverMiniVizDom } from "./norm-visualizer";

/**
 * 전역 이지 노멀라이저 스플릿 버튼(#auto-norm-btn, #auto-norm-preset-btn) 및
 * 플로팅 프리셋 선택 팝오버(#norm-popover, 4종 프리셋 + 미니 실시간 시각화) 뷰 모듈.
 */

export function renderNormPopoverDom(
  settings: PersistedSettings,
  open: boolean,
  t: ThemeTokens,
  onSelectPreset: (presetId: string) => void,
  selectedChannel?: TabChannelState,
): void {
  const copy = ui();
  const slot = settings.globalFx.norm;
  const enabled = slot.enabled;
  const curPreset = slot.modified ? "" : slot.presetId;
  const badgeDetail = isBuiltinPreset(slot.presetId) && !slot.modified
    ? getLocalizedPresetMeta(slot.presetId).badge.split("·")[1]?.trim() ?? ""
    : `${slot.targetLufs} LUFS`;
  const slotName = normSlotLabel(slot, settings.userPresets);
  const presetDesc = badgeDetail ? `${slotName} · ${badgeDetail}` : slotName;

  // 1. #auto-norm-btn 동기화 (폭 변화 0px 보장)
  const normBtn = document.getElementById("auto-norm-btn") as HTMLButtonElement | null;
  if (normBtn) {
    normBtn.textContent = copy.autoNormLabel;
    normBtn.title = copy.autoNormBtnTitle(presetDesc);
    if (enabled) {
      normBtn.style.backgroundColor = t.primary;
      normBtn.style.color = t.onPrimary;
      normBtn.style.borderColor = t.primary;
      normBtn.style.fontWeight = "700";
    } else {
      normBtn.style.backgroundColor = t.raised;
      normBtn.style.color = t.text;
      normBtn.style.borderColor = t.border;
      normBtn.style.fontWeight = "500";
    }
  }

  // 2. #auto-norm-preset-btn 동기화
  const presetBtn = document.getElementById("auto-norm-preset-btn") as HTMLButtonElement | null;
  if (presetBtn) {
    presetBtn.textContent = open ? "▴" : "▾";
    presetBtn.setAttribute("aria-expanded", String(open));
    presetBtn.setAttribute("aria-haspopup", "dialog");
    presetBtn.title = copy.autoNormPresetTitle(presetDesc);
    if (open) {
      presetBtn.style.backgroundColor = t.raised;
      presetBtn.style.color = t.primary;
      presetBtn.style.borderColor = t.primary;
      presetBtn.style.fontWeight = "700";
    } else if (enabled) {
      presetBtn.style.backgroundColor = t.primary;
      presetBtn.style.color = t.onPrimary;
      presetBtn.style.borderColor = t.primary;
      presetBtn.style.fontWeight = "700";
    } else {
      presetBtn.style.backgroundColor = t.raised;
      presetBtn.style.color = t.text;
      presetBtn.style.borderColor = t.border;
      presetBtn.style.fontWeight = "500";
    }
  }

  // 3. #norm-popover 동기화
  const pop = document.getElementById("norm-popover");
  if (!pop) return;

  pop.classList.toggle("hidden", !open);
  pop.setAttribute("aria-hidden", String(!open));
  if (!open) return;

  pop.style.backgroundColor = t.surface;
  pop.style.borderColor = t.border;
  pop.style.color = t.text;

  const rootEl = document.getElementById("console-root");
  if (rootEl && presetBtn) {
    const rootRect = rootEl.getBoundingClientRect();
    const btnRect = presetBtn.getBoundingClientRect();
    if (rootRect.height > 0 && btnRect.height > 0) {
      pop.style.top = `${Math.max(44, Math.round(btnRect.bottom - rootRect.top + 4))}px`;
    }
  }

  pop.innerHTML = "";

  const headEl = document.createElement("div");
  headEl.className = "pop-header";

  const titleEl = document.createElement("span");
  titleEl.className = "c-muted pop-label";
  titleEl.textContent = copy.normHeader;
  headEl.appendChild(titleEl);

  const sumEl = document.createElement("span");
  sumEl.id = "norm-pop-cur-summary";
  sumEl.className = "pop-summary tabular";
  sumEl.style.color = t.primary;
  sumEl.textContent = `${presetDesc} (${enabled ? "ON" : "OFF"})`;
  headEl.appendChild(sumEl);

  pop.appendChild(headEl);

  const listEl = document.createElement("div");
  listEl.className = "norm-preset-list";
  listEl.setAttribute("role", "radiogroup");
  listEl.setAttribute("aria-label", copy.normListAria);

  const miniVizEl = buildPopoverMiniVizDom(selectedChannel, settings, t);

  for (const key of BUILTIN_PRESET_KEYS) {
    const meta = getLocalizedPresetMeta(key);
    const active = curPreset === key;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `norm-preset-item${active ? " active" : ""}`;
    btn.setAttribute("data-norm-preset", key);
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", String(active));
    btn.style.backgroundColor = active ? t.raised : t.bg;
    btn.style.borderColor = active ? t.primary : t.border;
    btn.style.color = t.text;

    const headSpan = document.createElement("span");
    headSpan.className = "norm-preset-head";

    const nameSpan = document.createElement("span");
    nameSpan.className = "norm-preset-name";
    nameSpan.textContent = meta.label;
    headSpan.appendChild(nameSpan);

    const badgeSpan = document.createElement("span");
    badgeSpan.className = "norm-preset-badge tabular";
    badgeSpan.textContent = meta.badge;
    badgeSpan.style.color = active ? t.primary : t.muted;
    headSpan.appendChild(badgeSpan);

    btn.appendChild(headSpan);

    const descSpan = document.createElement("span");
    descSpan.className = "norm-preset-desc allow-wrap";
    descSpan.textContent = meta.summary;
    btn.appendChild(descSpan);

    const specSpan = document.createElement("span");
    specSpan.className = "norm-preset-spec tabular allow-wrap";
    specSpan.textContent = meta.spec;
    btn.appendChild(specSpan);

    const showHoverPreview = (): void => {
      if (!active) {
        btn.style.borderColor = t.accent;
      }
      syncPopoverMiniVizDom(miniVizEl, selectedChannel, settings, t, key);
    };
    const clearHoverPreview = (): void => {
      if (!active) {
        btn.style.borderColor = t.border;
      }
      syncPopoverMiniVizDom(miniVizEl, selectedChannel, settings, t, null);
    };

    btn.addEventListener("pointerenter", showHoverPreview);
    btn.addEventListener("focus", showHoverPreview);
    btn.addEventListener("pointerleave", clearHoverPreview);
    btn.addEventListener("blur", clearHoverPreview);

    btn.onclick = (ev) => {
      ev.stopPropagation();
      onSelectPreset(key);
    };

    listEl.appendChild(btn);
  }

  pop.appendChild(listEl);

  // 내 프리셋 (사용자 이름은 textContent로만 넣는다)
  if (settings.userPresets.length > 0) {
    const mineHead = document.createElement("div");
    mineHead.className = "c-muted pop-label norm-mine-head";
    mineHead.textContent = fxUi().popoverMine;
    pop.appendChild(mineHead);
    const mineList = document.createElement("div");
    mineList.className = "norm-mine-list";
    for (const p of settings.userPresets) {
      const active = curPreset === p.id;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `norm-mine-item${active ? " active" : ""}`;
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", String(active));
      btn.style.backgroundColor = active ? t.raised : t.bg;
      btn.style.borderColor = active ? t.primary : t.border;
      btn.style.color = t.text;
      const name = document.createElement("span");
      name.className = "truncate";
      name.textContent = `★ ${p.name}`;
      const spec = document.createElement("span");
      spec.className = "tabular c-muted";
      spec.textContent = `${p.targetLufs} · ${ui().fxNormSpeeds[p.speed]}`;
      btn.append(name, spec);
      btn.addEventListener("pointerenter", () => syncPopoverMiniVizDom(miniVizEl, selectedChannel, settings, t, p.id));
      btn.addEventListener("pointerleave", () => syncPopoverMiniVizDom(miniVizEl, selectedChannel, settings, t, null));
      btn.onclick = (ev) => {
        ev.stopPropagation();
        onSelectPreset(p.id);
      };
      mineList.appendChild(btn);
    }
    pop.appendChild(mineList);
  }
  const note = document.createElement("div");
  note.className = "norm-pop-note allow-wrap";
  note.textContent = fxUi().popoverNote;
  pop.appendChild(note);
  pop.appendChild(miniVizEl);
}
