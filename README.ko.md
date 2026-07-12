# Live Editor

[English](./README.md) | [한국어](./README.ko.md)

실시간 프리뷰와 드래그 앤 드롭을 지원하는 인터랙티브 UI 에디터입니다. 캔버스에서의 편집 내용은 AST 변환을 통해 실제 소스 코드에 정확히 반영되며, 결과는 격리된 iframe 샌드박스에서 안전하게 실행됩니다. React 19와 TypeScript로 구현되었습니다.

## 📁 프로젝트 구조

```text
live-editor/
├─ src/
│  ├─ components/
│  │  ├─ Context/           # 전역 상태 관리
│  │  ├─ Dnd/               # 드래그 앤 드롭 시스템 및 편집 패널
│  │  ├─ Editor/            # 코드 에디터
│  │  ├─ Error/             # 에러 바운더리
│  │  └─ Preview/           # 격리된 프리뷰 런타임
│  ├─ pages/
│  │  ├─ Playground/        # 메인 에디터 페이지
│  │  └─ Preview/           # 전체화면 프리뷰 페이지
│  ├─ utils/ast/            # AST 조작 및 코드 생성
│  ├─ enums/                # 상수 및 설정
│  ├─ types/                # TypeScript 타입 정의
│  └─ App.tsx               # 라우팅이 포함된 앱 레이아웃
└─ package.json
```

## 🎯 주요 기능

- **AST 기반 실시간 코드 반영**: 캔버스 상호작용(추가/이동/삭제, 속성 변경)을 안전하게 소스 코드에 적용합니다.
- **인터랙티브 속성 패널**: 숫자, 문자열, 불리언, 배열, 객체를 패널에서 바로 편집합니다.
- **고급 JSX 바인딩 시스템**: 타입 기반 감지를 통해 모든 JSX 요소 속성(children, label, icon 등)을 자동으로 인식하고 편집 가능하게 합니다.
- **스마트 Items 에디터**: 배열 아이템을 추가/이동/삭제하고, 일반 속성과 중첩된 JSX 컴포넌트를 편집합니다. 순서 변경 시에도 안정적인 컴포넌트 ID를 유지합니다.
- **격리된 프리뷰 런타임**: 샌드박스된 iframe에서 사용자 코드를 실행하여 메인 앱을 보호합니다.
- **강력한 드래그 앤 드롭**: `@dnd-kit` 기반으로 부드러운 정렬과 배치를 지원합니다.
- **저장 & 미리보기**: 작성한 코드를 localStorage에 저장하고 전용 전체화면 미리보기 페이지(`/preview`)에서 확인할 수 있습니다.

## 🧰 기술 스택

- **Core**: React 19, TypeScript 5.8, Vite 7
- **Routing**: `react-router-dom` (SPA 네비게이션)
- **DnD**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`
- **Editor**: `@uiw/react-codemirror` (VSCode 테마)
- **UI/스타일**: Ant Design, Tailwind CSS 4
- **변환**: Babel(standalone) 기반 브라우저 내 변환

## ⚙️ 요구 사항

- Peer dependencies: `react >=19`, `react-dom >=19`
- Node.js: 20.x 이상
- **pnpm**: 9.x 이상 ([Corepack](https://nodejs.org/api/corepack.html)으로 관리)

## 🚀 시작하기

### pnpm 설정 (권장)

본 프로젝트는 **pnpm@9**를 [Corepack](https://nodejs.org/api/corepack.html)으로 관리합니다. Corepack을 활성화하고 지정된 버전을 적용하세요:

```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
```

또는 수동으로 설치:

```bash
npm install -g pnpm@9
```

### 설치

```bash
pnpm install
```

### 개발 서버 실행

```bash
pnpm run dev
```

### 빌드

```bash
pnpm run build
```

### 린트 & 타입 체크

```bash
pnpm run lint
pnpm exec tsc -b
```

### 프로덕션 프리뷰

```bash
pnpm run preview
```

## 📦 버전 관리 & 배포

이 프로젝트는 `develop` → `main` 브랜치 흐름과 AI 기반 자동 릴리스 노트를 사용합니다 — 수동 changeset 파일이 없습니다:

- **기능 브랜치**는 `develop`으로 머지합니다.
- `develop`에 푸시할 때마다 워크플로우가 diff를 분석해 `CHANGELOG.md`의 `## [Unreleased]` 섹션에 항목을 추가합니다 (아직 버전은 올리지 않음).
- `develop`이 `main`으로 머지되면 그 `Unreleased` 섹션에 버전과 날짜가 확정되고 `package.json` 버전도 함께 올라간 뒤, 릴리스 PR로 열립니다.
- 릴리스 PR을 머지하면 빌드, 태그 생성, (이 패키지가 공개로 전환되면) npm 배포가 실행됩니다.

CI 워크플로우:

- `changelog-develop.yml`: `develop` 푸시마다 AI가 생성한 changelog 항목을 추가
- `publish.yml`: `Unreleased`를 릴리스 PR로 승격하고, 머지 시 빌드/배포/태그 실행
- `release.yml`: 태그 푸시 시 GitHub Release 생성 (예: `v1.2.3`)
- `docs-deploy.yml`: 빌드 후 `dist/`를 GitHub Pages에 배포

참고: GitHub Pages 사용 시 저장소 설정에서 Pages Source를 "GitHub Actions"로 지정하세요. 저장소 서브경로로 배포한다면 `vite.config.ts`의 `base` 값을 경로에 맞게 설정해야 합니다.

## 📄 라이선스

MIT License
