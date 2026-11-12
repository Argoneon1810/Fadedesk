import { AUTO_NORM_PRESET_META } from "../shared/mixer-math";
import type { AutoNormPreset, PersistedSettings, ThemeTokens } from "../shared/types";

/**
 * 전역 이지 노멀라이저 스플릿 버튼(#auto-norm-btn, #auto-norm-preset-btn) 및
 * 플로팅 프리셋 선택 팝오버(#norm-popover) 뷰 모듈.
 * - 음악(강약 보존) / 표준(균형) / 야간(야간 보호) 3종 프리셋을 전환한다.
 */

export function renderNormPopoverDom(
  settings: PersistedSettings,
  open: boolean,
  t: ThemeTokens,
  onSelectPreset: (preset: AutoNormPreset) => void,
): void {
  const curPreset: AutoNormPreset = settings.autoNormPreset ?? "standard";
  const curMeta = AUTO_NORM_PRESET_META[curPreset] ?? AUTO_NORM_PRESET_META.standard;
  const badgeDetail = curMeta.badge.split("·")[1]?.trim() ?? "";
  const presetDesc = badgeDetail ? `${curMeta.shortLabel} · ${badgeDetail}` : curMeta.shortLabel;

  // 1. #auto-norm-btn 동기화 (폭 변화 0px 보장)
  const normBtn = document.getElementById("auto-norm-btn") as HTMLButtonElement | null;
  if (normBtn) {
    normBtn.textContent = "균일 N";
    normBtn.title = `전역 자동 노멀라이저 (현재 프리셋: ${presetDesc}) — 클릭 시 ON/OFF`;
    if (settings.autoNormEnabled) {
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
    presetBtn.title = `자동 노멀라이저 프리셋 선택 (현재: ${presetDesc})`;
    if (open) {
      presetBtn.style.backgroundColor = t.raised;
      presetBtn.style.color = t.primary;
      presetBtn.style.borderColor = t.primary;
      presetBtn.style.fontWeight = "700";
    } else if (settings.autoNormEnabled) {
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
  titleEl.textContent = "이지 노멀라이저 프리셋";
  headEl.appendChild(titleEl);

  const sumEl = document.createElement("span");
  sumEl.id = "norm-pop-cur-summary";
  sumEl.className = "pop-summary tabular";
  sumEl.style.color = t.primary;
  sumEl.textContent = `${presetDesc} (${settings.autoNormEnabled ? "ON" : "OFF"})`;
  headEl.appendChild(sumEl);

  pop.appendChild(headEl);

  const listEl = document.createElement("div");
  listEl.className = "norm-preset-list";
  listEl.setAttribute("role", "radiogroup");
  listEl.setAttribute("aria-label", "이지 노멀라이저 프리셋 목록");

  const presetKeys: AutoNormPreset[] = ["music", "standard", "night"];
  for (const key of presetKeys) {
    const meta = AUTO_NORM_PRESET_META[key];
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

    btn.onclick = (ev) => {
      ev.stopPropagation();
      onSelectPreset(key);
    };

    listEl.appendChild(btn);
  }

  pop.appendChild(listEl);
}
