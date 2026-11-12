/**
 * Sound Manager 0.7.0 콘솔 도움말 인라인 SVG 스키매틱 및 부품 정보 정의 모듈.
 * 실제 0.7.0 콘솔 레이아웃(헤더 탭이동, 상단 분리·균일 스플릿, 페이더/노브/VU 순서, 압정 핀 위치, 스테레오 마스터)과 100% 일치 (< 240 lines).
 */

export type HelpTermKey =
  | "tabJump"
  | "popout"
  | "normSplit"
  | "fader"
  | "knob"
  | "meter"
  | "readout"
  | "grip"
  | "pin"
  | "switchBank"
  | "masterBus";

export interface TermInfo {
  name: string;
  subtitle: string;
  description: string;
}

export const TERM_INFO: Record<HelpTermKey, TermInfo> = {
  tabJump: {
    name: "탭 이동 헤더 (Tab Jump)",
    subtitle: "파비콘 · 도메인 · ↗ 바로 이동 버튼",
    description: "채널 상단 파비콘·사이트명·↗ 버튼입니다. 클릭하거나 채널 선택 후 Enter를 누르면 해당 미디어가 재생 중인 브라우저 탭과 창으로 즉시 포커스가 이동합니다.",
  },
  popout: {
    name: "독립 창 분리 (Popout)",
    subtitle: "상단 데크 ? 옆 창 분리(↗) 버튼",
    description: "상단 데크의 창 분리 버튼입니다. 팝업을 독립 콘솔 창으로 떼어내 항상 띄워 두고 크기를 자유롭게 조절할 수 있습니다(최소 520×420 크기 자동 유지).",
  },
  normSplit: {
    name: "균일 N ▾ (Normalizer Split)",
    subtitle: "상단 자동 음압 평준화 스플릿 버튼",
    description: "상단 자동 볼륨 균일화 스플릿 버튼입니다. 본체를 누르면 즉시 ON/OFF되며, 우측 ▾ 클릭 시 음악(강약 보존) · 표준(영상/방송) · 야간(강한 균일) 프리셋을 전환합니다.",
  },
  fader: {
    name: "페이더 (Fader)",
    subtitle: "채널 중앙 볼륨 슬롯 · 눈금 영역",
    description: "채널 중앙의 볼륨 슬롯과 눈금 영역입니다. 마우스 휠(Shift+휠 미세 조절)로 음량을 조절하거나 더블클릭해 0.0dB로 복귀합니다(오조작 방지를 위해 드래그는 노브 전용).",
  },
  knob: {
    name: "노브 (Knob)",
    subtitle: "볼륨 조절 사각 손잡이 캡",
    description: "페이더와 상단 Focus α 슬라이더 위의 사각 손잡이 캡입니다. 마우스로 직접 잡고 위아래로 끌어 -60dB ~ +12dB를 조절하며, 더블클릭 시 0.0dB로 즉시 복귀합니다.",
  },
  meter: {
    name: "레벨 미터 (Level Meter)",
    subtitle: "실시간 출력 음량 20단 피크 미터",
    description: "페이더·눈금 오른쪽의 20단 실시간 피크 미터입니다. 현재 채널의 출력 음량 크기와 과증폭(+0dB 초과 경고) 여부를 녹색·주황·적색 컬러 막대로 보여줍니다.",
  },
  readout: {
    name: "수치 표시창 (Readout)",
    subtitle: "스트립 전체 폭 dB 표시 · 직접 입력창",
    description: "페이더 아래 전체 폭 데시벨 표시창입니다. 클릭하면 원하는 수치(예: -8.5)를 키보드로 직접 타이핑하여 Enter로 즉시 적용할 수 있습니다.",
  },
  grip: {
    name: "드래그 핸들 (Grip Handle)",
    subtitle: "채널 맨 위 6점(⠿) 이동 손잡이",
    description: "채널 맨 위 좌측 점 6개(⠿) 손잡이(우측에는 노멀라이저 N 배지 표시)입니다. 좌우로 끌어 순서를 바꾸거나, 우측 대기 구역에 놓아 즉시 일시정지할 수 있습니다.",
  },
  pin: {
    name: "도메인 핀 (Domain Pin)",
    subtitle: "하단 재생 버튼 오른쪽 압정(📌) 스위치",
    description: "하단 재생 버튼 오른쪽의 압정(📌) 스위치입니다. 켜 두면 이후 같은 사이트를 새 탭으로 열 때 현재 설정한 볼륨이 시작 기본값으로 자동 적용됩니다.",
  },
  switchBank: {
    name: "스위치 뱅크 (Switch Bank)",
    subtitle: "채널 최하단 M · S · F 3버튼 묶음",
    description: "채널 맨 아래 M · S · F 3버튼 묶음입니다. M(음소거), S(단독 청취), F(선택 탭 외 배경 탭 감쇠 · Shift+클릭 다중 선택)로 여러 탭 간의 청취 집중도를 빠르게 전환합니다.",
  },
  masterBus: {
    name: "마스터 버스 (Master Bus)",
    subtitle: "콘솔 우측 고정 전체 출력 스트립",
    description: "콘솔 우측에 고정된 전체 출력 스트립입니다. 좌·우 2열 스테레오 레벨 미터, 중앙 마스터 페이더, 하단 전체 정지 및 전체 음소거 2단 버튼으로 구성됩니다.",
  },
};

