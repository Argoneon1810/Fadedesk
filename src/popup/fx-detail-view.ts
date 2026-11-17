import { ui } from "../shared/i18n";
import { fxUi } from "../shared/i18n-fx";
import { BUILTIN_PRESET_KEYS, effectiveModule, effectivePan, isBuiltinPreset } from "../shared/fx-model";
import { formatPan } from "../shared/mixer-math";
import type {
  CompRatioPreset, CompSlot, GateSlot, NormSlot, NormSpeedPreset, NormVizMode, PersistedSettings,
  TabChannelState, ThemeTokens,
} from "../shared/types";
import type { FxController, FxPanel } from "./fx-controller";
import { presetName } from "./fx-labels";
import { buildNormVisualizerDom, syncNormVisualizerDom, type NormVisualizerRefs } from "./norm-visualizer";

/**
 * 고급 FX 세부 창 (`#fx-detail`) — 랙 왼쪽에 떠서 한 모듈의 세부 조작을 넓게 보여 준다(질문 5 다).
 * 노멀라이저: 프리셋 고르기 · 내 프리셋 저장/덮어쓰기/되돌리기/관리 · 시각화 · 목표 · 속도.
 * "모든 채널 따름" 상태의 모듈은 잠겨 있고, 누르면 안내만 띄운다(질문 3 가).
 */

const SPEEDS: readonly NormSpeedPreset[] = ["slow", "std", "fast"];
const RATIOS: readonly CompRatioPreset[] = [2, 4, 8];

export interface FxDetailRefs {
  root: HTMLElement;
  title: HTMLElement;
  sub: HTMLElement;
  sections: Record<FxPanel, HTMLElement>;
  lockCatchers: Record<FxPanel, HTMLElement>;
  link: { row: HTMLElement; state: HTMLElement; btn: HTMLButtonElement };
  hint: HTMLElement;
  // 노멀라이저
  presetSel: HTMLSelectElement;
  presetSig: string;
  manageBtn: HTMLButtonElement;
  manageBox: HTMLElement;
  manageOpen: boolean;
  renamingId: string | null;
  viz: NormVisualizerRefs;
  targetVal: HTMLElement;
  targetInput: HTMLInputElement;
  speedBtns: Array<{ speed: NormSpeedPreset; btn: HTMLButtonElement }>;
  modBar: HTMLElement;
  modFrom: HTMLElement;
  saveBtn: HTMLButtonElement;
  overwriteBtn: HTMLButtonElement;
  revertBtn: HTMLButtonElement;
  nameBox: HTMLElement;
  nameInput: HTMLInputElement;
  naming: boolean;
  // 게이트·컴프·패닝
  gateVal: HTMLElement;
  gateInput: HTMLInputElement;
  ratioBtns: Array<{ ratio: CompRatioPreset; btn: HTMLButtonElement }>;
  panInput: HTMLInputElement;
  panNote: HTMLElement;
}

