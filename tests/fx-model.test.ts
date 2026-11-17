import assert from "node:assert/strict";
import test from "node:test";
import { MixerStateStore } from "../src/background/state-store";
import {
  applyChannelFxEdit,
  buildDspConfigPayload,
  builtinParams,
  defaultChannelFx,
  defaultGlobalFx,
  effectivePan,
  migrateGlobalFx,
  sanitizeChannelFx,
  sanitizeUserPresets,
  settingsEditContext,
} from "../src/shared/fx-model";

/**
 * 1.2.0 고급 FX 2계층 모델 검증: 1.1.0 설정·세션 변환, 잠금, 따로 풀기, 패닝 더하기, 내 프리셋(복사) 동작.
 */

const report = {
  hasMedia: true,
  playingCount: 1,
  pausedCount: 0,
  corsRestricted: false,
  mediaTitle: "",
  vuLevel: 0.5,
  vuPeak: 0.6,
  normTrimDb: 0,
};

function storeWithTabs(...ids: number[]): MixerStateStore {
  const store = new MixerStateStore();
  for (const id of ids) {
    store.updateFrameReport({ tabId: id, windowId: 1, url: `https://site${id}.example/`, title: `탭 ${id}` }, 0, report);
  }
  return store;
}

test("1.1.0 저장 설정(autoNormEnabled·autoNormPreset)을 모든 채널 노멀라이저로 옮긴다", () => {
  const store = new MixerStateStore();
  store.hydrateSettings({ autoNormEnabled: false, autoNormPreset: "night", theme: "amber" });
  const s = store.getSettings();
  assert.equal(s.theme, "amber");
  assert.equal(s.globalFx.norm.enabled, false);
  assert.equal(s.globalFx.norm.presetId, "night");
  assert.equal(s.globalFx.norm.targetLufs, -18);
  assert.equal(s.globalFx.gate.enabled, false);
  assert.equal(s.globalPan, 0);
  assert.deepEqual(s.userPresets, []);

  // 새 구조는 그대로 읽고, 다시 읽어도 같다
  const again = new MixerStateStore();
  again.hydrateSettings(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(again.getSettings().globalFx, s.globalFx);
  assert.deepEqual(migrateGlobalFx({ globalFx: s.globalFx }), s.globalFx);
});

test("1.1.0 세션의 normMode on/off/follow와 게이트·컴프를 채널 층으로 옮기고, 두 번 거쳐도 같다", () => {
  const legacyOn = { normMode: "on", normTargetLufs: -14, normSpeed: "fast", pan: -30, gateEnabled: true, gateThresholdDb: -40, compEnabled: false, compRatio: 4 };
  const on = sanitizeChannelFx(legacyOn);
  assert.equal(on.pan, -30);
  assert.equal(on.own.norm?.enabled, true);
  assert.equal(on.own.norm?.targetLufs, -14);
  assert.equal(on.own.norm?.speed, "fast");
  assert.equal(on.own.norm?.presetId, "");
  assert.equal(on.own.norm?.minDwellBlocks, 2); // 1.1.0 "민감"의 체류값을 그대로 이어받는다
  assert.deepEqual(on.own.gate, { enabled: true, thresholdDb: -40 });
  assert.equal(on.own.comp, undefined); // 기본값 그대로인 컴프는 "모든 채널 따름"

  const off = sanitizeChannelFx({ normMode: "off", normTargetLufs: -18, normSpeed: "slow", pan: 0 });
  assert.equal(off.own.norm?.enabled, false);
  const follow = sanitizeChannelFx({ normMode: "follow", pan: 10, compEnabled: true, compRatio: 8 });
  assert.equal(follow.own.norm, undefined);
  assert.deepEqual(follow.own.comp, { enabled: true, ratio: 8 });

  for (const fx of [on, off, follow, defaultChannelFx()]) {
    assert.deepEqual(sanitizeChannelFx(sanitizeChannelFx(fx)), sanitizeChannelFx(fx));
  }

  // 세션 복원 경로(importSession)도 같은 변환을 거친다
  const store = new MixerStateStore();
  store.importSession([{
    tabId: 7, windowId: 1, url: "https://a.example/", domain: "a.example", shortHost: "a", boundDomain: "a.example",
    userAdjusted: false, tabTitle: "A", favIconUrl: "", audible: true, db: 0, muted: false, solo: false, focus: false,
    fx: legacyOn as never, firstSeenAt: 1, frames: [[0, report]],
  }]);
  assert.equal(store.computeDspForTab(7).normTargetLufs, -14);
  assert.equal(store.computeDspForTab(7).gateEnabled, true);
});

test("모든 채널 따름 채널은 잠겨 있고, 따로 풀면 그때의 모든 채널 값을 복사한다", () => {
  const store = storeWithTabs(1);
  assert.equal(store.editFx(1, { kind: "gate", patch: { enabled: true } }), null);
  store.editFx("global", { kind: "gate", patch: { thresholdDb: -40 } });
  assert.equal(store.editFx(1, { kind: "detach", module: "gate" }), 1);
  assert.equal(store.buildSnapshot().channels[0]!.fx.own.gate?.thresholdDb, -40);
  // 따로 푼 뒤에는 모든 채널 값을 바꿔도 이 채널은 그대로
  store.editFx("global", { kind: "gate", patch: { thresholdDb: -60 } });
  assert.equal(store.computeDspForTab(1).gateThresholdDb, -40);
  // 다시 따르면 모든 채널 값을 쓴다
  store.editFx(1, { kind: "relink", module: "gate" });
  assert.equal(store.computeDspForTab(1).gateThresholdDb, -60);
});

test("모든 채널 패닝은 각 채널 패닝에 더해지는 전체 밸런스다 (±100에서 자름, CORS는 가운데)", () => {
  const store = storeWithTabs(1, 2);
  store.editFx(1, { kind: "pan", value: -30 });
  store.editFx("global", { kind: "pan", value: 20 });
  assert.equal(store.computeDspForTab(1).pan, -10);
  assert.equal(store.computeDspForTab(2).pan, 20);
  store.editFx(2, { kind: "pan", value: 95 });
  assert.equal(store.computeDspForTab(2).pan, 100);
  const fx = { own: {}, pan: -50 };
  assert.equal(effectivePan(20, fx, true), 0);
});

test("내 프리셋은 고를 때 복사된다: 덮어써도 이미 고른 채널은 그대로, 지우면 사용자 지정이 된다", () => {
  const store = storeWithTabs(1, 2);
  store.editFx(1, { kind: "detach", module: "norm" });
  store.editFx(1, { kind: "norm", patch: { targetLufs: -20 } });
  assert.equal(store.buildSnapshot().channels.find((c) => c.tabId === 1)!.fx.own.norm?.modified, true);
  assert.equal(store.saveUserPreset(1, "uabc", "  심야   대사  "), true);
  const saved = store.getSettings().userPresets[0]!;
  assert.equal(saved.name, "심야 대사");
  assert.equal(saved.targetLufs, -20);

  store.editFx(2, { kind: "detach", module: "norm" });
  store.editFx(2, { kind: "pickPreset", presetId: "uabc" });
  assert.equal(store.computeDspForTab(2).normTargetLufs, -20);

  store.editFx(1, { kind: "norm", patch: { targetLufs: -18 } });
  assert.equal(store.overwriteUserPreset(1), true);
  assert.equal(store.getSettings().userPresets[0]!.targetLufs, -18);
  assert.equal(store.computeDspForTab(2).normTargetLufs, -20); // 복사본은 그대로
  const ch2 = () => store.buildSnapshot().channels.find((c) => c.tabId === 2)!.fx.own.norm!;
  assert.equal(ch2().modified, false);

  assert.equal(store.renameUserPreset("uabc", "밤 대사"), true);
  assert.equal(store.getSettings().userPresets[0]!.name, "밤 대사");
  assert.equal(store.deleteUserPreset("uabc"), true);
  assert.equal(ch2().presetId, "");
  assert.equal(ch2().targetLufs, -20);
  assert.deepEqual(store.getSettings().userPresets, []);
});

test("클래식을 복사한 자리는 클래식 고유의 체류·최대 증폭을 지킨다", () => {
  const ctxSettings = { globalFx: defaultGlobalFx(), globalPan: 0, userPresets: [] };
  const fx = applyChannelFxEdit(defaultChannelFx(), settingsEditContext(ctxSettings), { kind: "detach", module: "norm" })!;
  const picked = applyChannelFxEdit(fx, settingsEditContext(ctxSettings), { kind: "pickPreset", presetId: "classical" })!;
  const dsp = buildDspConfigPayload(ctxSettings.globalFx, 0, picked, false);
  assert.equal(dsp.normMinDwellBlocks, builtinParams("classical").minDwellBlocks);
  assert.equal(dsp.normMaxBoostDb, 4);
  assert.equal(picked.own.norm?.modified, false);
});

test("저장된 내 프리셋 목록을 검증한다 (id 꼴·중복·이름 길이)", () => {
  const list = sanitizeUserPresets([
    { id: "u1", name: "가".repeat(30), targetLufs: -30, speed: "fast" },
    { id: "u1", name: "dup" },
    { id: "bad", name: "x" },
    "junk",
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0]!.name.length, 16);
  assert.equal(list[0]!.targetLufs, -20);
});
