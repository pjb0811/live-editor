## ✨ Live Editor

실시간 프리뷰와 드래그 앤 드롭을 지원하는 코드 샌드박스 애플리케이션입니다. React 19, TypeScript, Vite를 기반으로 하며 에러 바운더리, 런타임 샌드박스, 편집기/프리뷰 연동을 제공합니다.

## 📁 프로젝트 구조

```text
live-editor/
├─ src/
│  ├─ components/
│  │  ├─ Context/              # 전역 컨텍스트 및 상태
│  │  ├─ Dnd/                   # 드래그 앤 드롭(Draggable, Droppable, Sortable, Renderer)
│  │  ├─ Editor/                # 코드 에디터
│  │  ├─ Error/                 # 에러 바운더리/런타임 UI
│  │  └─ Preview/               # 미리보기(샌드박스, Client 포함)
│  ├─ enums/
│  ├─ types/
│  ├─ utils/
│  ├─ index.tsx                 # 앱 엔트리
│  └─ main.tsx
├─ public/
└─ README.md
```

## 🎯 주요 기능

- **드래그 앤드롭 캔버스**: `@dnd-kit` 기반 구성 요소 배치/정렬
- **라이브 프리뷰**: 격리된 클라이언트 샌드박스에서 코드 실행/렌더링
- **에러 내결함성**: 렌더/런타임 에러 바운더리 UI
- **유틸/훅 제공**: DOM 사이즈 측정 등 공통 유틸리티

## 🛠 기술 스택

- **React 19**, **TypeScript 5.8**, **Vite 7**
- **DnD**: `@dnd-kit/core`, `@dnd-kit/sortable`
- **데이터/상태**: `@tanstack/react-query`
- **스타일**: Tailwind CSS 4
- **에디터**: `@uiw/react-codemirror`

## 🚀 시작하기

### 필수 요구사항

- Node.js 18+
- npm 9+ (본 프로젝트는 npm 스크립트 기준)

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev        # Vite 개발 서버
```

### 빌드/프리뷰

```bash
npm run build      # 타입 체크 + 프로덕션 빌드
npm run preview    # 빌드 결과 프리뷰 서버
```

### 코드 품질

```bash
npm run lint       # ESLint (Flat Config)
```

## 📦 폴더 가이드

- `src/components/Dnd`: 드래그 앤 드롭 영역(Draggable, Droppable, Sortable, Renderer 구성)
- `src/components/Preview/Client`: 샌드박스 실행 클라이언트. 외부 접근이 필요한 경우 적절한 가드 필요
- `src/utils`, `src/types`: 공용 유틸과 타입 정의 배치 권장

## 🧹 ESLint/코드 스타일

- Flat Config(`eslint.config.js`) 기반 설정, TypeScript/React 플러그인 사용
- 린트 제외: `.history`, `dist`
- Prettier + 정렬 플러그인(`lint-staged`)으로 커밋 전 포맷

## 📄 라이선스

MIT License
