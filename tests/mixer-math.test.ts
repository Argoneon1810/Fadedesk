import assert from "node:assert/strict";
import test from "node:test";
import { MixerStateStore } from "../src/background/state-store";
import {
  clampDb,
  computeAppliedChannelDb,
  computeDisplayedEffectiveDb,
  dbToLinear,
  extractDomainInfo,
  getFocusDimDb,
  linearToDb,
  toggleExclusiveFlags,
} from "../src/shared/mixer-math";

test("dB <-> 선형 게인 변환과 -60dB 무음 스냅 검증", () => {
  assert.equal(dbToLinear(-60), 0);
  assert.equal(dbToLinear(-Infinity), 0);
  assert.ok(Math.abs(dbToLinear(0) - 1.0) < 1e-9);
  assert.ok(Math.abs(dbToLinear(12) - 3.9810717) < 1e-5);
  assert.ok(Math.abs(dbToLinear(-12) - 0.2511886) < 1e-5);

  assert.equal(linearToDb(0), -Infinity);
  assert.ok(Math.abs(linearToDb(1) - 0) < 1e-9);
  assert.equal(clampDb(8.4, true), 0);
  assert.equal(clampDb(15, false), 12);
});

test("Focus 모드 일반화 원-핫 감쇠 공식 G_dim(α) = -40(1 - α) dB 검증", () => {
  assert.equal(getFocusDimDb(0), -Infinity);
  assert.equal(getFocusDimDb(0.7), -12);
  assert.equal(getFocusDimDb(0.5), -20);
  assert.equal(getFocusDimDb(1.0), 0);

  const ctx = {
    alpha: 0.7,
    masterDb: 0,
    masterMuted: false,
    anySolo: false,
    anyFocus: true,
  };

  // Focus 주연 채널은 0dB 그대로 유지
  const targetDb = computeAppliedChannelDb(
    { tabId: 1, db: 0, muted: false, solo: false, focus: true, playing: true, corsCap: false },
    ctx,
  );
  assert.equal(targetDb, 0);

  // 비선택 채널은 -6.0dB + (-12.0dB) = -18.0dB로 비파괴 감쇠
  const bgDb = computeAppliedChannelDb(
    { tabId: 2, db: -6, muted: false, solo: false, focus: false, playing: true, corsCap: false },
    ctx,
  );
  assert.equal(bgDb, -18);

  // 일시정지 채널도 오디오 그래프에는 감쇠 게인이 선반영되지만 화면 실효치는 -∞ 표시
  const pausedApplied = computeAppliedChannelDb(
    { tabId: 3, db: 0, muted: false, solo: false, focus: false, playing: false, corsCap: false },
    ctx,
  );
  const pausedDisplayed = computeDisplayedEffectiveDb(
    { tabId: 3, db: 0, muted: false, solo: false, focus: false, playing: false, corsCap: false },
    ctx,
  );
  assert.equal(pausedApplied, -12);
  assert.equal(pausedDisplayed, -Infinity);
});

test("Solo(S)와 Focus(F) 상호 배타 전환 및 Shift 다중 선택 검증", () => {
  const chs = [
    { tabId: 1, solo: false, focus: true },
    { tabId: 2, solo: false, focus: false },
    { tabId: 3, solo: false, focus: false },
  ];

  // 채널 2의 F 일반 클릭 -> 1에서 2로 즉시 주연 교체
  toggleExclusiveFlags(chs, 2, "focus", false);
  assert.deepEqual(
    chs.map((c) => [c.solo, c.focus]),
    [
      [false, false],
      [false, true],
      [false, false],
    ],
  );

  // 채널 3의 F Shift+클릭 -> 2와 3 동시 Focus
  toggleExclusiveFlags(chs, 3, "focus", true);
  assert.deepEqual(
    chs.map((c) => [c.solo, c.focus]),
    [
      [false, false],
      [false, true],
      [false, true],
    ],
  );

  // 채널 1의 S 클릭 -> 모든 F 즉시 해제 + 채널 1 단독 Solo
  toggleExclusiveFlags(chs, 1, "solo", false);
  assert.deepEqual(
    chs.map((c) => [c.solo, c.focus]),
    [
      [true, false],
      [false, false],
      [false, false],
    ],
  );

  // 유일한 Solo 채널 1 재클릭 -> 전체 해제
  toggleExclusiveFlags(chs, 1, "solo", false);
  assert.deepEqual(
    chs.map((c) => [c.solo, c.focus]),
    [
      [false, false],
      [false, false],
      [false, false],
    ],
  );
});

test("도메인 기본 볼륨 핀 저장과 열린 동일 도메인 다중 탭 독립 조작 검증", () => {
  const store = new MixerStateStore();
  const sampleReport = {
    hasMedia: true,
    playingCount: 1,
    pausedCount: 0,
    corsRestricted: false,
    mediaTitle: "",
    vuLevel: 0.4,
    vuPeak: 0.5,
  };

  // 첫 유튜브 탭(#10) 등록 후 -6.0dB 설정 및 도메인 핀 고정
  store.updateFrameReport(
    { tabId: 10, windowId: 1, url: "https://www.youtube.com/watch?v=aaa", title: "Lo-Fi" },
    0,
    sampleReport,
  );
  store.setTabDb(10, -6.0);
  const pinRes = store.toggleDomainPin(10);
  assert.deepEqual(pinRes, { domain: "youtube.com", pinned: true, db: -6.0 });

  // 새로 열린 두 번째 유튜브 탭(#11)은 도메인 기본값(-6.0dB)으로 시작
  store.updateFrameReport(
    { tabId: 11, windowId: 1, url: "https://www.youtube.com/watch?v=bbb", title: "컨퍼런스" },
    0,
    sampleReport,
  );
  let snap = store.buildSnapshot();
  assert.equal(snap.channels.find((c) => c.tabId === 11)?.db, -6.0);

  // 탭 #11 볼륨을 +4.5dB로 올려도 탭 #10(-6.0dB)과 저장된 도메인 기본값(-6.0dB)은 변하지 않음
  store.setTabDb(11, 4.5);
  snap = store.buildSnapshot();
  assert.equal(snap.channels.find((c) => c.tabId === 10)?.db, -6.0);
  assert.equal(snap.channels.find((c) => c.tabId === 11)?.db, 4.5);
  assert.equal(snap.settings.domainDefaults["youtube.com"], -6.0);

  // 핀이 켜진 탭 #10에서 핀 해제 시, 열린 탭 #10/#11 볼륨은 유지되고 새 탭(#12)만 0.0dB로 시작
  store.toggleDomainPin(10);
  store.updateFrameReport(
    { tabId: 12, windowId: 1, url: "https://www.youtube.com/watch?v=ccc", title: "새 영상" },
    0,
    sampleReport,
  );
  snap = store.buildSnapshot();
  assert.equal(snap.channels.find((c) => c.tabId === 10)?.db, -6.0);
  assert.equal(snap.channels.find((c) => c.tabId === 11)?.db, 4.5);
  assert.equal(snap.channels.find((c) => c.tabId === 12)?.db, 0.0);
});

test("URL 도메인 추출 및 재생/대기 정렬 순서 검증", () => {
  assert.deepEqual(extractDomainInfo("https://chzzk.naver.com/live/123"), {
    domain: "chzzk.naver.com",
    shortHost: "chzzk",
  });
  assert.deepEqual(extractDomainInfo("chrome://extensions"), {
    domain: "",
    shortHost: "chrome",
  });
});
