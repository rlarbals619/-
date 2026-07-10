# 기업 리서치 & 사회공헌 제안 자동화 웹앱 (초록우산)

산업군 키워드를 입력하면 관련 **법인기업**을 자동으로 검색·수집하고, 후원 제안에
필요한 핵심 정보를 표로 정리한 뒤, 각 기업 맞춤형 사회공헌 제안 문장과 메일 전문까지
생성하는 **웹앱**입니다. **Next.js(App Router) + React + TypeScript + Tailwind CSS +
Anthropic API** 기반입니다.

## 처리 파이프라인

1. **검색·수집** — 산업군 키워드로 관련 법인기업을 웹에서 검색 (서버에서 Claude web_search)
2. **법인 필터** — 사업자등록번호 4번째 자리가 `8`인 법인만 유지 (엄격)
3. **중복 제거** — 기존 후원처 파일(xlsx/csv) 업로드 시에만, 사업자번호→기업명 순 매칭 제거
4. **정보 수집** — 남은 기업의 홈페이지·주소·전화·이메일 보강
5. **제안 문장 생성** — 최종 남은 기업만 대상으로 초록우산과의 공감대 문단 생성
6. **내보내기** — 엑셀(.xlsx)/CSV + 메일 전문 컬럼

무거운 작업(제안 문장 생성)을 마지막에 배치해 걸러진 기업에 대한 API 낭비를 막습니다.

## 아키텍처

- **UI (`src/app/page.tsx`, `src/components`)**: 순수 React(클라이언트). 서버 접근은
  **플랫폼 어댑터** 한 곳(`src/platform/index.ts`)으로만 — 컴포넌트는 `fetch`를 직접
  부르지 않습니다.
- **API 라우트 (`src/app/api`)**: 크롤링·검색·파일 처리·Anthropic 호출 등 모든 서버
  로직. 서버 사이드라 브라우저 CORS 제약이 없습니다.
  - `api/pipeline` — multipart(FormData) 입력, **NDJSON 스트림**으로 단계별 진행 상황을
    실시간 전송(스텝퍼가 라이브로 갱신).
  - `api/export` — JSON 입력, xlsx/csv 파일 다운로드 응답.
- **로직 계층 (`src/lib`)**: `services/*`(인터페이스로 추상화된 Anthropic/Node 구현)와
  `pipeline.ts`(6단계 오케스트레이션). API 라우트가 이 계층을 주입해 사용합니다.
- **Shared (`src/shared`)**: 서버·클라이언트 공용 순수 TS (타입, 사업자번호 판별, 메일 템플릿).

```
src/
  app/
    layout.tsx  page.tsx  globals.css
    api/pipeline/route.ts   POST multipart → NDJSON 스트림
    api/export/route.ts     POST JSON → xlsx/csv 다운로드
  components/               SearchBar · PipelineStepper · CompanyTable
                           · DetailPanel · SettingsModal · ExportBar
  hooks/usePipeline.ts      스트리밍 소비 훅
  lib/
    services/*              types · anthropic · companySearch · infoCollector
                           · dedupe · proposal · exporter
    pipeline.ts  stages.ts
  platform/index.ts         ★ fetch API 클라이언트 (UI ↔ 서버 경계)
  shared/                   types · bizNumber · emailTemplate (순수)
```

## 로컬 실행

1. `.env.example`을 복사해 `.env.local`을 만들고 키를 넣습니다:
   ```bash
   cp .env.example .env.local
   ```
   ```
   ANTHROPIC_API_KEY=sk-ant-...      # 필수
   ANTHROPIC_MODEL=claude-sonnet-5   # 선택(미설정 시 기본값)
   ```
2. `npm install` 후 `npm run dev` → http://localhost:3000
3. 산업군 키워드(예: "건강기능식품")를 입력하고 검색을 시작합니다. 스텝퍼가 실시간으로 갱신됩니다.
4. (선택) 기존 후원처 파일(xlsx/csv)을 올리면 중복을 자동 제외합니다.
5. 표에서 행을 클릭하면 사이드 패널에서 상세 정보·제안 문단·메일 전문을 확인/복사할 수 있습니다.
6. 상단 **내보내기**로 xlsx/CSV를 다운로드합니다.

### 메일 전문 틀 / 제안서 소개 편집

**⚙ 설정**에서 메일 전문을 자유롭게 바꿀 수 있습니다.

- **메일 전문 틀**: 인사말·담당자 안내·서명 등 본문 틀을 직접 수정합니다. 다음 치환 항목을
  쓸 수 있습니다 — `{{기업명}}`, `{{맞춤문단}}`(AI 생성 맞춤 문단), `{{제안서목록}}`(제안서 소개).
- **제안서 소개**: 첨부할 제안서 파일(PDF)을 올리면 내용을 읽어 "제안서 소개" 문구를
  자동 작성합니다(직접 수정도 가능). 캠페인/제안서가 바뀔 때마다 새 파일만 올리면 메일에 반영됩니다.

설정은 브라우저(localStorage)에 저장되며, 미리보기(사이드 패널 "메일 전문")와 내보내기에
동일하게 반영됩니다.

## 명령어

```bash
npm install
npm run dev        # 개발 서버 (http://localhost:3000)
npm run build      # 프로덕션 빌드
npm run start      # 프로덕션 서버 실행
npm run typecheck  # 타입 검사
npm run test       # 유닛 테스트 (vitest)
```

