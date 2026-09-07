# Live Editor

[English](./README.md) | [한국어](./README.ko.md)

실시간 프리뷰와 드래그 앤 드롭을 지원하는 인터랙티브 UI 에디터입니다. 캔버스에서의 편집 내용은 AST 변환을 통해 실제 소스 코드에 정확히 반영되며, 결과는 DOM/CSS 격리를 위해 iframe 안에서 렌더링됩니다. React 19와 TypeScript로 구현되었습니다. iframe은 보안 샌드박스가 아닙니다 — [보안 참고사항](#-보안-참고사항)을 확인하세요.

📖 **문서 & 라이브 데모:** https://live-editor-lab.vercel.app

## 📁 프로젝트 구조

```text
live-editor/
├─ src/
│  ├─ components/
│  │  ├─ context/            # 전역 상태 관리
│  │  ├─ dnd/                # 드래그 앤 드롭 시스템 및 편집 패널
│  │  │  └─ panel/           # 속성 패널 필드 에디터
│  │  ├─ editor/             # CodeMirror 코드 에디터
│  │  ├─ error/             # 에러 바운더리
│  │  ├─ frame/             # iframe/shadow DOM 프리뷰 격리
│  │  └─ preview/           # 격리된 프리뷰 런타임
│  ├─ pages/
│  │  └─ editor/            # 로컬 개발용 에디터 (에디터 + DnD 전환)
│  ├─ utils/
│  │  ├─ ast/               # AST 조작 및 코드 생성
│  │  ├─ tailwind/          # Tailwind 테마 헬퍼
│  │  ├─ cache.ts           # 바운디드 LRU 캐시
│  │  └─ selection.ts       # 다중 선택 헬퍼
│  ├─ constants/            # 상수 및 설정
│  ├─ types/                # TypeScript 타입 정의
│  └─ main.tsx              # 로컬 개발 앱 엔트리
├─ demos/                   # 문서용 독립 iframe 데모
├─ website/                 # Docusaurus 문서 사이트
└─ package.json
```

## 🎯 주요 기능

- **AST 기반 실시간 코드 반영**: 캔버스 상호작용(추가/이동/삭제, 속성 변경)을 안전하게 소스 코드에 적용합니다.
- **인터랙티브 속성 패널**: 숫자, 문자열, 불리언, 배열, 객체를 패널에서 바로 편집합니다.
- **고급 JSX 바인딩 시스템**: 타입 기반 감지를 통해 모든 JSX 요소 속성(children, label, icon 등)을 자동으로 인식하고 편집 가능하게 합니다.
- **스마트 Items 에디터**: 배열 아이템을 추가/이동/삭제하고, 일반 속성과 중첩된 JSX 컴포넌트를 편집합니다. 순서 변경 시에도 안정적인 컴포넌트 ID를 유지합니다.
- **프리뷰 런타임**: 컴파일된 결과를 DOM/CSS 격리를 위해 iframe 안에서 렌더링합니다 (보안 샌드박스는 아닙니다 — [보안 참고사항](#-보안-참고사항) 참고).
- **강력한 드래그 앤 드롭**: `@dnd-kit` 기반으로 부드러운 정렬과 배치를 지원합니다.

## 📦 설치

```bash
pnpm add @jbpark/live-editor react react-dom
```

`react`와 `react-dom`(>= 19)은 peer dependency입니다. `prettier`(>= 3)는 선택적
peer로, 에디터의 저장 시 포맷(format-on-save)을 쓰려면 함께 설치하세요. 없어도
에디터는 정상 동작하며 포맷만 건너뜁니다.

## 🧑‍💻 사용법

스타일시트를 앱 루트 근처에서 한 번 import하세요 — **필수**이며 JS 엔트리가
자동으로 불러오지 않습니다:

```tsx
import { useState } from 'react';

import Live from '@jbpark/live-editor';
import '@jbpark/live-editor/style.css';

// 필수 — JS 엔트리가 import하지 않음

const SAMPLE = `
import * as ui from 'ui-kit';

const App = () => (
  <div className="p-6 space-y-2">
    <ui.Typography.Title level={3}>Hello</ui.Typography.Title>
    <ui.Button type="primary">Edit me</ui.Button>
  </div>
);

export default App;
`;

export default function Example() {
  const [code, setCode] = useState(SAMPLE);

  return (
    <Live>
      <Live.Editor value={code} onChange={setCode} />
      <Live.Preview showError frame={{ mode: 'iframe', syncStyle: true }} />
    </Live>
  );
}
```

전체 가이드(Tailwind가 프리뷰에 반영되는 방식, 커스텀 패널 등)는
[문서 사이트](https://live-editor-lab.vercel.app)를 참고하세요.

## 🧩 엔트리 포인트

패키지는 서브패스 export를 제공해, 한 기능 영역만 필요한 소비자가 나머지를
번들에 포함하지 않도록 합니다(예: 프리뷰 전용 빌드에는 CodeMirror 미포함) —
[#194](https://github.com/pjb0811/live-editor/issues/194) 참고:

| Import                               | 내용                                   |
| ------------------------------------ | -------------------------------------- |
| `@jbpark/live-editor`                | 전체 (`Live` 프로바이더 + 모든 서피스) |
| `@jbpark/live-editor/provider`       | 공유 편집 컨텍스트 프로바이더만        |
| `@jbpark/live-editor/dnd`            | 드래그 앤 드롭 캔버스 + 속성 패널      |
| `@jbpark/live-editor/editor`         | CodeMirror 코드 에디터                 |
| `@jbpark/live-editor/preview`        | 격리된 프리뷰 런타임                   |
| `@jbpark/live-editor/error`          | 에러 바운더리                          |
| `@jbpark/live-editor/utils`          | 컴파일/섹션 헬퍼                       |
| `@jbpark/live-editor/utils/ast`      | AST 조작 및 코드 생성                  |
| `@jbpark/live-editor/utils/tailwind` | Tailwind 테마 헬퍼                     |
| `@jbpark/live-editor/style.css`      | 컴파일된 스타일시트 (필수)             |

## 🔒 보안 참고사항

- 프리뷰 `<iframe>`(`src/components/frame/iframe.tsx`)의 `sandbox` prop은 **실제 보안 경계가 아닙니다**. 컴파일된 프리뷰 코드는 host 페이지 자신의 JS realm에서 `new Function(...)`으로 실행되며(`src/utils/index.ts`의 `compileModule`), iframe에는 그 결과로 생성된 React 엘리먼트만 `contentDocument`에 포탈되어 DOM/CSS 렌더링 용도로만 쓰입니다. iframe 자체는 사용자 코드를 실행하지 않습니다.
- 실질적 의미: 미리보기되는 코드는 호스트 애플리케이션과 동일한 수준의 JS 접근 권한(쿠키, DOM, 메모리상의 상태 등)을 가지며, iframe 경계가 이를 막아주지 않습니다.
- 신뢰할 수 있는 프로젝트만 열어서 편집하세요. 직접 별도의 격리 조치(예: iframe 자체 `contentWindow` realm에서 컴파일을 실행하고 결과를 `postMessage`로 주고받는 방식)를 추가하지 않은 채로, 신뢰할 수 없는 제3자 프로젝트 파일을 미리보기하는 용도로 사용하지 마세요 — 그런 격리는 현재 구현되어 있지 않습니다.

## 🧰 기술 스택

- **Core**: React 19, TypeScript 6, Vite 8
- **DnD**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`
- **Editor**: `@uiw/react-codemirror` (VSCode 테마)
- **UI/스타일**: `@jbpark/ui-kit`, `lucide-react`, Tailwind CSS 4
- **변환**: Babel(standalone) 기반 브라우저 내 변환

## ⚙️ 요구 사항

- Peer dependencies: `react >=19`, `react-dom >=19`
- Node.js: 20.x 이상
- **pnpm**: 10.x 이상 ([Corepack](https://nodejs.org/api/corepack.html)으로 관리)

## 🚀 개발 (이 저장소)

> Live Editor 자체를 개발할 때 참고하세요. 패키지를 앱에서 _사용_ 하려면
> 위의 [설치](#-설치)를 보세요.

### pnpm 설정 (권장)

본 프로젝트는 **pnpm@10**을 [Corepack](https://nodejs.org/api/corepack.html)으로 관리합니다. Corepack을 활성화하고 지정된 버전을 적용하세요:

```bash
corepack enable
corepack prepare pnpm@10.29.3 --activate
```

또는 수동으로 설치:

```bash
npm install -g pnpm@10
```

### 설치

```bash
pnpm install
```

### 개발 서버 실행

```bash
pnpm run dev
```

루트 경로에서 로컬 에디터가 실행됩니다. 공개 문서와 기능별 데모는 `website/`에 있습니다.

### 빌드

```bash
pnpm run build
```

### 테스트

```bash
pnpm test
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

배포는 [changesets](https://github.com/changesets/changesets)로 완전히 자동화되어 있습니다:

- `main`으로 향하는 PR마다 AI가 변경 내용을 요약한 changeset 파일을 초안으로 작성합니다.
- `main`에 changeset들이 쌓이면 "Version Packages" PR이 `package.json`의 버전을 승격시키고 `CHANGELOG.md`를 정리합니다.
- 이 PR을 머지하면 빌드, 태그 생성, npm 배포가 실행됩니다.

CI 워크플로우:

- `changeset-draft.yml`: `main` 대상 PR이 열리거나 갱신될 때 AI가 changeset 초안을 작성
- `version.yml`: changeset이 쌓이면 "Version Packages" PR을 열거나 갱신
- `publish.yml`: `main` 머지 시 버전이 미태그 상태면 빌드/배포/태그/GitHub Release 생성
- `release.yml`: 기존 태그에 대한 GitHub Release를 수동(`workflow_dispatch`)으로 재생성하는 백업 유틸리티
- Docusaurus 문서 사이트는 `website/`에서 빌드되며 Vercel로 배포됩니다(`vercel.json` 참고).

## 📄 라이선스

[MIT License](./LICENSE) — Copyright (c) 2026 jbpark
