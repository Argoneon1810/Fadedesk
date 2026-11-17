import { ui } from "../shared/i18n";
import { fxUi } from "../shared/i18n-fx";
import { effectiveModule, effectivePan, resolveEffectiveNormalizer } from "../shared/fx-model";
import { formatPan } from "../shared/mixer-math";
import type {
  CompSlot, GateSlot, NormSlot, PersistedSettings, TabChannelState, ThemeTokens,
} from "../shared/types";
import type { FxController, FxPanel } from "./fx-controller";
import { compSummary, gateSummary, normSummary, panSummary } from "./fx-labels";

/**
 * 우측 고급 FX 랙(`#side-fx-rack`) — 범위 탭 · 머리 · 요약 카드 4개(노멀라이저·게이트·컴프레서·패닝).
 * 카드마다 [ON/OFF] · [요약 + 세부 ▸] · [따름 줄]만 두고, 세부 조작은 세부 창(`fx-detail-view.ts`)이 맡는다.
 * 80ms VU 갱신에도 포커스가 끊기지 않도록 DOM은 한 번만 만들고 동기화만 한다.
 */

const PANELS: readonly FxPanel[] = ["norm", "gate", "comp", "pan"];

interface CardRefs {
  panel: FxPanel;
  el: HTMLElement;
  title: HTMLElement;
  tog: HTMLButtonElement;
  panVal: HTMLElement;
  sum: HTMLElement;
  more: HTMLButtonElement;
  linkRow: HTMLElement;
  linkState: HTMLElement;
  linkBtn: HTMLButtonElement;
  hint: HTMLElement;
}

export interface FxRackRefs {
  container: HTMLElement;
  tabAll: HTMLButtonElement;
  tabThis: HTMLButtonElement;
  titleEl: HTMLElement;
  trimBadge: HTMLElement;
  subDescEl: HTMLElement;
  cards: CardRefs[];
}

export function buildFxRackDom(container: HTMLElement, ctl: FxController): FxRackRefs {
  const copy = fxUi();
  container.innerHTML = `
    <div class="fx-scope-tabs" role="tablist">
      <button data-ref="tabAll" type="button" role="tab" class="fx-scope-tab">${copy.scopeAll}</button>
      <button data-ref="tabThis" type="button" role="tab" class="fx-scope-tab truncate"></button>
    </div>
    <div class="fx-rack-header">
      <div class="fx-rack-title-row">
        <span data-ref="titleEl" class="fx-rack-title truncate"></span>
        <span data-ref="trimBadge" class="fx-trim-badge c-recessed tabular"></span>
      </div>
      <div data-ref="subDescEl" class="fx-rack-sub c-muted truncate"></div>
    </div>
    <div data-ref="cardsWrap" class="fx-cards-wrap"></div>
  `;
  const q = <T extends HTMLElement>(root: ParentNode, name: string): T =>
    root.querySelector(`[data-ref="${name}"]`) as T;
  const tabAll = q<HTMLButtonElement>(container, "tabAll");
  const tabThis = q<HTMLButtonElement>(container, "tabThis");
  tabAll.onclick = () => ctl.selectGlobal();
  tabThis.onclick = () => ctl.selectChannelScope();

  const wrap = q(container, "cardsWrap");
  const cards = PANELS.map((panel): CardRefs => {
    const el = document.createElement("section");
    el.className = "fx-card c-recessed";
    el.dataset.panel = panel;
    el.innerHTML = `
      <div class="fx-card-head">
        <span data-ref="title" class="fx-card-title"></span>
        <button data-ref="tog" type="button" class="console-btn fx-mini-btn">OFF</button>
        <span data-ref="panVal" class="fx-pan-val tabular hidden"></span>
      </div>
      <div class="fx-card-sum">
        <span data-ref="sum" class="fx-card-sum-text truncate tabular"></span>
        <button data-ref="more" type="button" class="console-btn fx-more-btn"></button>
      </div>
      <div data-ref="linkRow" class="fx-link-row">
        <span data-ref="linkState" class="fx-link-state truncate"></span>
        <button data-ref="linkBtn" type="button" class="console-btn fx-link-btn"></button>
      </div>
      <div data-ref="hint" class="fx-lock-hint hidden"></div>
    `;
    wrap.appendChild(el);
    const refs: CardRefs = {
      panel,
      el,
      title: q(el, "title"),
      tog: q<HTMLButtonElement>(el, "tog"),
      panVal: q(el, "panVal"),
      sum: q(el, "sum"),
      more: q<HTMLButtonElement>(el, "more"),
      linkRow: q(el, "linkRow"),
      linkState: q(el, "linkState"),
      linkBtn: q<HTMLButtonElement>(el, "linkBtn"),
      hint: q(el, "hint"),
    };
    refs.more.onclick = (ev) => {
      ev.stopPropagation();
      ctl.toggleDetail(panel);
    };
    if (panel === "pan") {
      refs.tog.classList.add("hidden");
      refs.panVal.classList.remove("hidden");
      refs.linkRow.classList.add("hidden");
    } else {
      refs.tog.onclick = () => {
        if (ctl.isLocked(panel)) return ctl.pokeLocked(panel);
        const on = refs.tog.dataset.on === "true";
        if (panel === "norm") ctl.editNorm({ enabled: !on });
        else ctl.edit({ kind: panel, patch: { enabled: !on } });
      };
      refs.linkBtn.onclick = () => {
        const own = refs.el.dataset.own === "true";
        ctl.edit(own ? { kind: "relink", module: panel } : { kind: "detach", module: panel });
      };
    }
    return refs;
  });

  return {
    container,
    tabAll,
    tabThis,
    titleEl: q(container, "titleEl"),
    trimBadge: q(container, "trimBadge"),
    subDescEl: q(container, "subDescEl"),
    cards,
  };
}

