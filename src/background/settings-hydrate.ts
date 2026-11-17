import { clampPan, migrateGlobalFx, sanitizeFxLayer, sanitizeUserPresets } from "../shared/fx-model";
import { clampAlpha, clampDb } from "../shared/mixer-math";
import type { ModePref, PersistedSettings, ThemeKey } from "../shared/types";

/**
 * chrome.storage.local에서 읽은 설정을 검증해 기존 설정 위에 덮는다.
 * 1.1.0 이하 설정(`autoNormEnabled`·`autoNormPreset`)은 "모든 채널" 노멀라이저로 옮긴다.
 */
export function hydrateSettingsInto(settings: PersistedSettings, raw?: Record<string, unknown> | null): void {
  if (!raw || typeof raw !== "object") return;
  const validThemes: ThemeKey[] = ["teal", "amber", "cobalt", "emerald"];
  const validModes: ModePref[] = ["dark", "light", "system"];

  if (validThemes.includes(raw.theme as ThemeKey)) settings.theme = raw.theme as ThemeKey;
  if (validModes.includes(raw.modePref as ModePref)) settings.modePref = raw.modePref as ModePref;
  if (raw.normVizMode === "spectrum2d" || raw.normVizMode === "bar1d") settings.normVizMode = raw.normVizMode;
  if (typeof raw.onboardingDone === "boolean") settings.onboardingDone = raw.onboardingDone;
  if (typeof raw.alpha === "number") settings.alpha = clampAlpha(raw.alpha);
  if (typeof raw.masterDb === "number") settings.masterDb = clampDb(raw.masterDb, false);
  if (typeof raw.masterMuted === "boolean") settings.masterMuted = raw.masterMuted;
  if (typeof raw.advRackOpen === "boolean") settings.advRackOpen = raw.advRackOpen;
  if (typeof raw.popoutWidth === "number" && Number.isFinite(raw.popoutWidth)) {
    settings.popoutWidth = Math.round(Math.max(520, Math.min(2560, raw.popoutWidth)));
  }
  if (typeof raw.popoutHeight === "number" && Number.isFinite(raw.popoutHeight)) {
    settings.popoutHeight = Math.round(Math.max(420, Math.min(1600, raw.popoutHeight)));
  }
  if (raw.domainDefaults && typeof raw.domainDefaults === "object") {
    const cleaned: Record<string, number> = {};
    for (const [domain, val] of Object.entries(raw.domainDefaults as Record<string, unknown>)) {
      if (domain && typeof val === "number" && Number.isFinite(val)) cleaned[domain] = clampDb(val, false);
    }
    settings.domainDefaults = cleaned;
  }

  settings.globalFx = migrateGlobalFx(raw);
  settings.globalPan = clampPan(raw.globalPan);
  settings.userPresets = sanitizeUserPresets(raw.userPresets);
  // 지워진 내 프리셋을 가리키는 전역 슬롯은 "사용자 지정"으로 둔다
  const ids = new Set(settings.userPresets.map((p) => p.id));
  const pid = settings.globalFx.norm.presetId;
  if (pid.startsWith("u") && !ids.has(pid)) {
    settings.globalFx = sanitizeFxLayer({ ...settings.globalFx, norm: { ...settings.globalFx.norm, presetId: "" } });
  }
}

/** 설정을 깊게 복사한다 (스냅샷·저장용). */
export function cloneSettings(s: PersistedSettings): PersistedSettings {
  return {
    ...s,
    domainDefaults: { ...s.domainDefaults },
    globalFx: {
      norm: { ...s.globalFx.norm },
      gate: { ...s.globalFx.gate },
      comp: { ...s.globalFx.comp },
    },
    userPresets: s.userPresets.map((p) => ({ ...p })),
  };
}
