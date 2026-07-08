# 기업 리서치 & 사회공헌 제안 자동화 툴 (초록우산)

산업군 키워드를 입력하면 관련 **법인기업**을 자동으로 검색·수집하고, 후원 제안에
필요한 핵심 정보를 표로 정리한 뒤, 각 기업 맞춤형 사회공헌 제안 문장과 메일 전문까지
생성하는 데스크톱 앱입니다. **Electron + React + TypeScript + Tailwind CSS +
Anthropic API** 기반이며, 추후 웹 서비스로 포팅할 수 있도록 설계되어 있습니다.

## 처리 파이프라인

1. **검색·수집** — 산업군 키워드로 관련 법인기업을 웹에서 검색 (Claude web_search)
2. **법인 필터** — 사업자등록번호 4번째 자리가 `8`인 법인만 유지 (엄격)
3. **중복 제거** — 기존 후원처 파일(xlsx/csv) 업로드 시에만, 사업자번호→기업명 순 매칭 제거
4. **정보 수집** — 남은 기업의 홈페이지·주소·전화·이메일 보강
5. **제안 문장 생성** — 최종 남은 기업만 대상으로 초록우산과의 공감대 문단 생성
6. **내보내기** — 엑셀(.xlsx)/CSV + 메일 전문 컬럼

무거운 작업(제안 문장 생성)을 마지막에 배치해 걸러진 기업에 대한 API 낭비를 막습니다.

## 아키텍처 (웹 포팅 대비)

- **Renderer** (`src/renderer`): 순수 React UI. 네이티브 기능은 **플랫폼 어댑터**
  한 곳(`src/renderer/src/platform/index.ts`)으로만 접근 — 컴포넌트는 `window.api`를
  직접 호출하지 않습니다. 이 어댑터가 Electron이면 IPC를, 웹이면 백엔드 호출을 씁니다.
- **Main** (`src/main`): 크롤링·파일 IO·Anthropic 호출 등 모든 로직. 각 로직은
  `src/main/services/types.ts`의 **인터페이스로 추상화**되어 있어, 웹 포팅 시 같은
  인터페이스의 서버 구현으로 교체하면 됩니다.
- **Shared** (`src/shared`): 메인·렌더러 공용 순수 TS (타입, 사업자번호 판별, 메일 템플릿).

```
src/
  shared/            타입·사업자번호 유틸·메일 템플릿 (의존성 없는 순수 TS)
  main/
    services/        서비스 인터페이스 + Anthropic/Node 구현 (웹 포팅 추상화)
    pipeline.ts      6단계 오케스트레이션 + 진행상황 emit
    ipcHandlers.ts   모든 IPC 핸들러 등록
  preload/index.ts   contextBridge로 안전한 window.api 노출
  renderer/src/
    platform/        ★ Electron/Web 분기 어댑터 — 웹 포팅의 핵심
    lib/, components/ React 훅·컴포넌트
```

## 사용법

1. `npm install` 후 `npm run dev`로 실행합니다.
2. 우측 상단 **⚙ 설정**에서 Anthropic API 키를 입력합니다.
   키는 OS 보안 저장소(Electron `safeStorage`)에 암호화되어 저장됩니다.
3. 산업군 키워드(예: "건강기능식품")를 입력하고 검색을 시작합니다.
4. (선택) 기존 후원처 파일을 올리면 중복을 자동 제외합니다.
5. 표에서 행을 클릭하면 사이드 패널에서 상세 정보·제안 문단·메일 전문을 확인/복사할 수 있습니다.
6. 상단 **내보내기**로 xlsx/CSV를 저장합니다.

## 명령어

```bash
npm install

npm run dev          # Electron 창 + HMR (데스크톱)
npm run build        # 데스크톱 번들 (out/)
npm run package      # 설치 파일 생성 (release/) — electron-builder

npm run build:web    # 웹 산출물 빌드 (dist-web/) — 렌더러가 순수 웹으로 빌드되는지 확인
npm run preview:web  # 브라우저에서 웹 버전 미리보기

npm run typecheck    # 타입 검사 (node + web)
```

## 참고

- 한국 기업정보 공개 API는 제한적이라, 기업 발굴·정보 수집은 Claude의 `web_search`
  서버 도구를 사용합니다. 유료 DB의 무단 크롤링은 하지 않습니다.
- 등록 업종과 실제 사업이 다를 수 있어, 홈페이지 기준으로 실제 사업 내용을 재확인합니다.
- 코드 서명·자동 업데이트(electron-updater)는 추후 단계입니다.