export function buildFxDetailDom(
  root: HTMLElement,
  ctl: FxController,
  getSettings: () => PersistedSettings,
  onToggleVizMode: (mode: NormVizMode) => void,
): FxDetailRefs {
  const copy = fxUi();
  const legacy = ui();
  root.innerHTML = `
    <div class="fx-detail-head">
      <span data-ref="title" class="fx-detail-title truncate"></span>
      <button data-ref="close" type="button" class="console-btn fx-detail-close" aria-label="${copy.detailCloseAria}">✕</button>
    </div>
    <div data-ref="sub" class="fx-detail-sub truncate"></div>

    <div data-ref="sec-norm" class="fx-detail-sec">
      <div class="fx-detail-ctrls">
        <select data-ref="presetSel" class="fx-preset-select" aria-label="${copy.presetAria}"></select>
        <button data-ref="manageBtn" type="button" class="fx-text-btn hidden"></button>
        <div data-ref="manageBox" class="fx-manage-box hidden"></div>
        <div data-ref="vizSlot"></div>
        <div class="fx-meta-row"><span class="c-muted">${legacy.fxNormTargetLabel}</span><span data-ref="targetVal" class="fx-meta-val tabular"></span></div>
        <input data-ref="targetInput" type="range" min="-20" max="-12" step="1" class="fx-range" aria-label="${legacy.fxNormTargetAria}" />
        <div data-ref="speedGrid" class="fx-seg-grid3"></div>
        <div data-ref="modBar" class="fx-mod-bar hidden">
          <span data-ref="modFrom" class="truncate"></span>
          <div class="fx-mod-row">
            <button data-ref="saveBtn" type="button" class="console-btn fx-small-btn primary">${copy.saveAsUser}</button>
            <button data-ref="overwriteBtn" type="button" class="console-btn fx-small-btn hidden"></button>
            <button data-ref="revertBtn" type="button" class="console-btn fx-small-btn">${copy.revert}</button>
          </div>
          <div data-ref="nameBox" class="fx-name-box hidden">
            <input data-ref="nameInput" type="text" maxlength="16" spellcheck="false" autocomplete="off" aria-label="${copy.presetNameAria}" />
            <button data-ref="nameOk" type="button" class="console-btn fx-small-btn primary">${copy.save}</button>
          </div>
        </div>
      </div>
      <div data-ref="lock-norm" class="fx-lock-catcher hidden"></div>
    </div>

    <div data-ref="sec-gate" class="fx-detail-sec">
      <div class="fx-detail-ctrls">
        <div class="fx-meta-row"><span class="c-muted">${legacy.fxGateFloorLabel}</span><span data-ref="gateVal" class="fx-meta-val tabular"></span></div>
        <input data-ref="gateInput" type="range" min="-65" max="-30" step="1" class="fx-range" aria-label="${legacy.fxGateAria}" />
        <div class="fx-detail-note">${copy.gateNote}</div>
      </div>
      <div data-ref="lock-gate" class="fx-lock-catcher hidden"></div>
    </div>

    <div data-ref="sec-comp" class="fx-detail-sec">
      <div class="fx-detail-ctrls"><div data-ref="ratioGrid" class="fx-seg-grid3"></div></div>
      <div data-ref="lock-comp" class="fx-lock-catcher hidden"></div>
    </div>

    <div data-ref="sec-pan" class="fx-detail-sec">
      <div class="fx-detail-ctrls">
        <div class="fx-pan-ticks c-muted"><span>L100</span><span>C</span><span>R100</span></div>
        <input data-ref="panInput" type="range" min="-100" max="100" step="5" class="fx-range" aria-label="${legacy.fxPanAria}" />
        <div data-ref="panNote" class="fx-detail-note tabular"></div>
      </div>
      <div data-ref="lock-pan" class="fx-lock-catcher hidden"></div>
    </div>

    <div data-ref="linkRow" class="fx-link-row">
      <span data-ref="linkState" class="fx-link-state truncate"></span>
      <button data-ref="linkBtn" type="button" class="console-btn fx-link-btn"></button>
    </div>
    <div data-ref="hint" class="fx-lock-hint hidden"></div>
  `;
  const q = <T extends HTMLElement>(name: string): T => root.querySelector(`[data-ref="${name}"]`) as T;
  root.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  q<HTMLButtonElement>("close").onclick = () => ctl.closeDetail();

  const panels: FxPanel[] = ["norm", "gate", "comp", "pan"];
  const sections = {} as Record<FxPanel, HTMLElement>;
  const lockCatchers = {} as Record<FxPanel, HTMLElement>;
  for (const p of panels) {
    sections[p] = q(`sec-${p}`);
    lockCatchers[p] = q(`lock-${p}`);
    lockCatchers[p].onclick = () => ctl.pokeLocked(p);
  }

  const viz = buildNormVisualizerDom({
    getSlot: () => ctl.currentNormSlot(),
    isLocked: () => ctl.isLocked("norm"),
    onLocked: () => ctl.pokeLocked("norm"),
    onEditNorm: (patch) => ctl.editNorm(patch),
    getSettings,
    onToggleVizMode,
  });
  q("vizSlot").appendChild(viz.rootEl);

  const speedGrid = q("speedGrid");
  const speedBtns = SPEEDS.map((speed) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "console-btn fx-seg-btn";
    btn.textContent = legacy.fxNormSpeeds[speed];
    btn.onclick = () => ctl.editNorm({ speed });
    speedGrid.appendChild(btn);
    return { speed, btn };
  });
  const ratioGrid = q("ratioGrid");
  const ratioBtns = RATIOS.map((ratio) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "console-btn fx-seg-btn";
    btn.textContent = legacy.fxCompRatios[ratio];
    btn.onclick = () => ctl.edit({ kind: "comp", patch: { ratio } });
    ratioGrid.appendChild(btn);
    return { ratio, btn };
  });

  const refs: FxDetailRefs = {
    root,
    title: q("title"),
    sub: q("sub"),
    sections,
    lockCatchers,
    link: { row: q("linkRow"), state: q("linkState"), btn: q<HTMLButtonElement>("linkBtn") },
    hint: q("hint"),
    presetSel: q<HTMLSelectElement>("presetSel"),
    presetSig: "",
    manageBtn: q<HTMLButtonElement>("manageBtn"),
    manageBox: q("manageBox"),
    manageOpen: false,
    renamingId: null,
    viz,
    targetVal: q("targetVal"),
    targetInput: q<HTMLInputElement>("targetInput"),
    speedBtns,
    modBar: q("modBar"),
    modFrom: q("modFrom"),
    saveBtn: q<HTMLButtonElement>("saveBtn"),
    overwriteBtn: q<HTMLButtonElement>("overwriteBtn"),
    revertBtn: q<HTMLButtonElement>("revertBtn"),
    nameBox: q("nameBox"),
    nameInput: q<HTMLInputElement>("nameInput"),
    naming: false,
    gateVal: q("gateVal"),
    gateInput: q<HTMLInputElement>("gateInput"),
    ratioBtns,
    panInput: q<HTMLInputElement>("panInput"),
    panNote: q("panNote"),
  };

  refs.presetSel.onchange = () => {
    if (refs.presetSel.value) ctl.pickPreset(refs.presetSel.value);
  };
  refs.manageBtn.onclick = () => {
    refs.manageOpen = !refs.manageOpen;
    refs.renamingId = null;
    renderManageBox(refs, ctl, getSettings());
  };
  refs.targetInput.oninput = () => {
    refs.targetVal.textContent = `${refs.targetInput.value} LUFS`;
  };
  refs.targetInput.onchange = () => ctl.editNorm({ targetLufs: Number(refs.targetInput.value) });
  refs.saveBtn.onclick = () => {
    refs.naming = true;
    refs.nameBox.classList.remove("hidden");
    refs.nameInput.value = copy.defaultPresetName;
    refs.nameInput.focus();
    refs.nameInput.select();
  };
  const commitName = (): void => {
    refs.naming = false;
    refs.nameBox.classList.add("hidden");
    ctl.savePreset(refs.nameInput.value);
  };
  q<HTMLButtonElement>("nameOk").onclick = commitName;
  refs.nameInput.onkeydown = (ev) => {
    if (ev.key === "Enter") commitName();
    if (ev.key === "Escape") {
      ev.stopPropagation();
      refs.naming = false;
      refs.nameBox.classList.add("hidden");
    }
  };
  refs.overwriteBtn.onclick = () => ctl.overwritePreset();
  refs.revertBtn.onclick = () => ctl.pickPreset(ctl.currentNormSlot().presetId);
  refs.gateInput.oninput = () => {
    refs.gateVal.textContent = `${refs.gateInput.value} dB`;
  };
  refs.gateInput.onchange = () => ctl.edit({ kind: "gate", patch: { thresholdDb: Number(refs.gateInput.value) } });
  refs.panInput.onchange = () => ctl.edit({ kind: "pan", value: Number(refs.panInput.value) });
  refs.panInput.ondblclick = () => ctl.edit({ kind: "pan", value: 0 });
  refs.link.btn.onclick = () => {
    const panel = refs.root.dataset.panel as FxPanel;
    if (panel === "pan") return;
    ctl.edit(refs.link.btn.dataset.kind === "relink" ? { kind: "relink", module: panel } : { kind: "detach", module: panel });
  };
  return refs;
}

