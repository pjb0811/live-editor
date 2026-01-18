# Live Editor

[English](./README.md) | [한국어](./README.ko.md)

실시간 프리뷰와 드래그 앤 드롭을 지원하는 인터랙티브 UI 에디터입니다. 캔버스에서의 편집 내용은 AST 변환을 통해 실제 소스 코드에 정확히 반영되며, 결과는 격리된 iframe 샌드박스에서 안전하게 실행됩니다. React 19와 TypeScript로 구현되었습니다.

## 📁 프로젝트 구조

```text
live-editor/
├─ .changeset/              # 패키지 버전 관리(Changesets) 설정
├─ src/
│  ├─ components/
│  │  ├─ Context/           # 전역 상태/데이터 컨텍스트
│  │  ├─ Dnd/               # 드래그 앤 드롭 엔진 및 UI
│  │  │  └─ Panel/          # 속성 편집 패널(Field, Items, Node 등)
│  │  ├─ Editor/            # 코드 에디터 통합
│  │  ├─ Error/             # 런타임 에러 바운더리 및 표시
│  │  └─ Preview/           # 샌드박스 프리뷰 클라이언트/iframe
│  ├─ enums/                # 상수 및 설정 enum
│  ├─ types/                # 공용 타입 정의
│  ├─ utils/
│  │  └─ ast/               # AST 유틸리티 및 코드 변환 헬퍼
│  ├─ App.tsx               # 앱 레이아웃/쉘
│  └─ main.tsx              # 엔트리 포인트
├─ README.md
└─ package.json
```

## 🎯 주요 기능

- **AST 기반 실시간 코드 반영**: 캔버스 상호작용(추가/이동/삭제, 속성 변경)을 안전하게 소스 코드에 적용합니다.
- **인터랙티브 속성 패널**: 숫자, 문자열, 불리언, 배열, 객체를 패널에서 바로 편집합니다.
- **격리된 프리뷰 런타임**: 샌드박스된 iframe에서 사용자 코드를 실행하여 메인 앱을 보호합니다.
- **강력한 드래그 앤 드롭**: `@dnd-kit` 기반으로 부드러운 정렬과 배치를 지원합니다.

## 🧰 기술 스택

- **Core**: React 19, TypeScript 5.8, Vite 7
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

## 📦 버전 관리 & 배포 (Changesets)

이 프로젝트는 **Changesets**와 GitHub Actions로 릴리스를 자동화합니다.

수동 절차(선택):

1. 변경셋 생성:
   ```bash
   pnpm changeset
   ```
2. 버전 반영 및 changelog 업데이트:
   ```bash
   pnpm version-packages
   ```
3. 배포(빌드 후 publish):
   ```bash
   pnpm release
   ```

CI 워크플로우:

- `publish.yml`: Changesets를 통해 릴리스 PR 생성 또는 npm 배포
- `release.yml`: 태그 푸시 시 GitHub Release 생성 (예: `v1.2.3`)
- `auto-release.yml`: 필요 시 버전 상승 PR 자동 생성
- `docs-deploy.yml`: 빌드 후 `dist/`를 GitHub Pages에 배포

참고: GitHub Pages 사용 시 저장소 설정에서 Pages Source를 "GitHub Actions"로 지정하세요. 저장소 서브경로로 배포한다면 `vite.config.ts`의 `base` 값을 경로에 맞게 설정해야 합니다.

## 📄 라이선스

MIT License
