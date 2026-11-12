# 오픈소스 라이선스 고지 및 외부 코드 반입 기준 (`THIRD_PARTY_NOTICES.md`)

이 문서는 **Fadedesk** (`GPL-3.0-or-later`, Copyright (C) 2026 Jinhoon Choi, 공개 저장소 <https://github.com/Argoneon1810/Fadedesk>)의 배포 산출물(`dist/unpacked/`, `dist/fadedesk-*.zip`)과 개발·빌드 환경(`package-lock.json`)에 관련된 오픈소스 라이선스 현황을 밝히고, 라이선스 충돌을 막기 위한 외부 코드·자산 반입 기준을 정의합니다.

---

## 1. 배포 확장 패키지(`dist/`) 내 제3자 오픈소스 포함 여부

**포함된 제3자 오픈소스 코드·글꼴·아이콘·음원 자산: 0건**

- 런타임 소스(`src/**/*.ts`, `static/*.html`, `static/*.css`, `static/_locales/*/messages.json`)는 외부 npm 패키지(`dependencies`)를 단 하나도 임포트하지 않으며 100% 자체 작성 코드로만 번들됩니다.
- 확장 아이콘(`static/icons/icon16.png` ~ `icon128.png`)과 팝업 내부 그래픽(`src/popup/icons.ts`, `src/popup/help-schematic.ts`, `src/popup/help-modal.ts`)은 모두 자체 제작한 순수 파이썬 스크립트(`scripts/generate-icons.py`) 및 인라인 SVG입니다.
- 글꼴은 외부 웹폰트를 포함하거나 내려받지 않고 운영체제 기본 글꼴(`Segoe UI`, `-apple-system`, `Malgun Gothic`, `Consolas` 등)만 참조합니다.
- 따라서 Chrome 웹 스토어에 업로드하는 ZIP 패키지 내부나 확장 UI 화면에 법적으로 의무 표기해야 하는 제3자 라이브러리 저작권 고지문은 없습니다. 프로젝트 자체는 루트의 `LICENSE`(`GPL-3.0-or-later`)에 따라 배포됩니다.

---

## 2. 개발·빌드·검증 도구 체인(`devDependencies`) 라이선스 명세

아래 패키지들은 개발 시점의 타입 검사(`tsc`), 번들 생성(`esbuild`), 단위 테스트 실행(`tsx`)에만 쓰이며 **배포용 확장 바이너리(`dist/`)에는 포함되지 않습니다.** 저장소 전체를 공개할 때의 투명성을 위해 전수(직접 5종 + 전이 57종 = 총 62종) 라이선스를 함께 기록합니다.

| 구분 | 패키지 및 버전 (`package-lock.json` 기준) | 라이선스 | 배포 번들 포함 여부 |
| --- | --- | --- | --- |
| 번들러 | `esbuild@0.24.2` 및 플랫폼별 `@esbuild/*@0.24.2` 26종 | `MIT` | 미포함 (빌드 전용) |
| 컴파일러·타입 검사 | `typescript@5.9.3` | `Apache-2.0` | 미포함 (타입 검사 전용) |
| 테스트 실행기 | `tsx@4.23.15`, `tsx/esbuild@0.28.2`, `tsx/@esbuild/*@0.28.2` 25종 | `MIT` | 미포함 (테스트 전용) |
| 타입 정의·기타 | `@types/chrome@0.0.287`, `@types/node@22.20.5`, `@types/filesystem@0.0.36`, `@types/filewriter@0.0.33`, `@types/har-format@1.2.16`, `undici-types@6.21.0`, `fsevents@2.3.3` | `MIT` | 미포함 (타입·개발 전용) |

### 개발 도구 라이선스 고지 요약

- **esbuild** — Copyright (c) 2020 Evan Wallace, Licensed under the MIT License.
- **TypeScript** — Copyright (c) Microsoft Corporation, Licensed under the Apache License, Version 2.0 (<http://www.apache.org/licenses/LICENSE-2.0>).
- **tsx** — Copyright (c) Hiroki Osame, Licensed under the MIT License.
- **DefinitelyTyped (`@types/*`) & undici-types & fsevents** — Copyright (c) respective contributors, Licensed under the MIT License.

---

## 3. 라이선스 문제로 임포트(반입)할 수 없거나 제한되는 외부 대상

사전 대체재 조사(`docs/research/replacement/02_candidates_report.md`) 및 인접 프로젝트 검토에서 확인된 외부 코드·자산의 반입 가능 여부는 아래와 같습니다. **현재 Fadedesk에는 아래 어느 저장소의 코드도 반입되어 있지 않습니다.**

### 3.1 반입 절대 금지 (전권 유보 / 라이선스 미부여)

저작권법상 오픈소스 라이선스가 명시되지 않은 공개 저장소는 기본값이 **전권 유보(All Rights Reserved)** 이므로, 코드 일부라도 복사·번역·변형해 넣으면 저작권 침해가 됩니다.

| 대상 | 확인된 라이선스 상태 | 판정 및 사유 |
| --- | --- | --- |
| `ungive/media-control-extension` | `All rights reserved` 명시 | **반입 금지.** 복제·수정·재배포가 모두 금지됨. |
| `chinhfey-wayne/modulate-tab-volume-mixer` | 소스 비공개 / 라이선스 없음 | **반입 금지.** 배포된 확장 패키지 역공학·코드 발췌 불가. |
| `polywock/globalSpeed` | 조사 시점 라이선스 미확인(미명시 시 전권 유보, GPL일 경우 전염) | **반입 금지.** 라이선스 원문 확인 및 호환성 검증 없이 코드 차용 불가. |

### 3.2 조건부 제한 — 강한 카피레프트 (`GPL-3.0`)

| 대상 | 확인된 라이선스 상태 | 판정 및 사유 |
| --- | --- | --- |
| `ZepengW/GMC-Enhance` | `GPL-3.0` | 현재 반입 코드 **0줄**. Fadedesk가 `GPL-3.0-or-later`로 공개 배포되므로 라이선스상으로는 호환되나, 원저작자 저작권 표기·변경 이력 고지 의무(GPLv3 제4조·제5조)가 발생하므로 무단 복제는 금지됨. |
| 자매 프로젝트 `Argoneon1810/Tiltfill` (`zoom_to_fill`) | `GPL-3.0-or-later` | **단독 저작권자 동일 라이선스.** 두 프로젝트 모두 `Jinhoon Choi` 단독 저작물이며 동일하게 `GPL-3.0-or-later`를 따름. 단, 향후 외부인의 PR을 병합한 뒤에는 외부인 기여분의 저작권 표기를 보존해야 함. |

### 3.3 고지 의무부 허용 (`MIT` / `ISC`)

| 대상 | 확인된 라이선스 상태 | 판정 및 사유 |
| --- | --- | --- |
| `TueJon/tj-volume-mixer` | `MIT` | 현재 반입 코드 **0줄**. 만약 향후 일부 코드를 가져오면 배포 패키지 안에 해당 저작권 표시와 MIT 허가 고지문을 함께 넣어야 함. |
| `Chaython/volumecontrol` | `ISC` | 현재 반입 코드 **0줄**. 향후 차용 시 ISC 저작권·허가 고지문 보존 필요. |

### 3.4 스토어 스크린샷·홍보 이미지 제작 시 반입 금지 자산

오디오 확장이라도 스토어 등록용 스크린샷(1280×800)과 프로모션 타일(440×280)에 찍히는 시각 요소에 저작권·상표권이 걸립니다.

1. **상용 스트리밍 사이트의 음원 제목·앨범 커버 파비콘·아티스트 사진·서비스 로고**: 음반사·스트리밍 플랫폼의 저작권 및 상표권 대상이므로 스크린샷 채널 스트립이나 배경 탭에 노출하지 않습니다.
2. **Blender Open Movies 중 `CC BY-ND`(변경 금지) 작품**: *Cosmos Laundromat: First Cycle*, *Agent 327: Operation Barbershop* 등은 화면 크롭·변형·UI 합성 배포가 금지된 `CC BY-ND`이므로 사용하지 않습니다(사용 가능 작품은 `CC BY 4.0`인 *Charge*, *Spring*, *Tears of Steel* 등이며 출처 표기 필수, Blender 로고 노출 금지).
3. **정부·기관 로고 및 휘장**: NASA 영상·오디오 자체는 미국 퍼블릭 도메인이나 NASA 로고(Meatball/Worm 휘장)는 법령으로 사용이 금지되어 있으므로 화면에 포함하지 않습니다.
