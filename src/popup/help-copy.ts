import { getUiLocale, type UiLocale } from "../shared/i18n";

/**
 * Fadedesk 한·영 도움말 모달(5단계 안전·면책 포함), 스키매틱 용어 사전, 실화면 투어 문구 모듈.
 * 제3자 상표와 실제 상용 음원 제목을 배제하고 RFC 2606 예약 도메인(`audio.example`, `live.example`)만 사용한다.
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

export interface HelpStep {
  title: string;
  bullets: string[];
}

export interface TourStepCopy {
  step: number;
  title: string;
  desc: string;
}

export interface HelpLocaleBundle {
  dialogAria: string;
  closeAria: string;
  tabTour: string;
  tabEasy: string;
  tabAdv: string;
  introBadge: string;
  introTitle: string;
  introItems: Array<{ lead: string; body: string }>;
  introNote: string;
  tourStartBtn: string;
  tourSkipBtn: string;
  introSub: string;
  easyHint: string;
  advHint: string;
  safetyHint: string;
  pinnedTip: string;
  unpinnedTip: string;
  stepAria: (idx: number) => string;
  prevBtn: string;
  nextBtn: string;
  easySteps: HelpStep[];
  advSteps: HelpStep[];
  terms: Record<HelpTermKey, TermInfo>;
  tourDialogAria: string;
  tourDemoPill: string;
  tourSkipLabel: string;
  tourPrevLabel: string;
  tourNextLabel: string;
  tourDoneLabel: string;
  demoTrackTitle: string;
  demoStreamTitle: string;
  tourSteps: TourStepCopy[];
}

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
  "Tab Header": "tabJump",
  "Popout": "popout",
  "Level N ▾": "normSplit",
  "Fader": "fader",
  "Knob": "knob",
  "Level Meter": "meter",
  "Readout": "readout",
  "Grip Handle": "grip",
  "Domain Pin": "pin",
  "Switch Bank": "switchBank",
  "Master Bus": "masterBus",
};

const KO_HELP: HelpLocaleBundle = {
  dialogAria: "Fadedesk 사용법 및 안전 안내",
  closeAria: "도움말 닫기",
  tabTour: "빠른 투어",
  tabEasy: "콘솔 사용법",
  tabAdv: "노멀라이저 · 고급 FX",
  introBadge: "GUIDED TOUR",
  introTitle: "실제 콘솔 화면 위에서 주요 기능을 바로 익혀 보세요",
  introItems: [
    {
      lead: "탭 바로 이동 & 창 분리",
      body: "채널 헤더(↗)를 눌러 재생 중인 탭으로 바로 이동하거나, 상단 창 분리(↗)로 콘솔을 독립 창에 띄워 둡니다.",
    },
    {
      lead: "정밀 볼륨 & 집중 청취",
      body: "탭별 -60 ~ +12dB 증폭, 직접 숫자 입력, 배경 탭만 부드럽게 줄이는 Focus(F)를 제공합니다.",
    },
    {
      lead: "음악·표준·야간 맞춤 노멀라이저",
      body: "곡 내부 강약을 보존하는 음악 모드부터 표준·야간까지 원클릭 프리셋을 지원합니다.",
    },
  ],
  introNote:
    "열린 미디어 탭이 없어도 투어 동안 중립 예시 채널 2개가 임시로 표시되며, 끝나거나 건너뛰면 즉시 원래 화면으로 돌아갑니다.",
  tourStartBtn: "실화면 투어 시작 ▸",
  tourSkipBtn: "바로 쓰기 (건너뛰기)",
  introSub: "상단 ? 버튼에서 사용법과 안전 유의사항을 언제든 다시 볼 수 있습니다 · Esc로 닫기",
  easyHint: "밑줄 친 부품 이름에 커서를 올리면 위치를 미리 보고, 클릭하면 고정됩니다.",
  advHint: "밑줄 친 프리셋·부품 이름에 커서를 올려 도면 위치를 확인할 수 있습니다.",
  safetyHint: "청력·장비 보호와 중요 알림, 보안 페이지 호환을 위해 사용 전 꼭 확인해 주세요.",
  pinnedTip: "✓ 클릭으로 고정됨 · 칩 다시 클릭 또는 바깥 클릭 시 닫힘",
  unpinnedTip: "💡 칩을 클릭하면 화면에 고정됩니다",
  stepAria: (idx) => `${idx + 1}단계`,
  prevBtn: "이전",
  nextBtn: "다음",
  easySteps: [
    {
      title: "탭 바로 이동 · 독립 창 분리 · 테마 전환",
      bullets: [
        "채널 상단 [탭 이동 헤더](파비콘 · 사이트명 · ↗)를 클릭하거나 채널 선택 후 Enter를 누르면 해당 미디어가 열린 브라우저 탭·창으로 즉시 이동합니다.",
        "상단 [독립 창 분리](↗) 버튼으로 팝업을 별도 창으로 떼어내 상시 띄워 둘 수 있으며(최소 520×420 자동 유지), 좌측 색상 점(●)에서 4종 테마와 다크·라이트 모드를 전환합니다.",
        "전역 단축키(Alt+Shift+M 콘솔 열기, Alt+Shift+0 전체 음소거, Alt+Shift+F Focus 순환 · macOS는 Ctrl+Shift)와 방향키·0·M/S/F/P 조작을 지원합니다.",
      ],
    },
    {
      title: "탭별 볼륨 증폭 · 노브 조작 · 수치 직접 입력",
      bullets: [
        "실수로 트랙을 건드려 볼륨이 튀는 것을 막기 위해 드래그는 [페이더] 위의 사각 [노브]를 직접 잡고 움직이며, 레일 위에서는 마우스 휠(Shift+휠 미세 조절)과 더블클릭(0.0dB 복귀)이 동작합니다.",
        "0 눈금 위로 올리면 최대 +12dB(약 4배)까지 증폭되며 우측 [레벨 미터]로 실시간 출력 레벨을 확인합니다.",
        "아래 [수치 표시창]을 클릭하면 -8.5처럼 원하는 데시벨 숫자를 키보드로 직접 입력합니다.",
      ],
    },
    {
      title: "집중 청취(M·S·F) · 드래그 정렬 · 도메인 핀",
      bullets: [
        "하단 [스위치 뱅크]에서 F(Focus)를 켜면 선택 탭은 그대로 두고 나머지 탭만 상단 Focus α 비율만큼 줄입니다(우측 데시벨 수치 클릭 시 직접 입력, S 단독 청취, Shift+클릭 다중 선택).",
        "맨 위 좌측 [드래그 핸들]을 끌어 순서를 바꾸거나, 구분선 너머 우측 대기 구역에 놓아 즉시 일시정지·좌측으로 옮겨 즉시 재생합니다.",
        "재생 버튼 오른쪽 [도메인 핀]을 켜면 같은 사이트를 새 탭으로 열 때 현재 볼륨이 초기값으로 자동 적용됩니다.",
      ],
    },
    {
      title: "자동 볼륨 균일화(균일 N ▾) 옵션 읽는 법과 마스터 제어",
      bullets: [
        "상단 [균일 N ▾]는 기본 켜짐(음악 모드)으로 동작하며, 우측 ▾에서 클래식(광대역) · 음악(기본) · 표준(영상/방송) · 야간(강한 균일) 4종 프리셋을 고릅니다.",
        "옵션 읽는 법: '-16 LUFS · 9s'는 목표 기준 음량(-16)과 평균을 재는 시간 창(9초)을 뜻하며, '대표 [-32..-10] · 0회귀'는 이 구간 안의 소리만 평균에 반영하고 여린 독주나 폭발음에서는 원음(0.0dB)으로 물러난다는 뜻입니다(채널 하단 '균일 +2.4dB'는 현재 자동 보정량).",
        "우측 고정 [마스터 버스]와 각 채널의 2열(L/R) [레벨 미터]로 스테레오 출력 밸런스를 보며 전체 볼륨·정지·음소거를 한 번에 제어합니다.",
      ],
    },
    {
      title: "안전 및 유의사항 (청력 · 중요 알림 · 호환 · 면책)",
      bullets: [
        "청력·스피커 보호: +0dB 초과 증폭(채널·마스터·노멀라이저 중첩)이나 Solo 해제 시 소리가 크게 커질 수 있으니 이어폰 착용 시 낮은 볼륨에서 서서히 올리세요.",
        "통화·경보 주의: 전체 음소거, Solo·Focus 감쇠, 노이즈 게이트는 다른 탭의 화상회의·호출·일정 알림·비상 경보음까지 함께 줄이거나 차단합니다.",
        "시험·보안·웹 DAW: 브라우저 오디오 API에 연결되므로 변조 검사에 민감한 온라인 시험·금융 보안 페이지나 웹 작곡 도구에서는 확장을 잠시 끄거나 시크릿 창을 이용하세요.",
        "계측·프라이버시·면책: LUFS·미터는 실시간 청취 보정용 근사치(공인 계측기 아님, 0dB 보안 탭은 설정 볼륨 표시)이며 모든 창의 미디어 탭 제목이 함께 보이므로 화면 공유 시 유의하세요. 본 확장(GPL-3.0-or-later)은 보증 없이 '있는 그대로(AS IS)' 무상 제공되며 사용상 손해에 대해 법령 범위 내에서 책임을 지지 않습니다.",
      ],
    },
  ],
  advSteps: [
    {
      title: "대표 음압 구간(3-A) · 0.0dB 회귀 텐션과 4종 프리셋",
      bullets: [
        "노멀라이저는 원본 입력 음압 중 '평균 음압을 대표하기에 마땅한 구간(예: -32 ~ -10 LUFS)' 안에 들어온 소리만 적분하며, 구간 밖의 여린 독주(ppp)나 강주 폭발(fff)은 제외하고 0.0dB 회귀 텐션으로 서서히 원음 볼륨(0.0dB)으로 복귀합니다.",
        "클래식처럼 곡 전체에 걸쳐 다이나믹 레인지가 넓은 음악은 [균일 N ▾]에서 '클래식(광대역)' 프리셋을 고르면 급격한 도약 스침을 배제하고 원음 강약 대비를 보존합니다.",
        "상단 [균일 N ▾] 팝오버 하단에서도 현재 탭의 실시간 입력 음압과 대표 채택 구간을 미니 바로 즉시 확인할 수 있습니다.",
      ],
    },
    {
      title: "대표 구간 확장·축소 뷰 & 채널별 2계층 제어",
      bullets: [
        "상단 고급 FX ▸를 열면 노멀라이저 카드 우측 상단 확장·축소 아이콘 버튼으로 대표 구간 표시기를 펼쳐 실시간 주파수 스펙트럼 위 상·하(↕) 임계선으로 조절하거나, 접어서 수평 막대 좌·우(↔) 브래킷으로 간결하게 조절할 수 있습니다.",
        "전역 따름 · 개별 ON · 개별 OFF 2계층으로 분리되어 전역 스위치를 꺼도 개별 설정은 보존되며, 개별 모드에서 대표 구간(하한·상한), 0dB 회귀 텐션 속도(dB/s), 목표 LUFS를 직접 튜닝합니다.",
      ],
    },
    {
      title: "스테레오 패닝(Pan) & 노이즈 게이트",
      bullets: [
        "패닝 (L100 ~ C ~ R100): 각 탭의 소리를 좌우 공간에 배치해 여러 방송·음악을 동시에 들을 때 명료도를 높입니다(더블클릭 또는 C 버튼으로 중앙 복귀).",
        "노이즈 게이트 (-65 ~ -30 dB): 대사 사이 무음 구간의 마이크 화이트노이즈·바닥 잡음을 차단합니다.",
      ],
    },
    {
      title: "다이내믹 컴프레서 & 교차 출처 보안 0dB 상한",
      bullets: [
        "컴프레서 (약 2:1 · 중 4:1 · 강 8:1): 갑작스럽게 튀는 비명이나 폭발음 피크를 매끄럽게 눌러 귀를 보호합니다.",
        "보안 0dB 상한: 교차 출처(CORS)·DRM 보호 미디어는 저작권 보호 정책을 존중해 기본 볼륨 제어(0dB 이하 감쇠)로 자동 전환되며 [페이더] 상단에 빗금이 표시되고 미터는 설정 볼륨 기준으로 표시됩니다.",
      ],
    },
  ],
  terms: {
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
      description: "페이더·눈금 오른쪽의 20단 실시간 피크 미터입니다. 현재 채널의 출력 음량 크기와 과증폭(+0dB 초과 경고) 여부를 녹색·주황·적색 막대로 보여줍니다.",
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
  },
  tourDialogAria: "Fadedesk 콘솔 실화면 투어",
  tourDemoPill: "예시 채널 표시 중",
  tourSkipLabel: "투어 건너뛰기",
  tourPrevLabel: "이전",
  tourNextLabel: "다음",
  tourDoneLabel: "완료",
  demoTrackTitle: "예시 · 어쿠스틱 세션 트랙",
  demoStreamTitle: "예시 · 라이브 토크 방송 (대기)",
  tourSteps: [
    {
      step: 1,
      title: "상단 테마 · 도움말(?) · 독립 창 분리(↗)",
      desc: "좌측 색상 점(●)에서 테마·모드를 바꾸고, 창 분리(↗) 버튼으로 콘솔을 별도 창으로 떼어내 항상 띄워 둘 수 있습니다.",
    },
    {
      step: 2,
      title: "채널 헤더 클릭 → 해당 탭 바로 이동(↗)",
      desc: "파비콘·사이트명·↗ 영역을 클릭(또는 Enter)하면 여러 창의 수많은 탭 중에서 소리가 나는 해당 탭으로 즉시 이동합니다.",
    },
    {
      step: 3,
      title: "페이더 노브 드래그 & dB 직접 입력",
      desc: "사각 노브를 끌어 -60dB~+12dB까지 조절하고, 아래 숫자창을 클릭해 원하는 데시벨을 직접 타이핑할 수 있습니다.",
    },
    {
      step: 4,
      title: "재생 전환 · 도메인 핀(📌) · 드래그 정렬(⠿)",
      desc: "재생 옆 압정(📌)을 켜면 사이트 기본 볼륨으로 기억되며, 맨 위 6점 핸들(⠿)을 우측 대기 구역에 놓으면 즉시 일시정지됩니다.",
    },
    {
      step: 5,
      title: "집중 청취(M · S · F)와 상단 Focus α",
      desc: "F(Focus)를 켜면 이 탭만 또렷하게 두고 다른 탭들은 상단 Focus α 비율만큼 줄입니다. 우측 데시벨 수치도 직접 입력할 수 있습니다.",
    },
    {
      step: 6,
      title: "이지 노멀라이저(균일 N ▾) 3종 프리셋",
      desc: "본체는 자동 음압 정렬 ON/OFF이며, 우측 ▾에서 표준 EBU 계측 창 기반의 음악(9s) · 표준(3s) · 야간(0.4s) 프리셋을 고릅니다.",
    },
    {
      step: 7,
      title: "마스터 버스와 고급 FX 사이드 랙",
      desc: "우측 마스터 버스에서 전체 볼륨·일괄 정지·음소거를 제어하고, 상단 '고급 FX ▸'로 채널별 LUFS·패닝·게이트·컴프레서를 세밀하게 다룹니다.",
    },
  ],
};

const EN_HELP: HelpLocaleBundle = {
  dialogAria: "Fadedesk Console Guide & Safety Notices",
  closeAria: "Close guide",
  tabTour: "Quick Tour",
  tabEasy: "Console Guide",
  tabAdv: "Normalizer & FX",
  introBadge: "GUIDED TOUR",
  introTitle: "Explore every mixer control right on the live console",
  introItems: [
    {
      lead: "Tab Jump & Popout Window",
      body: "Click any channel header (↗) to jump straight to that media tab, or detach Fadedesk into a standalone resizable window.",
    },
    {
      lead: "Precision dB Faders & Focus Ducking",
      body: "Control each tab from -60 to +12 dB, type exact dB values, or enable Focus (F) to gently duck background tabs.",
    },
    {
      lead: "Music · Standard · Night Loudness Presets",
      body: "One-click BS.1770 loudness presets keep dynamics intact for music or tame sudden peaks late at night.",
    },
  ],
  introNote:
    "If no media tabs are open yet, 2 neutral demo strips appear temporarily during the tour and disappear as soon as you finish or skip.",
  tourStartBtn: "Start Live Tour ▸",
  tourSkipBtn: "Skip & Use Console",
  introSub: "Reopen anytime via the top ? button (includes Safety & Notices) · Press Esc to close",
  easyHint: "Hover underlined part chips to preview their location, or click to pin the diagram.",
  advHint: "Hover underlined part chips to inspect where each control lives on the console.",
  safetyHint: "Please review these hearing, alert, compatibility, and warranty notes before boosting audio.",
  pinnedTip: "✓ Pinned · click chip again or click outside to close",
  unpinnedTip: "💡 Click chip to pin this diagram",
  stepAria: (idx) => `Step ${idx + 1}`,
  prevBtn: "Prev",
  nextBtn: "Next",
  easySteps: [
    {
      title: "Tab Jump · Popout Window · Color Themes",
      bullets: [
        "Click the [Tab Header] (favicon · domain · ↗) or press Enter on a selected strip to jump straight to the browser tab and window playing that audio.",
        "Use [Popout] (↗) on the top deck to detach a standalone mixer window (auto-clamped above 520×420), and click the left color dot (●) for 4 studio themes in Dark or Light mode.",
        "Global shortcuts (Alt+Shift+M open, Alt+Shift+0 Master Mute, Alt+Shift+F cycle Focus · Ctrl+Shift on macOS) plus Arrow keys, 0, and M/S/F/P keys are built in.",
      ],
    },
    {
      title: "Per-Tab dB Boost · Knob Drag · Direct dB Input",
      bullets: [
        "To prevent accidental volume jumps, drag the rectangular [Knob] cap on the [Fader]—or use the mouse wheel (Shift+wheel for fine steps) and double-click to reset to 0.0 dB.",
        "Push above unity (0 dB) up to +12 dB (~4× linear amplitude) while monitoring real-time output on the 20-segment [Level Meter].",
        "Click the digital [Readout] box below any fader to type an exact decibel value (such as -8.5) and press Enter.",
      ],
    },
    {
      title: "Focus & Solo (M·S·F) · Drag Zones · Domain Pin",
      bullets: [
        "In the bottom [Switch Bank], enable F (Focus) to keep the chosen tab at full volume while ducking other tabs by the top Focus α amount (click the α readout to type dB; S for Solo; Shift+Click for multi-select).",
        "Drag the top [Grip Handle] (⠿) to reorder strips—or drop across the divider into the right idle zone to pause immediately (and left to resume).",
        "Toggle [Domain Pin] next to Play so newly opened tabs on that website automatically start at your saved dB level.",
      ],
    },
    {
      title: "Reading Auto Loudness (Level N ▾) Options & Master Bus",
      bullets: [
        "[Level N ▾] is enabled by default (Music mode); open ▾ to switch among Classical (Wide), Music (Default), Standard (Video), and Night (Even) presets.",
        "How to read options: '-16 LUFS · 9s' shows target loudness (-16) and averaging window (9s); 'Band [-32..-10] · Return' means only sounds inside that band update the average while soft solos or loud tuttis gently return toward 0.0 dB.",
        "Monitor stereo L/R [Level Meter] bars on each strip and use [Master Bus] for Master Gain, Pause All, and Mute All.",
      ],
    },
    {
      title: "Safety & Notices (Hearing · Alerts · Compatibility · Warranty)",
      bullets: [
        "Hearing & Speaker Safety: Boosting above 0 dB (especially stacking channel, master, and normalizer gain) or clearing Solo can raise loudness sharply. Start at a low volume when wearing headphones.",
        "Calls & Critical Alerts: Mute All, Solo, Focus ducking, and Noise Gate also attenuate or silence web calls, meetings, calendar/trading alarms, and emergency alerts in other tabs.",
        "Exams, Security & Web DAWs: Fadedesk hooks browser audio APIs across pages; pause the extension or use Incognito during proctored online exams, strict banking security checks, or Web DAW production.",
        "Metering, Privacy & No Warranty: LUFS and VU readouts are real-time listening estimates, not certified compliance meters (0 dB-capped tabs show configured level). All windows' media tab titles appear together—check before screen sharing. Provided free \"AS IS\" without warranty under GPL-3.0-or-later; the author is not liable for damages to the extent permitted by law.",
      ],
    },
  ],
  advSteps: [
    {
      title: "Representative Band (3-A) · 0.0 dB Return Tension & Presets",
      bullets: [
        "The normalizer integrates only sounds within the Representative Band (e.g. -32 to -10 LUFS). Quiet solos (ppp) and loud tuttis (fff) outside the band are excluded while gain gently returns toward 0.0 dB.",
        "For wide-dynamic-range classical repertoire, choose the 'Classical (Wide)' preset in [Level N ▾] to ignore transient crossings and preserve natural dynamics.",
        "A live mini bar at the bottom of the [Level N ▾] popover previews current input loudness and the active target band.",
      ],
    },
    {
      title: "Expand / Collapse Band View & 2-Tier Channel Control",
      bullets: [
        "In FX Rack ▸, click the expand/collapse icon button in the Normalizer card to expand the real-time frequency spectrum (drag top/bottom ↕ lines) or collapse into a compact horizontal bar (drag left/right ↔ brackets).",
        "Set any strip to Follow, On, or Off without losing custom values; drag the representative band bounds, 0 dB return tension speed, and target LUFS directly.",
      ],
    },
    {
      title: "Stereo Pan & Noise Gate",
      bullets: [
        "Stereo Pan (L100 – C – R100): Place concurrent streams or music left and right for clear spatial separation (double-click or press C to center).",
        "Noise Gate (-65 to -30 dB): Attenuates microphone hiss and room noise between spoken phrases.",
      ],
    },
    {
      title: "Dynamic Compressor & 0 dB Security Cap",
      bullets: [
        "Compressor (Low 2:1 · Med 4:1 · High 8:1): Smoothly tames sudden shouts or sound-effect peaks before the -1.0 dBFS safety limiter.",
        "0 dB Security Cap: Cross-origin (CORS) and DRM-protected streams respect browser security and fall back to standard volume control (0 dB max, hatched top zone on [Fader], steady level meter).",
      ],
    },
  ],
  terms: {
    tabJump: {
      name: "Tab Header (Tab Jump)",
      subtitle: "Favicon · Domain · ↗ Jump Button",
      description: "Top strip button showing favicon, host, and ↗. Click it (or press Enter while selected) to focus the exact browser tab and window playing that media.",
    },
    popout: {
      name: "Popout Window",
      subtitle: "Top-deck detach (↗) button next to ?",
      description: "Detaches Fadedesk into an always-available standalone mixer window with remembered dimensions (clamped to at least 520×420).",
    },
    normSplit: {
      name: "Level N ▾ (Normalizer Split)",
      subtitle: "Top-deck global loudness split button",
      description: "Click the main button to toggle automatic loudness leveling on/off, or click ▾ to pick Music (9s), Standard (3s), or Night (0.4s).",
    },
    fader: {
      name: "Fader",
      subtitle: "Vertical logarithmic dB slot & scale",
      description: "Central dB slot and tick scale. Scroll the mouse wheel (Shift+wheel for fine 0.5 dB steps) or double-click to reset to 0.0 dB.",
    },
    knob: {
      name: "Knob (Fader Cap)",
      subtitle: "Rectangular drag handle on fader & Focus α",
      description: "Grab and drag the cap directly to sweep -60 dB to +12 dB without accidental track-click jumps. Double-click to return to 0.0 dB.",
    },
    meter: {
      name: "Level Meter",
      subtitle: "20-segment real-time peak LED bar",
      description: "Shows real-time post-fader level and peak hold in green, amber (>0 dB boost), and red (+7.5 dB hot zone).",
    },
    readout: {
      name: "Readout",
      subtitle: "Full-width digital dB display & editor",
      description: "Click the digital dB readout below any fader to type an exact decibel number (e.g. -8.5) and press Enter to apply.",
    },
    grip: {
      name: "Grip Handle",
      subtitle: "Top 6-dot (⠿) drag bar",
      description: "Drag left or right to reorder strips, or drop across the vertical divider to switch between Playing and Paused zones.",
    },
    pin: {
      name: "Domain Pin",
      subtitle: "Pushpin switch next to Play",
      description: "Saves the strip's current dB level locally for this domain so future tabs from the same site start at that volume.",
    },
    switchBank: {
      name: "Switch Bank",
      subtitle: "Bottom M · S · F 3-button bank",
      description: "M (Mute), S (Solo exclusive listen), and F (Focus ducking of other tabs; Shift+Click for multi-channel Focus or Solo).",
    },
    masterBus: {
      name: "Master Bus",
      subtitle: "Docked right-hand master output strip",
      description: "Combines dual L/R stereo meters, Master Gain fader, Pause All / Play All, and Master Mute.",
    },
  },
  tourDialogAria: "Fadedesk Live Console Tour",
  tourDemoPill: "Demo Strips",
  tourSkipLabel: "Skip Tour",
  tourPrevLabel: "Prev",
  tourNextLabel: "Next",
  tourDoneLabel: "Done",
  demoTrackTitle: "Demo · Acoustic Session Track",
  demoStreamTitle: "Demo · Live Talk Stream (Paused)",
  tourSteps: [
    {
      step: 1,
      title: "Theme · Guide (?) · Popout Window (↗)",
      desc: "Switch 4 color themes from the left dot (●), check guides & safety notes via ?, or detach Fadedesk into its own window (↗).",
    },
    {
      step: 2,
      title: "Click Strip Header → Jump to Tab (↗)",
      desc: "Click the favicon/domain header (or press Enter) to jump straight to the noisy tab across any browser window.",
    },
    {
      step: 3,
      title: "Drag Fader Knob & Type Exact dB",
      desc: "Drag the fader cap from -60 dB to +12 dB, or click the digital readout box below to type an exact decibel level.",
    },
    {
      step: 4,
      title: "Play/Pause · Domain Pin · Drag Zone (⠿)",
      desc: "Pin a site's default volume next to Play, or drag the top 6-dot grip across the divider to pause or resume instantly.",
    },
    {
      step: 5,
      title: "Focus / Solo (M · S · F) & Top Focus α",
      desc: "Turn on F (Focus) to keep this tab clear while ducking background tabs by Focus α (click the α dB readout to type directly).",
    },
    {
      step: 6,
      title: "Auto Loudness (Level N ▾) Presets",
      desc: "Toggle global loudness leveling in one click, or open ▾ for Music (9s), Standard (3s), and Night (0.4s) EBU presets.",
    },
    {
      step: 7,
      title: "Master Bus & Per-Channel FX Rack",
      desc: "Control Master Gain, Pause All, and Mute All on the right, or open FX Rack ▸ for per-tab LUFS, Stereo Pan, Gate, and Compressor.",
    },
  ],
};

export function helpCopy(locale: UiLocale = getUiLocale()): HelpLocaleBundle {
  return locale === "en" ? EN_HELP : KO_HELP;
}
