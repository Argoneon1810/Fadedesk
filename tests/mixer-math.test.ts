import assert from "node:assert/strict";
import test from "node:test";
import { MixerStateStore } from "../src/background/state-store";
import { clampStandaloneWindowBounds } from "../src/popup/popout-window";
import { createDemoTourChannels } from "../src/popup/tour-overlay";
import { resetUiLocaleCache, resolveUiLocale } from "../src/shared/i18n";
import {
  buildDspConfigPayload,
  defaultChannelFx,
  resolveEffectiveNormalizer,
} from "../src/shared/fx-model";
import {
  clampDb,
  computeAppliedChannelDb,
  computeDisplayedEffectiveDb,
  computeMasterStereoVu,
  dbToLinear,
  dbToRatio,
  extractDomainInfo,
  focusDimDbToAlpha,
  formatFocusReadout,
  getFocusDimDb,
  linearToDb,
  parseDbInput,
  parseFocusInput,
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

test("1.2.0 2계층 노멀라이저: 상단 균일 N 토글은 '이 채널만' 값을 건드리지 않는다", () => {
  const store = new MixerStateStore();
  // 기본: 모든 채널 노멀라이저 켜짐, 음악 프리셋
  assert.equal(store.getSettings().globalFx.norm.enabled, true);
  assert.equal(store.getSettings().globalFx.norm.presetId, "music");

  store.toggleAutoNorm();
  assert.equal(store.getSettings().globalFx.norm.enabled, false);

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
  for (const [id, url, cors] of [
    [1, "https://music.site/track1", false],
    [2, "https://video.site/movie", false],
    [3, "https://news.site/live", false],
    [4, "https://cors.cdn/stream", true],
  ] as const) {
    store.updateFrameReport({ tabId: id, windowId: 1, url, title: `탭 ${id}` }, 0, { ...baseReport, corsRestricted: cors });
  }

  // 탭 1: 이 채널만 따로 + 켬 + 목표 -14, 민감
  assert.equal(store.editFx(1, { kind: "detach", module: "norm" }), 1);
  assert.equal(store.editFx(1, { kind: "norm", patch: { enabled: true, targetLufs: -14, speed: "fast" } }), 1);
  // 탭 2: 이 채널만 따로 + 끔 (값 -18 보존)
  store.editFx(2, { kind: "detach", module: "norm" });
  store.editFx(2, { kind: "norm", patch: { enabled: false, targetLufs: -18 } });
  // 탭 3: 모든 채널 따름 → 값 편집은 잠겨 거부된다
  assert.equal(store.editFx(3, { kind: "norm", patch: { targetLufs: -12 } }), null);
  // 탭 4: CORS 탭은 따로 켜도 DSP 우회
  store.editFx(4, { kind: "detach", module: "norm" });
  store.editFx(4, { kind: "norm", patch: { enabled: true } });

  const check = (globalOn: boolean): void => {
    const d1 = store.computeDspForTab(1);
    assert.equal(d1.normActive, true);
    assert.equal(d1.normTargetLufs, -14);
    assert.equal(d1.normSpeed, "fast");
    const d2 = store.computeDspForTab(2);
    assert.equal(d2.normActive, false);
    assert.equal(d2.normTargetLufs, -18);
    const d3 = store.computeDspForTab(3);
    assert.equal(d3.normActive, globalOn);
    assert.equal(d3.normTargetLufs, -16);
    assert.equal(store.computeDspForTab(4).normActive, false);
  };
  check(false);
  for (const expected of [true, false, true]) {
    store.toggleAutoNorm();
    assert.equal(store.getSettings().globalFx.norm.enabled, expected);
    check(expected);
  }

  const snap = store.buildSnapshot();
  const fx = (id: number) => snap.channels.find((c) => c.tabId === id)!.fx;
  assert.equal(fx(1).own.norm?.targetLufs, -14);
  assert.equal(fx(1).own.norm?.modified, true);
  assert.equal(fx(2).own.norm?.enabled, false);
  assert.equal(fx(3).own.norm, undefined);

  const g = snap.settings.globalFx;
  assert.equal(resolveEffectiveNormalizer(g, fx(1), false).source, "custom-on");
  assert.equal(resolveEffectiveNormalizer(g, fx(2), false).source, "custom-off");
  assert.equal(resolveEffectiveNormalizer(g, fx(3), false).source, "auto");
  g.norm.enabled = false;
  assert.equal(resolveEffectiveNormalizer(g, fx(3), false).source, "off");
});

test("선형 진폭 RSS 마스터 스테레오 VU 연산 및 L/R 팬 분리도 검증", () => {
  // 4개 재생 unmuted 채널이 모두 0dB 이하 (-6dB, -12dB, -15dB, -18dB)
  const channels = [
    { playing: true, muted: false, corsCap: false, vuLevel: dbToRatio(-6), pan: 0 },
    { playing: true, muted: false, corsCap: false, vuLevel: dbToRatio(-12), pan: 0 },
    { playing: true, muted: false, corsCap: false, vuLevel: dbToRatio(-15), pan: 0 },
    { playing: true, muted: false, corsCap: false, vuLevel: dbToRatio(-18), pan: 0 },
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
    { playing: true, muted: false, corsCap: false, vuLevel: dbToRatio(0), pan: -100 },
  ];
  const vuLeftOnly = computeMasterStereoVu(panLeftChannel, false);
  assert.ok(vuLeftOnly.left > 0.8);
  assert.equal(vuLeftOnly.right, 0);

  // 우측 극단 패닝 (pan: 100) -> R만 출력되고 L은 완전 무음 0
  const panRightChannel = [
    { playing: true, muted: false, corsCap: false, vuLevel: dbToRatio(0), pan: 100 },
  ];
  const vuRightOnly = computeMasterStereoVu(panRightChannel, false);
  assert.equal(vuRightOnly.left, 0);
  assert.ok(vuRightOnly.right > 0.8);

  // CORS 캡 걸린 채널은 팬 설정(예: pan: -100)이 있어도 보안 정책상 중앙(pan: 0)으로 폴백
  const corsPanChannel = [
    { playing: true, muted: false, corsCap: true, vuLevel: dbToRatio(-6), pan: -100 },
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

test("명시적 탭 재생 상태 동기화(setTabPlaying · toggleTabPlayingOptimistic) 검증", () => {
  const store = new MixerStateStore();
  store.updateFrameReport(
    { tabId: 201, windowId: 1, url: "https://music.youtube.com/watch?v=1", title: "YTM" },
    0,
    {
      hasMedia: true,
      playingCount: 0,
      pausedCount: 1,
      corsRestricted: false,
      mediaTitle: "테스트 곡",
      vuLevel: 0,
      vuPeak: 0,
      normTrimDb: 0,
    },
  );

  assert.equal(store.isTabPlaying(201), false);
  assert.equal(store.setTabPlaying(201, true), true);
  assert.equal(store.isTabPlaying(201), true);
  assert.equal(store.buildSnapshot().channels[0]?.playing, true);

  assert.equal(store.toggleTabPlayingOptimistic(201), true);
  assert.equal(store.isTabPlaying(201), false);

  // 미등록 탭 방어
  assert.equal(store.isTabPlaying(999), false);
  assert.equal(store.setTabPlaying(999, true), false);
  assert.equal(store.toggleTabPlayingOptimistic(999), false);
});

test("독립 콘솔 창 크기(setPopoutBounds · clampStandaloneWindowBounds) 520×420 최소 크기 보장 검증", () => {
  const store = new MixerStateStore();
  assert.equal(store.getSettings().popoutWidth, 780);
  assert.equal(store.getSettings().popoutHeight, 480);

  // 하한/상한 클램핑 (520..2560, 420..1600)
  assert.equal(store.setPopoutBounds(300, 200), true);
  assert.equal(store.getSettings().popoutWidth, 520);
  assert.equal(store.getSettings().popoutHeight, 420);

  // 동일 치수 재요청 시 불필요한 스토리지 쓰기 방지를 위해 false 반환
  assert.equal(store.setPopoutBounds(520, 420), false);

  // 비정상 수치(NaN, Infinity, 0 이하) 방어
  assert.equal(store.setPopoutBounds(Number.NaN, 600), false);
  assert.equal(store.setPopoutBounds(800, Number.POSITIVE_INFINITY), false);
  assert.equal(store.setPopoutBounds(0, 480), false);

  store.hydrateSettings({ popoutWidth: 4000, popoutHeight: 2400 });
  assert.equal(store.getSettings().popoutWidth, 2560);
  assert.equal(store.getSettings().popoutHeight, 1600);

  assert.deepEqual(clampStandaloneWindowBounds(340, 260), { clamped: true, width: 520, height: 420 });
  assert.deepEqual(clampStandaloneWindowBounds(680, 480), { clamped: false, width: 680, height: 480 });
});

test("이지 노멀라이저 4종 프리셋(클래식·음악·표준·야간) 합성 및 온보딩 완료 플래그 검증", () => {
  const store = new MixerStateStore();
  assert.equal(store.getSettings().globalFx.norm.presetId, "music");
  assert.equal(store.getSettings().onboardingDone, false);

  // 온보딩 완료는 최초 1회만 true 반환 (이후 중복 호출은 false)
  assert.equal(store.completeOnboarding(), true);
  assert.equal(store.getSettings().onboardingDone, true);
  assert.equal(store.completeOnboarding(), false);

  // 상단 균일 N ▾에서 고른 기본 프리셋의 목표 음압·계측 창이 "모든 채널" 슬롯에 복사된다
  const expect: Array<[string, number, string]> = [
    ["classical", -16, "slow"],
    ["music", -16, "slow"],
    ["standard", -16, "std"],
    ["night", -18, "fast"],
  ];
  for (const [key, lufs, speed] of expect) {
    assert.equal(store.setAutoNormPreset(key, true), true);
    const res = resolveEffectiveNormalizer(store.getSettings().globalFx, defaultChannelFx(), false);
    assert.deepEqual([res.active, res.targetLufs, res.speed, res.source], [true, lufs, speed, "auto"]);
  }
  assert.equal(store.setAutoNormPreset("nope"), false);

  store.setAutoNormPreset("music", true);
  assert.equal(store.computeDspForTab(999).normSpeed, "slow");

  // "이 채널만" 채널은 모든 채널 프리셋을 바꿔도 자기 값(-14 LUFS)을 지킨다
  const own = defaultChannelFx();
  own.own.norm = { ...store.getSettings().globalFx.norm, targetLufs: -14, presetId: "", modified: false };
  store.setAutoNormPreset("night", true);
  const dspCustom = buildDspConfigPayload(store.getSettings().globalFx, 0, own, false);
  assert.equal(dspCustom.normTargetLufs, -14);
  assert.equal(dspCustom.normSpeed, "slow");
});

test("0.8.0 상단 Focus α 수치창 직접 입력 파서(parseFocusInput · 0.1dB 해상도) 검증", () => {
  assert.equal(parseFocusInput("-12"), 0.7);
  assert.equal(parseFocusInput("-12dB"), 0.7);
  assert.equal(parseFocusInput("-15.5"), 0.6125);
  assert.equal(getFocusDimDb(0.6125), -15.5);
  assert.equal(formatFocusReadout(0.6125), "0.61 · -15.5dB");
  assert.equal(parseFocusInput("0"), 1);
  assert.equal(parseFocusInput("-40"), 0);
  assert.equal(parseFocusInput("-inf"), 0);
  assert.equal(parseFocusInput("0.75"), 0.75);
  assert.equal(focusDimDbToAlpha(-20), 0.5);
  assert.equal(parseFocusInput("abc"), null);
});

test("0.9.0 마지막 Solo 탭 종료 감지(releasedLastSolo), 다국어 로케일 해석, 중립 투어 데모 채널 검증", () => {
  const store = new MixerStateStore();
  const baseReport = {
    hasMedia: true,
    playingCount: 1,
    pausedCount: 0,
    corsRestricted: false,
    mediaTitle: "",
    vuLevel: 0.4,
    vuPeak: 0.5,
    normTrimDb: 0,
  };

  store.updateFrameReport({ tabId: 1, windowId: 1, url: "https://audio.example/a", title: "A" }, 0, baseReport);
  store.updateFrameReport({ tabId: 2, windowId: 1, url: "https://live.example/b", title: "B" }, 0, baseReport);
  store.updateFrameReport({ tabId: 3, windowId: 1, url: "https://video.example/c", title: "C" }, 0, baseReport);

  // 탭 1과 탭 2 동시 Solo 상태에서 탭 1 종료 -> 아직 탭 2가 Solo이므로 releasedLastSolo === false
  store.toggleTabMode(1, "solo", false);
  store.toggleTabMode(2, "solo", true);
  assert.deepEqual(store.removeTab(1), { releasedLastSolo: false });

  // 마지막 남은 Solo 탭 2 종료 -> 나머지 탭들의 급작스러운 폭음 복귀를 막기 위해 releasedLastSolo === true 반환
  assert.deepEqual(store.removeTab(2), { releasedLastSolo: true });

  // 일반 탭 3 종료 및 미존재 탭 종료
  assert.deepEqual(store.removeTab(3), { releasedLastSolo: false });
  assert.deepEqual(store.removeTab(999), { releasedLastSolo: false });

  // 다국어 로케일 우선순위 검증 (?lang -> chrome.i18n.getUILanguage -> <html lang>)
  const g = globalThis as Record<string, unknown>;
  const prevLocation = g.location;
  const prevChrome = g.chrome;
  try {
    g.location = { search: "?lang=en" };
    resetUiLocaleCache();
    assert.equal(resolveUiLocale(), "en");

    g.location = { search: "?lang=ko" };
    resetUiLocaleCache();
    assert.equal(resolveUiLocale(), "ko");

    g.location = { search: "" };
    g.chrome = { i18n: { getUILanguage: () => "en-US" } };
    resetUiLocaleCache();
    assert.equal(resolveUiLocale(), "en");

    const enDemo = createDemoTourChannels();
    assert.equal(enDemo[0]?.domain, "audio.example");
    assert.equal(enDemo[1]?.domain, "live.example");
    assert.ok(!enDemo.some((c) => /youtube|naver|chzzk|kiminoshigusamo/i.test(`${c.title} ${c.domain}`)));

    g.chrome = { i18n: { getUILanguage: () => "ko-KR" } };
    resetUiLocaleCache();
    assert.equal(resolveUiLocale(), "ko");
  } finally {
    g.location = prevLocation;
    g.chrome = prevChrome;
    resetUiLocaleCache();
  }
});
