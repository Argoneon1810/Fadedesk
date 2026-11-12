import { getThemeLabel, ui } from "../shared/i18n";
import { PALETTES } from "../shared/palettes";
import type { ModePref, PersistedSettings, ThemeKey, ThemeTokens } from "../shared/types";

/**
 * 좌측 상단 컬러 점 버튼으로 여닫는 플로팅 미니 테마·화면 모드 선택 팝오버 뷰 모듈.
 */

export function renderThemePopoverDom(
  settings: PersistedSettings,
  popoverOpen: boolean,
  isDark: boolean,
  t: ThemeTokens,
  onSelectThemeAndMode: (theme: ThemeKey, modePref: ModePref) => void,
): void {
  const copy = ui();
  const pop = document.getElementById("theme-popover")!;
  const dotBtn = document.getElementById("theme-dot-btn")!;
  const brandDot = document.getElementById("brand-dot")!;

  dotBtn.setAttribute("aria-expanded", String(popoverOpen));
  dotBtn.style.backgroundColor = popoverOpen ? t.raised : t.bg;
  dotBtn.style.borderColor = popoverOpen ? t.primary : t.border;
  brandDot.style.backgroundColor = t.primary;
  pop.classList.toggle("hidden", !popoverOpen);
  if (!popoverOpen) return;

  const pref = settings.modePref;
  const modeName =
    pref === "system" ? copy.systemResolvedLabel(isDark) : copy.modeLabels[pref];
  const curSum = document.getElementById("pop-cur-summary")!;
  curSum.textContent = `${getThemeLabel(settings.theme)} · ${modeName}`;
  curSum.style.color = t.primary;

  const effMode = isDark ? "dark" : "light";
  const grid = document.getElementById("pop-theme-grid")!;
  grid.innerHTML = "";
  (Object.keys(PALETTES) as ThemeKey[]).forEach((key) => {
    const entry = PALETTES[key];
    const active = settings.theme === key;
    const sw = entry[effMode];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "console-btn pop-theme-btn";
    btn.style.backgroundColor = active ? t.raised : t.bg;
    btn.style.borderColor = active ? sw.primary : t.border;
    btn.style.color = t.text;
    btn.style.fontWeight = active ? "700" : "500";
    btn.innerHTML = `<span class="swatch-main" style="background:${sw.primary}"><span class="swatch-sub" style="background:${sw.accent};border-color:${active ? t.raised : t.bg}"></span></span><span>${getThemeLabel(key)}</span>`;
    btn.onclick = (ev) => {
      ev.stopPropagation();
      onSelectThemeAndMode(key, settings.modePref);
    };
    grid.appendChild(btn);
  });

  const seg = document.getElementById("pop-mode-seg")!;
  seg.innerHTML = "";
  const modes: Array<[ModePref, string]> = [
    ["dark", copy.modeLabels.dark],
    ["light", copy.modeLabels.light],
    ["system", copy.modeLabels.system],
  ];
  for (const [mKey, label] of modes) {
    const active = settings.modePref === mKey;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "console-btn pop-mode-btn";
    btn.style.backgroundColor = active ? t.primary : t.bg;
    btn.style.color = active ? t.onPrimary : t.muted;
    btn.style.fontWeight = active ? "700" : "500";
    btn.textContent = label;
    btn.onclick = (ev) => {
      ev.stopPropagation();
      onSelectThemeAndMode(settings.theme, mKey);
    };
    seg.appendChild(btn);
  }
}
