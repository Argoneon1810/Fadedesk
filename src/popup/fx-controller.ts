import { fxUi } from "../shared/i18n-fx";
import {
  applyChannelFxEdit, applyGlobalFxEdit, detachSlotFromPreset, newUserPresetId,
  overwriteUserPreset, renameUserPreset, saveUserPreset, settingsEditContext,
} from "../shared/fx-model";
import type {
  FxEdit, FxModuleKey, FxTarget, NormSlot, PersistedSettings, PopupActionMessage, TabChannelState,
} from "../shared/types";

/**
 * 고급 FX 랙의 범위("모든 채널" / "이 채널")와 세부 창 상태를 쥐고, 편집을 즉시 반영한 뒤 백그라운드로 보낸다.
 * 즉시 반영과 백그라운드 반영이 같은 공용 함수(`applyGlobalFxEdit`·`applyChannelFxEdit`)를 써서 어긋나지 않는다.
 */

export type FxScope = "global" | "channel";
export type FxPanel = FxModuleKey | "pan";

export interface FxControllerDeps {
  getSettings: () => PersistedSettings;
  getAllChannels: () => TabChannelState[];
  getSelectedChannel: () => TabChannelState | undefined;
  sendAction: (msg: PopupActionMessage) => void;
  renderAll: () => void;
  flashToast: (text: string) => void;
}

export interface FxView {
  scope: FxScope;
  detail: FxPanel | null;
  hint: FxPanel | null;
  ch: TabChannelState | undefined;
}

export interface FxController {
  view: () => FxView;
  isGlobal: () => boolean;
  selectGlobal: () => void;
  selectChannelScope: () => void;
  toggleDetail: (panel: FxPanel) => void;
  closeDetail: () => boolean;
  pokeLocked: (panel: FxPanel) => void;
  edit: (edit: FxEdit) => void;
  editNorm: (slotPatch: Parameters<typeof normEdit>[0]) => void;
  pickPreset: (presetId: string) => void;
  savePreset: (name: string) => void;
  overwritePreset: () => void;
  renamePreset: (id: string, name: string) => void;
  deletePreset: (id: string) => void;
  currentNormSlot: () => NormSlot;
  isLocked: (panel: FxPanel) => boolean;
}

function normEdit(patch: Extract<FxEdit, { kind: "norm" }>["patch"]): FxEdit {
  return { kind: "norm", patch };
}

export function createFxController(deps: FxControllerDeps): FxController {
  let scope: FxScope = "channel";
  let detail: FxPanel | null = null;
  let hint: FxPanel | null = null;

  const ctxOf = (s: PersistedSettings) => settingsEditContext(s);

  const target = (): FxTarget | null => {
    if (scope === "global") return "global";
    const ch = deps.getSelectedChannel();
    return ch ? ch.tabId : null;
  };

  const isLocked = (panel: FxPanel): boolean => {
    if (panel === "pan" || scope === "global") return false;
    const ch = deps.getSelectedChannel();
    return !ch || !ch.fx.own[panel];
  };

  const send = (msg: PopupActionMessage, tgt: FxTarget): void => {
    if (tgt === "global" || tgt >= 0) deps.sendAction(msg);
  };

  const currentNormSlot = (): NormSlot => {
    const s = deps.getSettings();
    if (scope === "global") return s.globalFx.norm;
    return deps.getSelectedChannel()?.fx.own.norm ?? s.globalFx.norm;
  };

  const setNormSlot = (tgt: FxTarget, slot: NormSlot): void => {
    const s = deps.getSettings();
    if (tgt === "global") s.globalFx.norm = slot;
    else {
      const ch = deps.getSelectedChannel();
      if (ch) ch.fx = { ...ch.fx, own: { ...ch.fx.own, norm: slot } };
    }
  };

  const edit = (e: FxEdit): void => {
    const tgt = target();
    if (tgt === null) return;
    const s = deps.getSettings();
    if (tgt === "global") {
      if (!applyGlobalFxEdit(ctxOf(s), e)) return;
    } else {
      const ch = deps.getSelectedChannel();
      if (!ch || ch.corsCap) return;
      const next = applyChannelFxEdit(ch.fx, ctxOf(s), e);
      if (!next) {
        if (e.kind === "norm" || e.kind === "gate" || e.kind === "comp" || e.kind === "pickPreset") {
          hint = e.kind === "pickPreset" ? "norm" : e.kind;
          deps.renderAll();
        }
        return;
      }
      ch.fx = next;
    }
    if (e.kind === "detach" || e.kind === "relink") hint = null;
    send({ source: "popup", type: "EDIT_FX", target: tgt, edit: e }, tgt);
    deps.renderAll();
  };

  return {
    view: () => ({ scope, detail, hint, ch: deps.getSelectedChannel() }),
    isGlobal: () => scope === "global",
    selectGlobal: () => {
      scope = "global";
      hint = null;
      deps.renderAll();
    },
    selectChannelScope: () => {
      scope = "channel";
      hint = null;
      deps.renderAll();
    },
    toggleDetail: (panel) => {
      detail = detail === panel ? null : panel;
      deps.renderAll();
    },
    closeDetail: () => {
      if (!detail) return false;
      detail = null;
      deps.renderAll();
      return true;
    },
    pokeLocked: (panel) => {
      hint = panel;
      deps.renderAll();
    },
    edit,
    editNorm: (patch) => edit(normEdit(patch)),
    pickPreset: (presetId) => edit({ kind: "pickPreset", presetId }),
    savePreset: (name) => {
      const tgt = target();
      if (tgt === null || isLocked("norm")) return;
      const s = deps.getSettings();
      const id = newUserPresetId();
      const res = saveUserPreset(s.userPresets, currentNormSlot(), id, name);
      if (!res) return;
      s.userPresets = res.presets;
      setNormSlot(tgt, res.slot);
      const saved = res.presets[res.presets.length - 1]!;
      send({ source: "popup", type: "SAVE_USER_PRESET", target: tgt, id, name: saved.name }, tgt);
      deps.flashToast(fxUi().toastPresetSaved(saved.name));
    },
    overwritePreset: () => {
      const tgt = target();
      if (tgt === null || isLocked("norm")) return;
      const s = deps.getSettings();
      const res = overwriteUserPreset(s.userPresets, currentNormSlot());
      if (!res) return;
      s.userPresets = res.presets;
      setNormSlot(tgt, res.slot);
      send({ source: "popup", type: "OVERWRITE_USER_PRESET", target: tgt }, tgt);
      deps.renderAll();
    },
    renamePreset: (id, name) => {
      const s = deps.getSettings();
      const next = renameUserPreset(s.userPresets, id, name);
      if (!next) return;
      s.userPresets = next;
      deps.sendAction({ source: "popup", type: "RENAME_USER_PRESET", id, name });
      deps.renderAll();
    },
    deletePreset: (id) => {
      const s = deps.getSettings();
      const victim = s.userPresets.find((p) => p.id === id);
      if (!victim) return;
      s.userPresets = s.userPresets.filter((p) => p.id !== id);
      s.globalFx.norm = detachSlotFromPreset(s.globalFx.norm, id);
      for (const ch of deps.getAllChannels()) {
        if (ch.fx.own.norm) ch.fx = { ...ch.fx, own: { ...ch.fx.own, norm: detachSlotFromPreset(ch.fx.own.norm, id) } };
      }
      deps.sendAction({ source: "popup", type: "DELETE_USER_PRESET", id });
      deps.flashToast(fxUi().toastPresetDeleted(victim.name));
    },
    currentNormSlot,
    isLocked,
  };
}
