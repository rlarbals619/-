# Electron Local App

로컬 데스크톱 앱 스켈레톤. **Electron + React + TypeScript + Vite** 기반이며,
나중에 그대로 웹으로도 배포할 수 있도록 설계되어 있습니다.

## 웹 포팅이 되는 이유

렌더러(화면)는 순수 웹 앱입니다. 파일 시스템 같은 네이티브 기능은
**플랫폼 어댑터** 한 곳(`src/renderer/src/platform/index.ts`)으로만 접근합니다.
컴포넌트는 `window.api`를 직접 부르지 않고 이 어댑터를 호출하므로,
Electron이면 IPC를, 브라우저면 웹 구현을 자동으로 사용합니다.

## 구조

```
src/
  main/index.ts       Electron 메인 프로세스 (창 생성, IPC 핸들러)
  preload/index.ts    contextBridge로 안전한 window.api 노출
  renderer/           React 앱 (순수 웹 코드)
    src/platform/     ★ Electron/Web 분기 어댑터 — 웹 포팅의 핵심
```

## 명령어

```bash
npm install

npm run dev          # Electron 창 + HMR (데스크톱)
npm run build        # 데스크톱 번들 (out/)
npm run package      # 설치 파일 생성 (release/) — electron-builder

npm run build:web    # 웹 산출물 빌드 (dist-web/)
npm run preview:web  # 브라우저에서 웹 버전 미리보기

npm run typecheck    # 타입 검사 (node + web)
```

데스크톱에서는 배지가 "Running in Electron", 브라우저에서는 "Running in Browser"로
표시되어 같은 코드가 양쪽에서 도는 것을 확인할 수 있습니다.