## 배포 (Vercel) — 웹사이트 링크 만들기

> **링크는 배포 후 자동으로 생깁니다.** 이 앱은 Next.js 웹앱이라 Vercel에 올리면
> `https://<프로젝트>.vercel.app` 형태의 **공개 링크**가 생성되고, 그 링크로 어디서나
> 브라우저에서 바로 사용할 수 있습니다. 링크는 **본인 Vercel 계정**에서 아래 순서로
> 발급되며(개발 지식 없이 약 2분), 실제 동작에는 **본인 Anthropic API 키**가 필요합니다.

개발 지식이 없어도 아래 순서대로 하면 배포됩니다. (Vercel 무료 Hobby 플랜으로도 가능)

1. **GitHub 리포지토리를 Vercel에 연결**
   - **[vercel.com/new](https://vercel.com/new)** 접속 → GitHub 계정으로 로그인
     → 이 리포지토리(`rlarbals619/-`)를 **Import**.
   - (또는 [vercel.com](https://vercel.com) → **Add New… → Project** → 이 리포 선택 → **Import**)
   - 프레임워크는 자동으로 **Next.js**로 감지됩니다(별도 빌드 설정·`vercel.json` 불필요).
2. **환경변수 등록** (배포 전, Import 화면의 *Environment Variables* 또는
   Project → **Settings → Environment Variables**)
   - Name: `ANTHROPIC_API_KEY`, Value: 발급받은 키(`sk-ant-...`)
   - (선택) `ANTHROPIC_MODEL` = `claude-sonnet-5`
   - 스코프는 **Production / Preview / Development** 모두 체크
   - 키는 **서버에서만** 쓰이며 브라우저·소스에 노출되지 않습니다. (`.env.local`은 커밋 금지 — 이미 `.gitignore` 처리됨)
3. **Deploy** 버튼 클릭 → 잠시 후 배포 URL(`https://<프로젝트>.vercel.app`)이 생성됩니다.
4. 배포 URL에 접속해 산업군 키워드로 실제 동작을 확인합니다.

### ⚠️ 함수 실행시간 제한 (꼭 확인)

파이프라인은 기업 수만큼 web_search를 돌려 **수십 초~수 분**이 걸릴 수 있습니다. Vercel
서버리스 함수에는 실행시간 상한이 있습니다.

| 구성 | 최대 실행시간 |
| --- | --- |
| **Fluid Compute** (신규 프로젝트 기본값) — Hobby | **300초** |
| **Fluid Compute** — Pro / Enterprise | 800초 |
| 레거시(비Fluid) — Hobby | 60초 |

- 이 앱은 `src/app/api/pipeline/route.ts`에 `maxDuration = 300`을 지정합니다 →
  **Fluid Compute가 켜진 Hobby/Pro에서 그대로 동작**합니다. Fluid Compute는 신규
  프로젝트 기본값이며 Project → Settings → **Functions**에서 확인할 수 있습니다.
- 만약 배포가 `maxDuration` 관련 오류로 실패하면 프로젝트가 레거시(60초)입니다 →
  Fluid Compute를 켜거나, 위 파일의 값을 `60`으로 낮추세요.
- 실행 중 **504(FUNCTION_INVOCATION_TIMEOUT)**가 나면 기업 수가 너무 많은 것입니다 →
  앱 우측 상단 **⚙ 설정**에서 **최대 발굴 기업 수**를 줄이세요(예: 5~8). 실행 중 **취소**
  버튼을 눌러도 그때까지 완료된 결과는 유지됩니다.

## 배포 전 실제 키 스모크테스트 (체크리스트)

배포 전에 실제 API 키로 로컬에서 한 번 돌려보길 권장합니다.

1. `cp .env.example .env.local` 후 `ANTHROPIC_API_KEY`에 실제 키 입력
2. `npm run dev` → http://localhost:3000
3. **⚙ 설정**에서 최대 발굴 기업 수를 **5** 정도로(비용·시간 최소화)
4. 산업군 키워드(예: "건강기능식품") 입력 → 검색 시작
5. 아래를 확인:
   - [ ] 스텝퍼 카운터가 실시간으로 오른다 (예: "정보 수집 3/5")
   - [ ] **취소** 버튼을 누르면 즉시 멈추고, 그때까지 완료된 기업은 결과에 남는다
   - [ ] 실패가 있으면 진행률에 "(실패 N)", 결과 표에 **부분 실패** 배지 + 사유가 보인다
   - [ ] 상단 **전체 / 성공 / 이슈·취소** 필터가 동작한다
   - [ ] **엑셀/CSV 내보내기**가 다운로드된다(상태·실패 사유 열 포함)

## 참고

- API 키는 **서버 환경변수**로만 관리되며 브라우저에 노출되지 않습니다.
- 한국 기업정보 공개 API는 제한적이라, 기업 발굴·정보 수집은 Claude의 `web_search`
  서버 도구를 사용합니다. 유료 DB의 무단 크롤링은 하지 않습니다.
- 등록 업종과 실제 사업이 다를 수 있어 홈페이지 기준으로 재확인하며, 사업자등록번호를
  확인하지 못한 기업은 법인 필터 단계에서 제외됩니다.