/** 보정 배지는 VU 갱신(80ms)마다 따로 칠한다. */
export function syncFxRackTrimBadge(
  r: FxRackRefs,
  ch: TabChannelState | undefined,
  settings: PersistedSettings,
  t: ThemeTokens,
  isGlobal: boolean,
): void {
  const copy = ui();
  if (isGlobal) {
    r.trimBadge.textContent = settings.globalFx.norm.enabled ? "N ON" : "N OFF";
    r.trimBadge.style.color = settings.globalFx.norm.enabled ? t.primary : t.muted;
    return;
  }
  if (!ch) {
    r.trimBadge.textContent = copy.fxTrimIdle;
    r.trimBadge.style.color = t.muted;
    return;
  }
  const resolved = resolveEffectiveNormalizer(settings.globalFx, ch.fx, ch.corsCap);
  if (ch.corsCap) {
    r.trimBadge.textContent = copy.fxTrimCors;
    r.trimBadge.style.color = t.states.warning;
  } else if (resolved.active) {
    const sign = ch.normTrimDb >= 0 ? "+" : "";
    r.trimBadge.textContent = copy.fxTrimActive(`${sign}${ch.normTrimDb.toFixed(1)}`);
    r.trimBadge.style.color = resolved.source === "custom-on" ? t.text : t.primary;
  } else {
    r.trimBadge.textContent = copy.fxTrimOff;
    r.trimBadge.style.color = t.muted;
  }
}

function paintToggle(btn: HTMLButtonElement, on: boolean, own: boolean, locked: boolean, t: ThemeTokens): void {
  btn.dataset.on = String(on);
  btn.textContent = on ? "ON" : "OFF";
  const bg = on ? (own ? t.text : t.primary) : t.surface;
  btn.style.backgroundColor = bg;
  btn.style.color = on ? (own ? t.bg : t.onPrimary) : t.muted;
  btn.style.borderColor = on ? bg : t.border;
  btn.style.fontWeight = on ? "700" : "500";
  btn.style.opacity = locked ? "0.45" : "1";
}