export const TERM_CHIP_MAP: Record<string, HelpTermKey> = {
  "탭 이동 헤더": "tabJump",
  "독립 창 분리": "popout",
  "균일 N ▾": "normSplit",
  "페이더": "fader",
  "노브": "knob",
  "레벨 미터": "meter",
  "수치 표시창": "readout",
  "드래그 핸들": "grip",
  "도메인 핀": "pin",
  "스위치 뱅크": "switchBank",
  "마스터 버스": "masterBus",
};

/**
 * 0.7.0 콘솔 실제 화면과 100% 대응되는 인라인 SVG 스키매틱 렌더러.
 */
export function renderSchematicSvg(active: HelpTermKey | null): string {
  const is = (k: HelpTermKey): string => (active === k ? "highlighted" : "");

  return `<svg class="nested-schematic-svg" viewBox="0 0 96 126" width="82" height="108" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <!-- 상단 미니 데크 바 -->
  <rect x="4" y="3" width="88" height="11" rx="2" class="svg-strip-box" />
  <circle cx="8.5" cy="8.5" r="1.8" fill="var(--c-primary)" opacity="0.75" />
  <rect x="13" y="6.5" width="28" height="4" rx="1" class="svg-dim-placeholder" />
  <rect x="44" y="5.5" width="6" height="6" rx="1.2" class="svg-dim-placeholder" />
  <text x="47" y="10" font-size="4" font-weight="bold" text-anchor="middle" fill="currentColor" opacity="0.6">?</text>
  <g class="svg-part svg-popout ${is("popout")}" data-schematic="popout">
    <rect x="52" y="5.5" width="7" height="6" rx="1.2" class="svg-part-box" />
    <path d="M54 9.5 L57 6.5 M55 6.5 H57 V8.5" stroke="currentColor" stroke-width="0.7" fill="none" />
  </g>
  <g class="svg-part svg-normSplit ${is("normSplit")}" data-schematic="normSplit">
    <rect x="61" y="5.5" width="29" height="6" rx="1.2" class="svg-part-box" />
    <text x="71" y="10" font-size="3.8" font-weight="bold" text-anchor="middle">균일 N</text>
    <line x1="81" y1="5.5" x2="81" y2="11.5" stroke="currentColor" stroke-width="0.6" opacity="0.5" />
    <path d="M84 7.5 L86 9.5 L88 7.5" stroke="currentColor" stroke-width="0.6" fill="none" />
  </g>

  <!-- 좌측 채널 스트립 (x=4, y=17, w=54, h=105) -->
  <rect x="4" y="17" width="54" height="105" rx="3" class="svg-strip-box" />

  <!-- 1) 최상단 핸들 바 (y=20..26) -->
  <g class="svg-part svg-grip ${is("grip")}" data-schematic="grip">
    <rect x="7" y="19.5" width="36" height="6" rx="1.5" class="svg-part-box" />
    <circle cx="19" cy="21.5" r="0.7" /><circle cx="22" cy="21.5" r="0.7" /><circle cx="25" cy="21.5" r="0.7" />
    <circle cx="19" cy="23.5" r="0.7" /><circle cx="22" cy="23.5" r="0.7" /><circle cx="25" cy="23.5" r="0.7" />
  </g>
  <rect x="45.5" y="20" width="9" height="5" rx="1" class="svg-dim-placeholder" />
  <text x="50" y="24" font-size="3.5" font-weight="bold" text-anchor="middle" fill="currentColor" opacity="0.8">N</text>

  <!-- 2) 채널 헤더 (y=27..38) -->
  <g class="svg-part svg-tabJump ${is("tabJump")}" data-schematic="tabJump">
    <rect x="7" y="27" width="48" height="12" rx="2" class="svg-part-box" />
    <rect x="9" y="28.5" width="5" height="5" rx="1" fill="currentColor" opacity="0.6" />
    <line x1="16" y1="31" x2="43" y2="31" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
    <path d="M48 32.5 L51 29.5 M49 29.5 H51 V31.5" stroke="currentColor" stroke-width="0.7" fill="none" />
    <line x1="9" y1="36" x2="48" y2="36" stroke="currentColor" stroke-width="0.8" opacity="0.45" stroke-linecap="round" />
  </g>

  <!-- 3) 페이더 웰 (y=41..80): 좌:트랙·노브 / 중:눈금 / 우:VU -->
  <rect x="7" y="41" width="48" height="39" rx="2" fill="none" stroke="var(--c-border)" stroke-width="0.5" opacity="0.35" />
  <g class="svg-part svg-fader ${is("fader")}" data-schematic="fader">
    <rect x="12" y="43" width="5" height="35" rx="2" class="svg-part-box" />
  </g>
  <g class="svg-part svg-knob ${is("knob")}" data-schematic="knob">
    <rect x="8.5" y="53" width="12" height="7" rx="1.5" class="svg-part-box" />
    <line x1="10" y1="56.5" x2="19" y2="56.5" stroke="currentColor" stroke-width="0.8" />
  </g>

  <!-- 가운데 눈금선 (+12 / 0 / -24) -->
  <g opacity="0.45" font-size="2.8" font-family="monospace">
    <line x1="20" y1="46" x2="23" y2="46" stroke="currentColor" stroke-width="0.5" />
    <text x="24.5" y="47">+12</text>
    <line x1="20" y1="56.5" x2="24" y2="56.5" stroke="currentColor" stroke-width="0.8" />
    <text x="25.5" y="57.5">0</text>
    <line x1="20" y1="67" x2="23" y2="67" stroke="currentColor" stroke-width="0.5" />
    <text x="24.5" y="68">-24</text>
  </g>

  <!-- 우측 VU 20단 막대 -->
  <g class="svg-part svg-meter ${is("meter")}" data-schematic="meter">
    <rect x="33" y="43" width="7" height="35" rx="1.5" class="svg-part-box" />
    <rect x="34.5" y="45" width="4" height="2.5" rx="0.5" />
    <rect x="34.5" y="49" width="4" height="2.5" rx="0.5" />
    <rect x="34.5" y="53" width="4" height="2.5" rx="0.5" />
    <rect x="34.5" y="57" width="4" height="2.5" rx="0.5" />
    <rect x="34.5" y="61" width="4" height="2.5" rx="0.5" />
    <rect x="34.5" y="65" width="4" height="2.5" rx="0.5" />
    <rect x="34.5" y="69" width="4" height="2.5" rx="0.5" />
    <rect x="34.5" y="73" width="4" height="2.5" rx="0.5" />
  </g>

  <!-- 4) 수치 표시창 (y=82..91) -->
  <g class="svg-part svg-readout ${is("readout")}" data-schematic="readout">
    <rect x="7" y="82" width="48" height="9" rx="2" class="svg-part-box" />
    <text x="31" y="88.5" font-size="4.8" font-family="monospace" text-anchor="middle" font-weight="bold">0.0 dB</text>
  </g>

  <!-- 5) 트랜스포트 행 (y=93..103): 좌:재생 / 우:압정(핀) -->
  <rect x="7" y="93.5" width="31" height="9.5" rx="2" class="svg-dim-placeholder" />
  <polygon points="19,96.5 19,100.5 24,98.5" fill="currentColor" opacity="0.6" />
  <text x="29" y="100" font-size="3.5" font-weight="bold" fill="currentColor" opacity="0.7">재생</text>
  <g class="svg-part svg-pin ${is("pin")}" data-schematic="pin">
    <rect x="40" y="93.5" width="15" height="9.5" rx="2" class="svg-part-box" />
    <path d="M47.5 95.5 v2.5 M45.5 97 h4 M46 99.5 l1.5 2 l1.5 -2" stroke-width="0.8" stroke="currentColor" fill="none" />
  </g>

  <!-- 6) 최하단 스위치 뱅크 (y=105..118): M · S · F -->
  <g class="svg-part svg-switchBank ${is("switchBank")}" data-schematic="switchBank">
    <rect x="7" y="105" width="48" height="13" rx="2" class="svg-part-box" />
    <rect x="9" y="107" width="13" height="9" rx="1.5" />
    <text x="15.5" y="113.5" font-size="4.5" font-weight="bold" text-anchor="middle">M</text>
    <rect x="24.5" y="107" width="13" height="9" rx="1.5" />
    <text x="31" y="113.5" font-size="4.5" font-weight="bold" text-anchor="middle">S</text>
    <rect x="40" y="107" width="13" height="9" rx="1.5" />
    <text x="46.5" y="113.5" font-size="4.5" font-weight="bold" text-anchor="middle">F</text>
  </g>

  <!-- 우측 마스터 버스 (x=62, y=17, w=30, h=105) -->
  <g class="svg-part svg-masterBus ${is("masterBus")}" data-schematic="masterBus">
    <rect x="62" y="17" width="30" height="105" rx="3" class="svg-part-box svg-master-frame" />
    <text x="77" y="24" font-size="3.8" font-weight="800" text-anchor="middle" letter-spacing="0.4">MASTER</text>
    <!-- 좌측 VU 열 + 중앙 페이더/노브 + 우측 VU 열 -->
    <rect x="65" y="27" width="3" height="51" rx="1" opacity="0.6" />
    <rect x="75.5" y="27" width="3" height="51" rx="1.5" opacity="0.4" />
    <rect x="72" y="50" width="10" height="6" rx="1.5" />
    <rect x="84" y="27" width="3" height="51" rx="1" opacity="0.6" />
    <!-- 마스터 수치창 -->
    <rect x="65" y="82" width="24" height="9" rx="2" opacity="0.6" />
    <text x="77" y="88.5" font-size="4.2" font-family="monospace" font-weight="bold" text-anchor="middle">0.0 dB</text>
    <!-- 2단 스택 버튼: 전체 정지 + 전체 음소거 -->
    <rect x="65" y="93.5" width="24" height="9.5" rx="2" opacity="0.8" />
    <text x="77" y="99.5" font-size="3.2" font-weight="bold" text-anchor="middle">전체 정지</text>
    <rect x="65" y="105" width="24" height="13" rx="2" opacity="0.8" />
    <text x="77" y="113" font-size="3.2" font-weight="bold" text-anchor="middle">전체 음소거</text>
  </g>
</svg>`.trim();
}