function renderManageBox(r: FxDetailRefs, ctl: FxController, settings: PersistedSettings): void {
  const copy = fxUi();
  r.manageBtn.textContent = r.manageOpen ? copy.manageClose : copy.manageOpen;
  r.manageBox.classList.toggle("hidden", !r.manageOpen);
  r.manageBox.innerHTML = "";
  if (!r.manageOpen) return;
  for (const p of settings.userPresets) {
    const row = document.createElement("div");
    row.className = "fx-manage-item";
    if (r.renamingId === p.id) {
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 16;
      input.value = p.name;
      const ok = document.createElement("button");
      ok.type = "button";
      ok.className = "console-btn fx-small-btn primary";
      ok.textContent = copy.ok;
      const commit = (): void => {
        r.renamingId = null;
        ctl.renamePreset(p.id, input.value);
      };
      ok.onclick = commit;
      input.onkeydown = (ev) => {
        if (ev.key === "Enter") commit();
      };
      row.append(input, ok);
      setTimeout(() => input.focus(), 0);
    } else {
      const name = document.createElement("span");
      name.className = "fx-manage-name truncate";
      name.textContent = `${copy.presetMine}${p.name}`;
      const ren = document.createElement("button");
      ren.type = "button";
      ren.className = "console-btn fx-small-btn";
      ren.textContent = copy.rename;
      ren.onclick = () => {
        r.renamingId = p.id;
        renderManageBox(r, ctl, settings);
      };
      const del = document.createElement("button");
      del.type = "button";
      del.className = "console-btn fx-small-btn";
      del.textContent = copy.remove;
      del.onclick = () => ctl.deletePreset(p.id);
      row.append(name, ren, del);
    }
    r.manageBox.appendChild(row);
  }
  const note = document.createElement("div");
  note.className = "fx-detail-note";
  note.textContent = copy.deleteNote;
  r.manageBox.appendChild(note);
}

