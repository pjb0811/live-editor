# Live Editor — Project Overview

React 19 + TypeScript 기반의 인터랙티브 UI 에디터 라이브러리입니다.
Canvas의 DnD 편집 결과를 Babel AST 변환으로 소스 코드에 역으로 반영하고, 샌드박스 iframe에서 안전하게 미리보기를 실행합니다.

---

## 📁 디렉토리 구조

```text
live-editor/
├─ .github/
│  ├─ skills/               # AI 스킬 파일 (commit, component, ast, review, refactor, doc, pr-summary)
│  ├─ COMMIT_CONVENTION.ko.md  # 커밋 메시지 컨벤션
│  └─ copilot-instructions.md  # GitHub Copilot 프로젝트 지침
├─ src/
│  ├─ components/
│  │  ├─ Context/           # 전역 상태 (PreviewContext, ErrorContext)
│  │  ├─ Dnd/               # DnD 시스템 (Canvas + Panel + Renderer)
│  │  │  ├─ Panel/          # 프로퍼티 편집 패널
│  │  │  ├─ Renderer/       # 선택 요소 JSX 구조 렌더링
│  │  │  ├─ Draggable/      # 드래그 가능한 섹션 아이템
│  │  │  ├─ Droppable/      # 드롭 영역
│  │  │  ├─ Sortable/       # 정렬 가능한 리스트
│  │  │  └─ Overlay/        # 드래그 인디케이터
│  │  ├─ Editor/            # CodeMirror 코드 에디터
│  │  ├─ Error/             # 에러 처리 (Boundary, Guard, Runtime)
│  │  ├─ Frame/             # 미리보기 컨테이너 (IFrame, Shadow)
│  │  └─ Preview/           # 컴파일 + 렌더링 (Client)
│  ├─ pages/
│  │  ├─ Playground/        # 메인 에디터 페이지
│  │  └─ Preview/           # 풀스크린 미리보기 페이지
│  ├─ utils/
│  │  ├─ index.ts           # compile(), cn(), baseModules 등 핵심 유틸
│  │  ├─ ast/               # Babel AST 조작 유틸 (940+ lines)
│  │  └─ tailwind/          # Tailwind 관련 유틸
│  ├─ enums/index.ts        # 상수, 정규식, 기본 템플릿
│  ├─ types/index.ts        # TypeScript 타입 정의
│  ├─ App.tsx               # 앱 레이아웃 (Editor/DnD 모드 토글)
│  └─ main.tsx              # 진입점
├─ package.json
├─ vite.config.ts
├─ tsdown.config.ts         # 라이브러리 빌드 설정
└─ tsconfig.app.json
```

---

## 🔑 핵심 데이터 흐름

```text
코드 문자열 (PreviewContext)
  → compile() — Babel 인브라우저 트랜스파일 + 캐시
  → iframe 내부에서 React 컴포넌트 렌더링
  → 사용자가 DnD/패널로 요소 편집
  → AST 변환 (updateNodeValue 등) → 새 코드 문자열
  → PreviewContext 업데이트 → 미리보기 재렌더링
```

---

## 🏗️ 주요 파일 요약

| 파일                                      | 역할                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `src/utils/index.ts`                      | `compile()`, `cn()`, `baseModules`, `getCachedScriptBlob()`                 |
| `src/utils/ast/index.ts`                  | `toDataAttrs()`, `toJSX()`, `updateNodeValue()`, `replaceIds()`             |
| `src/enums/index.ts`                      | `DATA_ATTR`, `REGEX`, `BINDING_PROP`, `DEFAULT_TEMPLATE`, `DRAGGABLE_ITEMS` |
| `src/types/index.ts`                      | `Module`, `Section` 타입                                                    |
| `src/components/Context/states/index.tsx` | `PreviewContext`, `ErrorContext`, `usePreview()`, `useError()`              |
| `src/components/Preview/Client/index.tsx` | 코드 컴파일 → 프레임 내 컴포넌트 렌더링                                     |
| `src/components/Frame/IFrame/index.tsx`   | iframe 샌드박스 + 스타일 동기화 + 자동 높이                                 |

---

## 📐 프로젝트 컨벤션

### 디렉토리 패턴

- 각 컴포넌트 폴더는 `index.tsx` 중심의 **barrel export** 패턴 사용
- 하위 컴포넌트도 같은 폴더 내 서브 디렉토리로 구성

### 경로 alias

```ts
~/components  →  src/cemnnoopst;
~/utils       →  src/ilstu;
~/enums       →  src/emnsu;
~/types       →  src/epsty;
```

### CSS

- **Tailwind CSS 4** + `cn()` 유틸리티 (`clsx` + `tailwind-merge`)
- inline style은 sandbox iframe 내부 또는 Tailwind로 표현 불가한 동적 스타일에만 사용

### 상태 관리

- 전역 상태: `PreviewContext` (코드), `ErrorContext` (에러)
- Redux/Zustand 없음 — 순수 React Context + hooks

### 컴파일 & 캐시

- `compile(code, modules)` — **해시 기반 캐시** (최대 50개)
- TypeScript → `ts.transpileModule()` → Babel JSX 변환
- 캐시 키: `코드 내용 + 모듈 키` 조합 해시

---

## ⚙️ 개발 명령어

```bash
pnpm dev           # Vite 개발 서버 (HMR)
pnpm build         # 타입 체크 + 라이브러리 빌드 (tsdown)
pnpm check-types   # tsc -b 타입 체크만
pnpm lint          # ESLint
pnpm preview       # 빌드 결과 미리보기
```

---

## ⚠️ 주의사항

1. **사용자 코드 직접 실행 금지** — 반드시 `compile()` 통해 캐시 후 iframe 내부에서만 실행
2. **AST 불변 업데이트** — traverse 후 항상 `generate()`로 새 코드 문자열 반환, 노드 직접 mutate 금지
3. **Fragment 래핑 주의** — AST 파싱 시 `<>{code}</>`로 감싸고 출력 시 언래핑 필요
4. **data-id 보존** — Canvas ↔ AST 매핑 키이므로 변환 과정에서 손실되지 않도록 주의
5. **캐시 키에 모듈 포함** — 같은 코드라도 모듈이 다르면 별개 캐시 항목으로 관리

---

## 🛠️ 기술 스택

| 영역   | 기술                                |
| ------ | ----------------------------------- |
| Core   | React 19, TypeScript 5.8            |
| 번들러 | Vite 7 (dev), tsdown (lib build)    |
| DnD    | @dnd-kit/core, sortable, modifiers  |
| 에디터 | @uiw/react-codemirror (VSCode 테마) |
| UI     | Ant Design 6, Tailwind CSS 4        |
| AST    | @babel/standalone (인브라우저)      |
| 라우팅 | react-router-dom 7                  |

---

## 🔗 관련 스킬 파일

| 스킬       | 경로                                 | 설명                     |
| ---------- | ------------------------------------ | ------------------------ |
| commit     | `.github/skills/commit/SKILL.md`     | 커밋 메시지 생성         |
| component  | `.github/skills/component/SKILL.md`  | React 컴포넌트 추가      |
| ast        | `.github/skills/ast/SKILL.md`        | Babel AST 변환 코드 작성 |
| review     | `.github/skills/review/SKILL.md`     | 코드 리뷰                |
| refactor   | `.github/skills/refactor/SKILL.md`   | 코드 리팩토링            |
| doc        | `.github/skills/doc/SKILL.md`        | JSDoc/문서 생성          |
| pr-summary | `.github/skills/pr-summary/SKILL.md` | PR Summary/Changes 생성  |
