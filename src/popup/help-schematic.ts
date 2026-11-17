import { getUiLocale } from "../shared/i18n";
import { helpCopy, TERM_CHIP_MAP, type HelpTermKey, type TermInfo } from "./help-copy";

/**
 * Fadedesk 콘솔 도움말 인라인 SVG 스키매틱 및 부품 정보 조회 모듈.
 * 실제 콘솔 레이아웃(헤더 탭이동, 상단 분리·균일 스플릿, 페이더/노브/VU 순서, 압정 핀 위치, 스테레오 마스터)과 100% 일치한다.
 */

export { TERM_CHIP_MAP, type HelpTermKey, type TermInfo };

export function getTermInfo(key: HelpTermKey): TermInfo {
  return helpCopy().terms[key];
}

/**
 * 콘솔 실제 화면과 100% 대응되는 인라인 SVG 스키매틱 렌더러.
 */
export function renderSchematicSvg(active: HelpTermKey | null): string {
  const is = (k: HelpTermKey): string => (active === k ? "highlighted" : "");
  const en = getUiLocale() === "en";
  const normLabel = en ? "Level N" : "균일 N";
  const playLabel = en ? "Play" : "재생";
  const pauseAllLabel = en ? "Pause All" : "전체 정지";
  const muteAllLabel = en ? "Mute All" : "전체 음소거";

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
    <text x="71" y="10" font-size="3.6" font-weight="bold" text-anchor="middle">${normLabel}</text>
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
  <text x="27" y="100" font-size="3.4" font-weight="bold" fill="currentColor" opacity="0.7">${playLabel}</text>
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
    <!-- 좌측 페이더/노브 + 중앙 눈금 + 우측 2열(L/R) VU 미터 -->
    <rect x="66.5" y="27" width="3.5" height="51" rx="1.5" opacity="0.4" />
    <rect x="64" y="50" width="8.5" height="6" rx="1.5" />
    <line x1="74" y1="53" x2="77" y2="53" stroke="currentColor" stroke-width="0.7" opacity="0.5" />
    <rect x="81" y="27" width="3" height="51" rx="1" opacity="0.6" />
    <rect x="85.5" y="27" width="3" height="51" rx="1" opacity="0.6" />
    <!-- 마스터 수치창 -->
    <rect x="65" y="82" width="24" height="9" rx="2" opacity="0.6" />
    <text x="77" y="88.5" font-size="4.2" font-family="monospace" font-weight="bold" text-anchor="middle">0.0 dB</text>
    <!-- 2단 스택 버튼: 전체 정지 + 전체 음소거 -->
    <rect x="65" y="93.5" width="24" height="9.5" rx="2" opacity="0.8" />
    <text x="77" y="99.5" font-size="3.1" font-weight="bold" text-anchor="middle">${pauseAllLabel}</text>
    <rect x="65" y="105" width="24" height="13" rx="2" opacity="0.8" />
    <text x="77" y="113" font-size="3.1" font-weight="bold" text-anchor="middle">${muteAllLabel}</text>
  </g>
</svg>`.trim();
}