function syncPresetSelect(r: FxDetailRefs, slot: NormSlot, settings: PersistedSettings): void {
  const copy = fxUi();
  const known = isBuiltinPreset(slot.presetId) || settings.userPresets.some((p) => p.id === slot.presetId);
  const sig = JSON.stringify([slot.presetId, slot.modified, known, settings.userPresets.map((p) => [p.id, p.name])]);
  if (sig === r.presetSig) return;
  r.presetSig = sig;
  r.presetSel.innerHTML = "";
  const add = (value: string, label: string): void => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    o.selected = value === slot.presetId;
    r.presetSel.appendChild(o);
  };
  if (!known) add("", copy.presetCustom);
  const suffix = (id: string): string => (id === slot.presetId && slot.modified ? copy.presetModifiedSuffix : "");
  for (const key of BUILTIN_PRESET_KEYS) add(key, `${presetName(key, settings.userPresets)}${suffix(key)}`);
  for (const p of settings.userPresets) add(p.id, `${copy.presetMine}${p.name}${suffix(p.id)}`);
}

function paintSeg(btn: HTMLButtonElement, on: boolean, t: ThemeTokens): void {
  btn.style.backgroundColor = on ? t.raised : t.surface;
  btn.style.color = on ? t.text : t.muted;
  btn.style.borderColor = on ? t.primary : t.border;
  btn.style.fontWeight = on ? "700" : "500";
}

/** 실시간 음압이 갱신될 때(80ms) 시각화만 다시 칠한다. */
export function syncFxDetailViz(
  r: FxDetailRefs,
  ctl: FxController,
  settings: PersistedSettings,
  t: ThemeTokens,
): void {
  const { detail, ch } = ctl.view();
  if (detail !== "norm" || !settings.advRackOpen) return;
  syncNormVisualizerDom(r.viz, ch, ctl.currentNormSlot(), settings, t);
}

