## ✨ Live Editor

실시간 프리뷰와 드래그 앤 드롭을 지원하는 인터랙티브 코드 에디터입니다. React 19와 Babel AST 분석 기술을 활용하여 캔버스의 시각적인 수정사항을 실제 소스 코드에 즉시 반영하며, 격리된 샌드박스 환경에서 실시간 실행 결과를 제공합니다.

## 📁 프로젝트 구조

```text
live-editor/
├─ .changeset/              # 패키지 버전 관리 설정
├─ src/
│  ├─ components/
│  │  ├─ Context/           # 데이터 전역 상태 관리
│  │  ├─ Dnd/               # 드래그 앤 드롭 엔진 및 UI
│  │  │  └─ Panel/          # 컴포넌트 속성 편집 패널 (Field, Items 등)
│  │  ├─ Editor/            # CodeMirror 기반 코드 편집기
│  │  ├─ Error/             # 런타임 에러 바운더리 및 에러 표시
│  │  └─ Preview/           # 격리된 샌드박스 프리뷰 엔진
│  ├─ enums/                # 상수 및 설정 정의
│  ├─ types/                # 공용 타입 정의
│  ├─ utils/
│  │  └─ ast/               # Babel 기반 AST 분석 및 코드 조작 유틸리티
│  ├─ App.tsx               # 메인 레이아웃 및 로직
│  └─ main.tsx              # 엔트리 포인트
├─ README.md
└─ package.json
```

## 🎯 주요 기능

- **AST 기반 실시간 코드 조작**: 단순 문자열 치환이 아닌 Babel AST 분석을 통해 드래그 앤 드롭(이동/추가/삭제) 및 속성 변경 사항을 정확하게 코드에 반영합니다.
- **인터랙티브 컴포넌트 편집**: 캔버스의 요소를 클릭하여 우측 패널에서 숫자, 문자열, 불리언은 물론 객체 및 배열(Items) 형태의 속성까지 즉시 수정할 수 있습니다.
- **격리된 프리뷰 엔진**: 사용자 코드가 메인 앱에 영향을 주지 않도록 독립된 샌드박스 환경에서 안전하게 실행됩니다.
- **안전한 데이터 바인딩**: JSX 표현식 감지 기능을 통해 `value={10}`과 같은 숫자형이나 객체형 속성도 타입 손실 없이 처리합니다.
- **드래그 앤 드롭 캔버스**: `@dnd-kit` 기반으로 자유로운 요소 배치 및 정렬 기능을 제공합니다.

## 🛠 기술 스택

- **Core**: React 19, TypeScript 5.8, Vite 7
- **AST/Parsing**: `@babel/parser`, `@babel/traverse`, `@babel/types`, `@babel/generator`
- **DnD**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`
- **UI & Grid**: Ant Design, Tailwind CSS 4
- **Editor**: `@uiw/react-codemirror`
- **배포/버전 관리**: Changesets

## 🚀 시작하기

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

### 빌드 및 배포 (Changesets)

본 프로젝트는 **Changesets**를 사용하여 버전을 관리합니다.

1. **변경 사항 기록**: `npm run changeset` 실행 후 안내에 따라 변경 내역 작성
2. **버전 반영**: `npm run version-packages` 실행 (package.json 및 CHANGELOG 업데이트)
3. **배포**: `npm run release` 실행 (빌드 및 npm publish)

## 🧹 코드 품질 관리

- **Lint**: `npm run lint` (ESLint Flat Config 기반)
- **Formatting**: `lint-staged`를 통해 커밋 시 Prettier 자동 적용
- **Type Check**: `tsc -b`를 통한 엄격한 타입 검사

## 📄 라이선스

MIT License
