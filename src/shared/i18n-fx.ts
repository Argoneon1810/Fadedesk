import { getUiLocale } from "./i18n";

/**
 * 1.2.0 고급 FX(범위 탭 · 요약 카드 · 세부 창 · 내 프리셋 · 채널 FX 칩) 한·영 문구.
 * 랙 폭 214px, 세부 창 폭 250px 안에서 줄바꿈 없이 읽히도록 두 언어의 길이를 함께 맞춘다.
 */

export interface FxUiDictionary {
  scopeAll: string;
  scopeThis: (host: string) => string;
  globalTitle: string;
  globalSub: (n: number) => string;
  channelSub: (host: string) => string;
  modTitle: { norm: string; gate: string; comp: string; pan: string; balance: string };
  detailOpen: string;
  detailClose: string;
  detailTitle: (title: string) => string;
  detailCloseAria: string;
  stateFollow: string;
  stateOwn: string;
  btnDetach: string;
  btnRelink: string;
  globalApplies: string;
  globalExcept: (n: number) => string;
  lockedHint: string;
  detailSubGlobal: string;
  detailSubOwn: (host: string) => string;
  detailSubLocked: (host: string) => string;
  detailSubPan: (host: string) => string;
  off: string;
  gateSummary: (db: number) => string;
  compSummary: (ratio: number) => string;
  panFinal: (s: string) => string;
  balanceSummary: (s: string) => string;
  panFormula: (finalS: string, chS: string, globalS: string) => string;
  balanceNote: string;
  gateNote: string;
  presetCustom: string;
  presetModifiedSuffix: string;
  presetMine: string;
  presetAria: string;
  modifiedFrom: (name: string) => string;
  customValues: string;
  saveAsUser: string;
  overwrite: (name: string) => string;
  revert: string;
  save: string;
  defaultPresetName: string;
  presetNameAria: string;
  manageOpen: string;
  manageClose: string;
  rename: string;
  remove: string;
  ok: string;
  deleteNote: string;
  masterFxBtn: string;
  masterFxTitle: string;
  toastPresetSaved: (name: string) => string;
  toastPresetDeleted: (name: string) => string;
  chipFollow: (name: string) => string;
  chipOwn: (name: string) => string;
  chipOff: (name: string) => string;
  chipPan: (s: string) => string;
  popoverMine: string;
  popoverNote: string;
  liveFrom: (host: string) => string;
}

const KO_FX: FxUiDictionary = {
  scopeAll: "모든 채널",
  scopeThis: () => "이 채널",
  globalTitle: "모든 채널 기본 설정",
  globalSub: (n) => `여기서 바꾸면 채널 ${n}개에 걸립니다`,
  channelSub: (h) => `${h} · 이 채널에 걸린 효과`,
  modTitle: { norm: "노멀라이저", gate: "노이즈 게이트", comp: "컴프레서", pan: "패닝", balance: "전체 밸런스" },
  detailOpen: "세부 ▸",
  detailClose: "세부 ◂",
  detailTitle: (t) => `${t} 세부`,
  detailCloseAria: "세부 창 닫기",
  stateFollow: "🔗 모든 채널 따름",
  stateOwn: "● 이 채널만",
  btnDetach: "이 채널만 따로",
  btnRelink: "모든 채널 따르기",
  globalApplies: "모든 채널에 걸림",
  globalExcept: (n) => `따로 정한 채널 ${n}개 제외`,
  lockedHint: "모든 채널 값을 따르는 중입니다. 먼저 '이 채널만 따로'를 누르세요.",
  detailSubGlobal: "모든 채널 기본 설정",
  detailSubOwn: (h) => `${h} · 이 채널만`,
  detailSubLocked: (h) => `${h} · 모든 채널 따름 (잠김)`,
  detailSubPan: (h) => `${h} · 이 채널`,
  off: "꺼짐",
  gateSummary: (db) => `바닥 ${db} dB`,
  compSummary: (r) => `비율 ${r}:1`,
  panFinal: (s) => `최종 ${s}`,
  balanceSummary: (s) => `전체 ${s}`,
  panFormula: (f, c, g) => `최종 ${f} = 이 채널 ${c} + 전체 ${g}`,
  balanceNote: "모든 채널의 패닝에 더해집니다. 채널끼리의 좌우 배치는 그대로 두고 전체를 옮깁니다.",
  gateNote: "이보다 작은 소리(배경 잡음)를 막습니다.",
  presetCustom: "사용자 지정",
  presetModifiedSuffix: " (수정됨)",
  presetMine: "★ ",
  presetAria: "노멀라이저 프리셋",
  modifiedFrom: (n) => `"${n}"에서 바뀜`,
  customValues: "사용자 지정 값",
  saveAsUser: "내 프리셋으로 저장",
  overwrite: (n) => `"${n}" 덮어쓰기`,
  revert: "되돌리기",
  save: "저장",
  defaultPresetName: "내 프리셋",
  presetNameAria: "내 프리셋 이름",
  manageOpen: "내 프리셋 관리…",
  manageClose: "내 프리셋 관리 닫기",
  rename: "이름",
  remove: "지우기",
  ok: "확인",
  deleteNote: "지워도 이미 이 프리셋을 고른 채널의 값은 그대로 남습니다(사용자 지정).",
  masterFxBtn: "전체 FX",
  masterFxTitle: "모든 채널에 걸 고급 FX를 고칩니다",
  toastPresetSaved: (n) => `내 프리셋 "${n}" 저장`,
  toastPresetDeleted: (n) => `내 프리셋 "${n}" 지움`,
  chipFollow: (n) => `${n}: 모든 채널 설정을 따라 켜짐`,
  chipOwn: (n) => `${n}: 이 채널만 따로 켜짐`,
  chipOff: (n) => `${n}: 꺼짐`,
  chipPan: (s) => `최종 패닝 ${s}`,
  popoverMine: "내 프리셋",
  popoverNote: "여기서 고르면 '모든 채널 따름' 채널에 걸립니다. 채널마다 따로 고르려면 고급 FX에서 그 채널을 고르세요.",
  liveFrom: (h) => `실시간 음압: ${h}`,
};

