import assert from "node:assert/strict";
import test from "node:test";
import { MixerStateStore } from "../src/background/state-store";
import {
  clampDb,
  computeAppliedChannelDb,
  computeDisplayedEffectiveDb,
  computeMasterStereoVu,
  dbToLinear,
  dbToRatio,
  extractDomainInfo,
  getFocusDimDb,
  linearToDb,
  parseDbInput,
  resolveEffectiveNormalizer,
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
    normTrimDb: 0,
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

test("dB 수치 직접 입력 파서(parseDbInput) 및 0.1dB 정밀도·예외 방어 검증", () => {
  assert.equal(parseDbInput("-6"), -6.0);
  assert.equal(parseDbInput("-3.2"), -3.2);
  assert.equal(parseDbInput("+4.5 dB"), 4.5);
  assert.equal(parseDbInput("−8.4db"), -8.4);
  assert.equal(parseDbInput("-inf"), -60);
  assert.equal(parseDbInput("-∞"), -60);
  assert.equal(parseDbInput("18.5", false), 12.0);
  assert.equal(parseDbInput("6.0", true), 0.0);

  // 빈 값이나 오타는 볼륨이 의도치 않게 초기화되지 않도록 null 반환
  assert.equal(parseDbInput(""), null);
  assert.equal(parseDbInput("   "), null);
  assert.equal(parseDbInput("abc"), null);
  assert.equal(parseDbInput("-"), null);
});

test("비파괴 2계층 노멀라이저 해석 및 전역 균일 토글 시 개별 FX 100% 보존 검증", () => {
  const store = new MixerStateStore();
  assert.equal(store.getSettings().autoNormEnabled, false);

  const baseReport = {
    hasMedia: true,
    playingCount: 1,
    pausedCount: 0,
    corsRestricted: false,
    mediaTitle: "",
    vuLevel: 0.5,
    vuPeak: 0.6,
    normTrimDb: 0,
  };

  // 탭 1: 개별 고정 ON (목표 -14 LUFS, 고속 반응)
  store.updateFrameReport(
    { tabId: 1, windowId: 1, url: "https://music.site/track1", title: "음악 탭" },
    0,
    baseReport,
  );
  store.updateTabFx(1, { normMode: "on", normTargetLufs: -14, normSpeed: "fast" });

  // 탭 2: 개별 고정 OFF (목표 -18 LUFS, 완만 반응 보존)
  store.updateFrameReport(
    { tabId: 2, windowId: 1, url: "https://video.site/movie", title: "영화 탭" },
    0,
    baseReport,
  );
  store.updateTabFx(2, { normMode: "off", normTargetLufs: -18, normSpeed: "slow" });

  // 탭 3: 전역 추종 follow (기본값)
  store.updateFrameReport(
    { tabId: 3, windowId: 1, url: "https://news.site/live", title: "뉴스 탭" },
    0,
    baseReport,
  );

  // 탭 4: CORS 제한 탭 (DSP 우회)
  store.updateFrameReport(
    { tabId: 4, windowId: 1, url: "https://cors.cdn/stream", title: "CORS 탭" },
    0,
    { ...baseReport, corsRestricted: true },
  );
  store.updateTabFx(4, { normMode: "on", normTargetLufs: -12, normSpeed: "fast" });

  // 1) 전역 스위치 OFF 상태 검증
  const dsp1_off = store.computeDspForTab(1);
  assert.equal(dsp1_off.normActive, true);
  assert.equal(dsp1_off.normTargetLufs, -14);
  assert.equal(dsp1_off.normSpeed, "fast");

  const dsp2_off = store.computeDspForTab(2);
  assert.equal(dsp2_off.normActive, false);
  assert.equal(dsp2_off.normTargetLufs, -18);
  assert.equal(dsp2_off.normSpeed, "slow");

  const dsp3_off = store.computeDspForTab(3);
  assert.equal(dsp3_off.normActive, false);
  assert.equal(dsp3_off.normTargetLufs, -16);
  assert.equal(dsp3_off.normSpeed, "std");

  const dsp4_off = store.computeDspForTab(4);
  assert.equal(dsp4_off.normActive, false); // CORS 캡으로 강제 우회

  // 2) 전역 스위치 반복 토글 (OFF -> ON -> OFF -> ON)
  store.toggleAutoNorm(); // true
  assert.equal(store.getSettings().autoNormEnabled, true);

  const dsp1_on = store.computeDspForTab(1);
  assert.equal(dsp1_on.normActive, true);
  assert.equal(dsp1_on.normTargetLufs, -14);
  assert.equal(dsp1_on.normSpeed, "fast");

  const dsp2_on = store.computeDspForTab(2);
  assert.equal(dsp2_on.normActive, false);
  assert.equal(dsp2_on.normTargetLufs, -18);
  assert.equal(dsp2_on.normSpeed, "slow");

  const dsp3_on = store.computeDspForTab(3);
  assert.equal(dsp3_on.normActive, true); // 전역 스위치 추종하여 활성화
  assert.equal(dsp3_on.normTargetLufs, -16);
  assert.equal(dsp3_on.normSpeed, "std");

  store.toggleAutoNorm(); // false
  assert.equal(store.getSettings().autoNormEnabled, false);
  assert.equal(store.computeDspForTab(3).normActive, false);

  store.toggleAutoNorm(); // true
  assert.equal(store.getSettings().autoNormEnabled, true);

  // 스냅샷 내 채널 fx 객체가 100% 보존되었는지 검증
  const snap = store.buildSnapshot();
  const ch1 = snap.channels.find((c) => c.tabId === 1)!;
  const ch2 = snap.channels.find((c) => c.tabId === 2)!;
  const ch3 = snap.channels.find((c) => c.tabId === 3)!;

  assert.equal(ch1.fx.normMode, "on");
  assert.equal(ch1.fx.normTargetLufs, -14);
  assert.equal(ch1.fx.normSpeed, "fast");

  assert.equal(ch2.fx.normMode, "off");
  assert.equal(ch2.fx.normTargetLufs, -18);
  assert.equal(ch2.fx.normSpeed, "slow");

  assert.equal(ch3.fx.normMode, "follow");

  const res1 = resolveEffectiveNormalizer(true, ch1.fx, false);
  assert.deepEqual(res1, { active: true, targetLufs: -14, speed: "fast", source: "custom-on" });

  const res2 = resolveEffectiveNormalizer(true, ch2.fx, false);
  assert.deepEqual(res2, { active: false, targetLufs: -18, speed: "slow", source: "custom-off" });

  const res3_on = resolveEffectiveNormalizer(true, ch3.fx, false);
  assert.deepEqual(res3_on, { active: true, targetLufs: -16, speed: "std", source: "auto" });

  const res3_off = resolveEffectiveNormalizer(false, ch3.fx, false);
  assert.deepEqual(res3_off, { active: false, targetLufs: -16, speed: "std", source: "off" });
});

test("선형 진폭 RSS 마스터 스테레오 VU 연산 및 L/R 팬 분리도 검증", () => {
  // 4개 재생 unmuted 채널이 모두 0dB 이하 (-6dB, -12dB, -15dB, -18dB)
  const channels = [
    { playing: true, muted: false, corsCap: false, vuLevel: dbToRatio(-6), fx: { pan: 0 } },
    { playing: true, muted: false, corsCap: false, vuLevel: dbToRatio(-12), fx: { pan: 0 } },
    { playing: true, muted: false, corsCap: false, vuLevel: dbToRatio(-15), fx: { pan: 0 } },
    { playing: true, muted: false, corsCap: false, vuLevel: dbToRatio(-18), fx: { pan: 0 } },
  ];

  const redZoneThreshold = dbToRatio(7.5); // 0.9375
  const masterVu = computeMasterStereoVu(channels, false);

  // RSS 진폭 결합 결과가 레드존(+7.5dB)을 초과하지 않고 훨씬 아래(약 -4.4dB, ratio ~0.77)에 위치함
  assert.ok(
    masterVu.left < redZoneThreshold,
    `Left VU (${masterVu.left}) should be well below red zone (${redZoneThreshold})`,
  );
  assert.ok(
    masterVu.right < redZoneThreshold,
    `Right VU (${masterVu.right}) should be well below red zone (${redZoneThreshold})`,
  );
  assert.ok(Math.abs(masterVu.left - masterVu.right) < 1e-6);

  // 마스터 음소거 시 완전 무음 0
  assert.deepEqual(computeMasterStereoVu(channels, true), { left: 0, right: 0 });

  // 좌측 극단 패닝 (pan: -100) -> L만 출력되고 R은 완전 무음 0
  const panLeftChannel = [
    { playing: true, muted: false, corsCap: false, vuLevel: dbToRatio(0), fx: { pan: -100 } },
  ];
  const vuLeftOnly = computeMasterStereoVu(panLeftChannel, false);
  assert.ok(vuLeftOnly.left > 0.8);
  assert.equal(vuLeftOnly.right, 0);

  // 우측 극단 패닝 (pan: 100) -> R만 출력되고 L은 완전 무음 0
  const panRightChannel = [
    { playing: true, muted: false, corsCap: false, vuLevel: dbToRatio(0), fx: { pan: 100 } },
  ];
  const vuRightOnly = computeMasterStereoVu(panRightChannel, false);
  assert.equal(vuRightOnly.left, 0);
  assert.ok(vuRightOnly.right > 0.8);

  // CORS 캡 걸린 채널은 팬 설정(예: pan: -100)이 있어도 보안 정책상 중앙(pan: 0)으로 폴백
  const corsPanChannel = [
    { playing: true, muted: false, corsCap: true, vuLevel: dbToRatio(-6), fx: { pan: -100 } },
  ];
  const vuCors = computeMasterStereoVu(corsPanChannel, false);
  assert.ok(vuCors.left > 0);
  assert.equal(vuCors.left, vuCors.right);
});

test("채널 드래그 정렬: 동일 구역 재배치(shouldTogglePlay: false) 및 구역 간 이동(playing -> paused) 검증", () => {
  const store = new MixerStateStore();
  const samplePlaying = {
    hasMedia: true,
    playingCount: 1,
    pausedCount: 0,
    corsRestricted: false,
    mediaTitle: "",
    vuLevel: 0.5,
    vuPeak: 0.6,
    normTrimDb: 0,
  };
  const samplePaused = {
    hasMedia: true,
    playingCount: 0,
    pausedCount: 1,
    corsRestricted: false,
    mediaTitle: "",
    vuLevel: 0,
    vuPeak: 0,
    normTrimDb: 0,
  };

  store.updateFrameReport(
    { tabId: 101, windowId: 1, url: "https://tab1.com", title: "탭101" },
    0,
    samplePlaying,
  );
  store.updateFrameReport(
    { tabId: 102, windowId: 1, url: "https://tab2.com", title: "탭102" },
    0,
    samplePlaying,
  );
  store.updateFrameReport(
    { tabId: 103, windowId: 1, url: "https://tab3.com", title: "탭103" },
    0,
    samplePaused,
  );

  let snap = store.buildSnapshot();
  assert.deepEqual(
    snap.channels.map((c) => c.tabId),
    [101, 102, 103],
  );

  // 1) 재생 구역 내 순서 변경 (102를 101 앞자리로): shouldTogglePlay === false
  const reorderRes1 = store.reorderChannels(102, "playing", [102, 101], [103]);
  assert.deepEqual(reorderRes1, { shouldTogglePlay: false, nextPlaying: true });

  snap = store.buildSnapshot();
  assert.deepEqual(
    snap.channels.map((c) => c.tabId),
    [102, 101, 103],
  );
  assert.equal(snap.channels.find((c) => c.tabId === 102)?.playing, true);
  assert.equal(snap.channels.find((c) => c.tabId === 101)?.playing, true);

  // 2) 재생 중이던 탭(102)을 일시정지 구역으로 이동: shouldTogglePlay === true, nextPlaying === false
  const reorderRes2 = store.reorderChannels(102, "paused", [101], [102, 103]);
  assert.deepEqual(reorderRes2, { shouldTogglePlay: true, nextPlaying: false });

  snap = store.buildSnapshot();
  // 101(재생)이 맨 앞, 일시정지 구역에 102, 103 순서로 즉시 갱신
  assert.deepEqual(
    snap.channels.map((c) => c.tabId),
    [101, 102, 103],
  );
  const ch102 = snap.channels.find((c) => c.tabId === 102)!;
  const ch101 = snap.channels.find((c) => c.tabId === 101)!;
  assert.equal(ch101.playing, true);
  assert.equal(ch102.playing, false);

  // 3) 일시정지 중이던 탭(103)을 재생 구역으로 승격: shouldTogglePlay === true, nextPlaying === true
  const reorderRes3 = store.reorderChannels(103, "playing", [103, 101], [102]);
  assert.deepEqual(reorderRes3, { shouldTogglePlay: true, nextPlaying: true });

  snap = store.buildSnapshot();
  assert.deepEqual(
    snap.channels.map((c) => c.tabId),
    [103, 101, 102],
  );
  assert.equal(snap.channels.find((c) => c.tabId === 103)?.playing, true);
});
