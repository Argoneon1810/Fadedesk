import assert from "node:assert/strict";
import test from "node:test";
import { MixerStateStore } from "../src/background/state-store";
import { builtinParams } from "../src/shared/fx-model";

/**
 * 스토어 1.0.0에서 1.2.x로 곧장 넘어오는 사용자의 저장 설정·세션이 손실 없이 옮겨지는지 본다.
 * 아래 값은 v1.0.0 태그의 DEFAULT_SETTINGS·DEFAULT_CHANNEL_FX·SerializedTabSession 모양 그대로다.
 */

/** v1.0.0 `chrome.storage.local`에 저장되던 설정 (사용자가 여러 값을 바꾼 경우) */
const V100_SETTINGS_CUSTOM = {
  theme: "cobalt",
  modePref: "light",
  alpha: 0.5,
  masterDb: -3.5,
  masterMuted: true,
  autoNormEnabled: true,
  autoNormPreset: "night",
  onboardingDone: true,
  advRackOpen: true,
  popoutWidth: 900,
  popoutHeight: 600,
  domainDefaults: { "youtube.com": -6, "chzzk.naver.com": 2.5 },
};

/** v1.0.0 기본값 그대로 저장된 설정 (노멀라이저 꺼짐, 표준 프리셋) */
const V100_SETTINGS_DEFAULT = {
  theme: "teal",
  modePref: "dark",
  alpha: 0.7,
  masterDb: 0,
  masterMuted: false,
  autoNormEnabled: false,
  autoNormPreset: "standard",
  onboardingDone: false,
  advRackOpen: false,
  popoutWidth: 780,
  popoutHeight: 480,
  domainDefaults: {},
};

test("1.0.0 설정: 바꾼 값이 모두 남고 균일 N은 모든 채널 노멀라이저로 옮겨진다", () => {
  const store = new MixerStateStore();
  store.hydrateSettings(structuredClone(V100_SETTINGS_CUSTOM));
  const s = store.getSettings();

  assert.equal(s.theme, "cobalt");
  assert.equal(s.modePref, "light");
  assert.equal(s.alpha, 0.5);
  assert.equal(s.masterDb, -3.5);
  assert.equal(s.masterMuted, true);
  assert.equal(s.onboardingDone, true);
  assert.equal(s.advRackOpen, true);
  assert.equal(s.popoutWidth, 900);
  assert.equal(s.popoutHeight, 600);
  assert.deepEqual(s.domainDefaults, { "youtube.com": -6, "chzzk.naver.com": 2.5 });

  assert.equal(s.globalFx.norm.enabled, true);
  assert.equal(s.globalFx.norm.presetId, "night");
  assert.equal(s.globalFx.norm.modified, false);
  const night = builtinParams("night");
  assert.equal(s.globalFx.norm.targetLufs, night.targetLufs);
  assert.equal(s.globalFx.norm.rangeLowLufs, night.rangeLowLufs);
  assert.equal(s.globalFx.norm.rangeHighLufs, night.rangeHighLufs);
  assert.equal(s.globalFx.gate.enabled, false);
  assert.equal(s.globalFx.comp.enabled, false);
  assert.equal(s.globalPan, 0);
  assert.deepEqual(s.userPresets, []);
  // 옛 키는 새 설정에 남지 않는다
  assert.equal("autoNormEnabled" in s, false);
  assert.equal("autoNormPreset" in s, false);
});

test("1.0.0 기본 설정: 꺼져 있던 노멀라이저는 꺼진 채로, 표준 프리셋으로 옮겨진다", () => {
  const store = new MixerStateStore();
  store.hydrateSettings(structuredClone(V100_SETTINGS_DEFAULT));
  const s = store.getSettings();
  assert.equal(s.globalFx.norm.enabled, false);
  assert.equal(s.globalFx.norm.presetId, "standard");
  assert.equal(s.globalFx.norm.targetLufs, builtinParams("standard").targetLufs);
  assert.equal(s.onboardingDone, false);
});

test("1.0.0 설정을 옮긴 뒤 저장했다가 다시 읽어도 같다 (두 번 옮겨도 그대로)", () => {
  const first = new MixerStateStore();
  first.hydrateSettings(structuredClone(V100_SETTINGS_CUSTOM));
  const saved = JSON.parse(JSON.stringify(first.getSettings()));
  const second = new MixerStateStore();
  second.hydrateSettings(saved);
  assert.deepEqual(second.getSettings(), first.getSettings());
});

test("1.0.0 세션: 채널 FX(normMode·게이트·컴프·패닝)가 채널 층으로 옮겨지고 나머지 칸은 그대로다", () => {
  // 지금 구조로 탭 하나를 만든 뒤, fx만 1.0.0 모양으로 바꿔 1.0.0 세션 항목을 흉내 낸다 (나머지 칸 모양은 1.0.0과 같음)
  const seed = new MixerStateStore();
  seed.updateFrameReport({ tabId: 7, windowId: 2, url: "https://www.youtube.com/watch?v=1", title: "영상" }, 0, {
    hasMedia: true, playingCount: 1, pausedCount: 0, corsRestricted: false,
    mediaTitle: "", vuLevel: 0, vuPeak: 0, normTrimDb: 0,
  });
  const exported = seed.exportSession();
  assert.equal(exported.length, 1);
  const v100Fx = {
    normMode: "on", normTargetLufs: -14, normSpeed: "fast", pan: -40,
    gateEnabled: true, gateThresholdDb: -44, compEnabled: false, compRatio: 8,
  };
  const item = { ...structuredClone(exported[0]!), db: -7.5, muted: true, solo: false, focus: true, fx: v100Fx };

  const store = new MixerStateStore();
  store.importSession([item as never]);
  const after = store.exportSession()[0]!;
  assert.equal(after.db, -7.5);
  assert.equal(after.muted, true);
  assert.equal(after.focus, true);
  assert.equal(after.domain, item.domain);

  const fx = after.fx;
  assert.equal(fx.pan, -40);
  assert.equal(fx.own.norm?.enabled, true);
  assert.equal(fx.own.norm?.targetLufs, -14);
  assert.equal(fx.own.norm?.speed, "fast");
  assert.deepEqual(fx.own.gate, { enabled: true, thresholdDb: -44 });
  assert.deepEqual(fx.own.comp, { enabled: false, ratio: 8 });

  // follow·기본값 채널은 아무것도 따로 두지 않는다
  const followItem = { ...item, tabId: 8, fx: { ...v100Fx, normMode: "follow", gateEnabled: false, gateThresholdDb: -48, compRatio: 4, pan: 0 } };
  const store2 = new MixerStateStore();
  store2.importSession([followItem as never]);
  assert.deepEqual(store2.exportSession()[0]!.fx, { own: {}, pan: 0 });

  // 옮긴 세션을 다시 읽어도 같다
  const store3 = new MixerStateStore();
  store3.importSession(JSON.parse(JSON.stringify(store.exportSession())));
  assert.deepEqual(store3.exportSession()[0]!.fx, fx);
});