const EN_FX: FxUiDictionary = {
  scopeAll: "All channels",
  scopeThis: () => "This tab",
  globalTitle: "All-channel defaults",
  globalSub: (n) => `Applies to ${n} channel${n === 1 ? "" : "s"}`,
  channelSub: (h) => `${h} · effects on this tab`,
  modTitle: { norm: "Normalizer", gate: "Noise Gate", comp: "Compressor", pan: "Pan", balance: "Global Balance" },
  detailOpen: "Details ▸",
  detailClose: "Details ◂",
  detailTitle: (t) => `${t} details`,
  detailCloseAria: "Close details",
  stateFollow: "🔗 Follows all",
  stateOwn: "● This tab only",
  btnDetach: "Set separately",
  btnRelink: "Follow all",
  globalApplies: "Applies to all",
  globalExcept: (n) => `${n} set separately`,
  lockedHint: "Following all-channel values. Press 'Set separately' first.",
  detailSubGlobal: "All-channel defaults",
  detailSubOwn: (h) => `${h} · this tab only`,
  detailSubLocked: (h) => `${h} · follows all (locked)`,
  detailSubPan: (h) => `${h} · this tab`,
  off: "Off",
  gateSummary: (db) => `Floor ${db} dB`,
  compSummary: (r) => `Ratio ${r}:1`,
  panFinal: (s) => `Final ${s}`,
  balanceSummary: (s) => `Global ${s}`,
  panFormula: (f, c, g) => `Final ${f} = tab ${c} + global ${g}`,
  balanceNote: "Added to every channel's pan. Keeps their left/right layout and shifts them all.",
  gateNote: "Blocks sounds quieter than this (background noise).",
  presetCustom: "Custom",
  presetModifiedSuffix: " (edited)",
  presetMine: "★ ",
  presetAria: "Normalizer preset",
  modifiedFrom: (n) => `Changed from "${n}"`,
  customValues: "Custom values",
  saveAsUser: "Save as my preset",
  overwrite: (n) => `Overwrite "${n}"`,
  revert: "Revert",
  save: "Save",
  defaultPresetName: "My preset",
  presetNameAria: "My preset name",
  manageOpen: "Manage my presets…",
  manageClose: "Close preset manager",
  rename: "Rename",
  remove: "Delete",
  ok: "OK",
  deleteNote: "Tabs that picked it keep their values (as Custom).",
  masterFxBtn: "All FX",
  masterFxTitle: "Edit the FX applied to all channels",
  toastPresetSaved: (n) => `Saved preset "${n}"`,
  toastPresetDeleted: (n) => `Deleted preset "${n}"`,
  chipFollow: (n) => `${n}: on, follows all channels`,
  chipOwn: (n) => `${n}: on, set for this tab only`,
  chipOff: (n) => `${n}: off`,
  chipPan: (s) => `Final pan ${s}`,
  popoverMine: "My presets",
  popoverNote: "Applies to tabs that follow all channels. To pick per tab, select that tab in FX Rack.",
  liveFrom: (h) => `Live level: ${h}`,
};

export function fxUi(): FxUiDictionary {
  return getUiLocale() === "en" ? EN_FX : KO_FX;
}