export function syncFxDetailDom(
  r: FxDetailRefs,
  ctl: FxController,
  settings: PersistedSettings,
  t: ThemeTokens,
): void {
  const copy = fxUi();
  const { scope, detail, hint, ch } = ctl.view();
  const open = Boolean(detail) && settings.advRackOpen;
  r.root.classList.toggle("hidden", !open);
  if (!open || !detail) return;
  const isGlobal = scope === "global";
  // 다른 모듈로 바꿔 열면 맨 위부터 보이게 한다
  if (r.root.dataset.panel !== detail) r.root.scrollTop = 0;
  r.root.dataset.panel = detail;
  const locked = ctl.isLocked(detail);
  const own = !isGlobal && detail !== "pan" && Boolean(ch?.fx.own[detail]);
  r.root.dataset.own = String(own);

  const titleKey = detail === "pan" && isGlobal ? "balance" : detail;
  r.title.textContent = copy.detailTitle(copy.modTitle[titleKey]);
  const host = ch?.shortHost ?? "";
  r.sub.textContent = isGlobal
    ? copy.detailSubGlobal
    : detail === "pan"
      ? copy.detailSubPan(host)
      : own
        ? copy.detailSubOwn(host)
        : copy.detailSubLocked(host);

  for (const p of Object.keys(r.sections) as FxPanel[]) {
    r.sections[p].classList.toggle("hidden", p !== detail);
    r.sections[p].classList.toggle("is-locked", p === detail && locked);
    r.lockCatchers[p].classList.toggle("hidden", !(p === detail && locked));
  }

  if (detail === "pan" || isGlobal) {
    r.link.row.classList.add("hidden");
  } else {
    r.link.row.classList.remove("hidden");
    r.link.state.textContent = own ? copy.stateOwn : copy.stateFollow;
    r.link.state.dataset.kind = own ? "own" : "follow";
    r.link.btn.textContent = own ? copy.btnRelink : copy.btnDetach;
    r.link.btn.dataset.kind = own ? "relink" : "detach";
  }
  const showHint = hint === detail && locked;
  r.hint.classList.toggle("hidden", !showHint);
  r.hint.textContent = showHint ? copy.lockedHint : "";

  if (detail === "norm") {
    const slot = ctl.currentNormSlot();
    syncPresetSelect(r, slot, settings);
    r.manageBtn.classList.toggle("hidden", settings.userPresets.length === 0);
    if (settings.userPresets.length === 0) r.manageOpen = false;
    if (!r.renamingId) renderManageBox(r, ctl, settings);
    if (document.activeElement !== r.targetInput) r.targetInput.value = String(slot.targetLufs);
    r.targetVal.textContent = `${slot.targetLufs} LUFS`;
    for (const { speed, btn } of r.speedBtns) paintSeg(btn, slot.speed === speed, t);
    const name = presetName(slot.presetId, settings.userPresets);
    const showMod = slot.modified || !name;
    r.modBar.classList.toggle("hidden", !showMod || locked);
    r.modFrom.textContent = name ? copy.modifiedFrom(name) : copy.customValues;
    r.revertBtn.classList.toggle("hidden", !name);
    const isUser = !isBuiltinPreset(slot.presetId) && Boolean(name);
    r.overwriteBtn.classList.toggle("hidden", !isUser);
    if (isUser && name) r.overwriteBtn.textContent = copy.overwrite(name);
    r.saveBtn.disabled = settings.userPresets.length >= 20;
    if (!r.naming) r.nameBox.classList.add("hidden");
    syncNormVisualizerDom(r.viz, ch, slot, settings, t);
  } else if (detail === "gate") {
    const slot: GateSlot = isGlobal || !ch ? settings.globalFx.gate : effectiveModule(settings.globalFx, ch.fx, "gate").slot;
    if (document.activeElement !== r.gateInput) r.gateInput.value = String(slot.thresholdDb);
    r.gateVal.textContent = `${slot.thresholdDb} dB`;
  } else if (detail === "comp") {
    const slot: CompSlot = isGlobal || !ch ? settings.globalFx.comp : effectiveModule(settings.globalFx, ch.fx, "comp").slot;
    for (const { ratio, btn } of r.ratioBtns) paintSeg(btn, slot.ratio === ratio, t);
  } else {
    const val = isGlobal ? settings.globalPan : ch?.fx.pan ?? 0;
    if (document.activeElement !== r.panInput) r.panInput.value = String(val);
    r.panNote.textContent = isGlobal || !ch
      ? copy.balanceNote
      : copy.panFormula(formatPan(effectivePan(settings.globalPan, ch.fx, ch.corsCap)), formatPan(val), formatPan(settings.globalPan));
  }
}
