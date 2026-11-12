# Sound Manager 🎛️

> `chrome.tabCapture` 권한 없이 모든 창과 탭의 미디어를 한곳에서 제어하는 Chrome Manifest V3 스튜디오 오디오 콘솔 확장 프로그램입니다.

---

## 1. 사전 요구 사항

- **Node.js**: `v18.0.0` 이상 (v20+ 권장)
- **외부 종속성**: 별도의 Python이나 시스템 빌드 도구 없이 **순수 Node 환경**에서 즉시 빌드됩니다.

---

## 2. 빠른 시작 (설치 및 빌드)

```bash
# 1. 저장소 클론 (최신 main 브랜치)
git clone -b main https://github.com/Argoneon1810/sound_manager.git
cd sound_manager

# 2. 의존성 패키지 설치
npm install

# 3. 확장 프로그램 빌드
npm run build
```

빌드가 성공하면 아래 두 산출물이 생성됩니다:
- `dist/unpacked/`: Chrome에서 직접 로드할 수 있는 압축 해제 런타임 폴더
- `dist/sound-manager-<version>.zip`: 배포/웹스토어 업로드용 압축 아카이브

---

## 3. Chrome 브라우저에 설치 및 로드 방법

> [!IMPORTANT]
> Chrome 확장 프로그램 관리자에는 저장소 루트가 아닌 **`dist/unpacked`** 폴더를 로드해야 합니다.

1. Chrome 주소창에 `chrome://extensions`를 입력하여 이동합니다.
2. 우측 상단의 **개발자 모드 (Developer mode)** 토글을 켭니다.
3. 좌측 상단의 **압축해제된 확장 프로그램을 로드합니다 (Load unpacked)** 버튼을 클릭합니다.
4. 파일 선택 창에서 프로젝트 루트 안의 **`dist/unpacked`** 폴더를 선택합니다.
5. 브라우저 툴바의 퍼즐 아이콘에서 **Sound Manager**를 고정(Pin)하여 실행합니다.
6. 코드를 수정하거나 빌드를 다시 한 경우, `chrome://extensions`의 Sound Manager 카드 우하단 **새로고침(`↻`)** 아이콘을 누릅니다.

---

## 4. 개발 및 테스트 명령어

```bash
# 전체 검증 스위트 실행 (타입 검사 + 단위 테스트 + 빌드 + UI 헤드리스 감사)
npm test

# 세부 스크립트 단독 실행
npm run typecheck    # TypeScript 정적 타입 검사 (tsc --noEmit)
npm run test:unit     # Node 내장 테스트 러너 기반 단위 테스트 (14개 시나리오)
npm run build         # esbuild 번들링 및 dist/ 생성
npm run test:ui       # 헤드리스 Chrome 기반 레이아웃/인터랙션 감사 (9개 시나리오)
```

---

## 5. 프로젝트 핵심 기능

- **독립 탭 볼륨 제어**: `-60 dB` ~ `+12 dB`(약 4배 증폭) 로그 스케일 게인 및 수치 직접 타이핑.
- **Focus Mode & Solo**: 특정 탭만 또렷하게 남기고 배경 탭을 감쇠시키는 일반화 Focus($\alpha$).
- **2계층 다이내믹 노멀라이저**: 탭·영상 간 음압 편차를 자동 균일화(`-16 LUFS` 타깃).
- **고급 FX 사이드 랙**: 스테레오 패닝, 노이즈 게이트, 다이내믹 컴프레서 세부 조작.
- **도메인 기본 볼륨 핀**: 사이트별 선호 음량을 기억하여 새 탭에 자동 적용.
- **단계별 도움말 모달 & 실물 조작부 SVG 카드**: 콘솔 사용법 및 8종 부품 인터랙티브 가이드.