export function syncFxRackDom(
  r: FxRackRefs,
  ctl: FxController,
  settings: PersistedSettings,
  channels: readonly TabChannelState[],
  t: ThemeTokens,
): void {
  r.container.classList.toggle("hidden", !settings.advRackOpen);
  if (!settings.advRackOpen) return;
  const copy = fxUi();
  const legacy = ui();
  const { scope, detail, hint, ch } = ctl.view();
  const isGlobal = scope === "global";

  r.tabAll.dataset.on = String(isGlobal);
  r.tabThis.dataset.on = String(!isGlobal);
  r.tabAll.setAttribute("aria-selected", String(isGlobal));
  r.tabThis.setAttribute("aria-selected", String(!isGlobal));
  r.tabThis.textContent = ch ? copy.scopeThis(ch.shortHost) : legacy.fxNoActiveTitle;
  r.tabThis.title = ch ? `${copy.scopeThis(ch.shortHost)} · ${ch.shortHost}` : "";
  r.tabThis.disabled = !ch;

  if (isGlobal) {
    r.titleEl.textContent = copy.globalTitle;
    r.subDescEl.textContent = copy.globalSub(channels.length);
  } else if (!ch) {
    r.titleEl.textContent = legacy.fxNoActiveTitle;
    r.subDescEl.textContent = legacy.fxNoActiveSub;
  } else {
    r.titleEl.textContent = ch.title;
    r.subDescEl.textContent = ch.corsCap ? legacy.fxCorsSub : copy.channelSub(ch.shortHost);
  }
  syncFxRackTrimBadge(r, ch, settings, t, isGlobal);

  const disabled = !isGlobal && (!ch || ch.corsCap);
  for (const c of r.cards) {
    c.el.classList.toggle("fx-cards-disabled", disabled);
    c.el.dataset.detailOpen = String(detail === c.panel);
    c.more.textContent = detail === c.panel ? copy.detailClose : copy.detailOpen;

    if (c.panel === "pan") {
      c.title.textContent = isGlobal ? copy.modTitle.balance : copy.modTitle.pan;
      const v = isGlobal ? settings.globalPan : ch ? effectivePan(settings.globalPan, ch.fx, ch.corsCap) : 0;
      c.panVal.textContent = formatPan(v);
      c.sum.textContent = panSummary(isGlobal, v);
      c.el.dataset.own = "false";
      continue;
    }

    c.title.textContent = copy.modTitle[c.panel];
    const eff = isGlobal || !ch
      ? { slot: settings.globalFx[c.panel], own: false }
      : effectiveModule(settings.globalFx, ch.fx, c.panel);
    const own = !isGlobal && eff.own;
    const locked = !isGlobal && !eff.own;
    c.el.dataset.own = String(own);
    paintToggle(c.tog, eff.slot.enabled, own, locked, t);
    c.sum.textContent =
      c.panel === "norm"
        ? normSummary(eff.slot as NormSlot, settings.userPresets)
        : c.panel === "gate"
          ? gateSummary(eff.slot as GateSlot)
          : compSummary(eff.slot as CompSlot);

    if (isGlobal) {
      const n = channels.filter((x) => x.fx.own[c.panel as "norm"]).length;
      c.linkState.textContent = n ? copy.globalExcept(n) : copy.globalApplies;
      c.linkState.dataset.kind = "plain";
      c.linkBtn.classList.add("hidden");
    } else {
      c.linkState.textContent = own ? copy.stateOwn : copy.stateFollow;
      c.linkState.dataset.kind = own ? "own" : "follow";
      c.linkBtn.classList.remove("hidden");
      c.linkBtn.textContent = own ? copy.btnRelink : copy.btnDetach;
      c.linkBtn.dataset.kind = own ? "relink" : "detach";
    }
    const showHint = hint === c.panel && locked && detail !== c.panel;
    c.hint.classList.toggle("hidden", !showHint);
    c.hint.textContent = showHint ? copy.lockedHint : "";
  }
}
