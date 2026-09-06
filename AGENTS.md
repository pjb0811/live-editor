# Live Editor — Project Overview

React 19 + TypeScript 기반의 인터랙티브 UI 에디터 라이브러리입니다.
Canvas의 DnD 편집 결과를 Babel AST 변환으로 소스 코드에 역으로 반영하고, 샌드박스 iframe에서 안전하게 미리보기를 실행합니다.

---

## 📁 디렉토리 구조

```text
live-editor/
├─ .github/
│  ├─ skills/               # AI 스킬 파일 (component, ast, review, refactor, doc, pr-summary)
│  └─ copilot-instructions.md  # GitHub Copilot 프로젝트 지침
├─ src/
│  ├─ components/
│  │  ├─ context/           # 전역 상태 (PreviewContext, ErrorContext)
│  │  ├─ dnd/               # DnD 시스템 (Canvas + Panel + Renderer)
│  │  │  ├─ panel/          # 프로퍼티 편집 패널 (children/field/items/node.tsx)
│  │  │  ├─ renderer.tsx    # 선택 요소 JSX 구조 렌더링
│  │  │  ├─ draggable.tsx   # 드래그 가능한 섹션 아이템
│  │  │  ├─ droppable.tsx   # 드롭 영역
│  │  │  ├─ sortable.tsx    # 정렬 가능한 리스트
│  │  │  └─ overlay.tsx     # 드래그 인디케이터
│  │  ├─ editor/            # CodeMirror 코드 에디터 (core.tsx)
│  │  ├─ error/             # 에러 처리 (boundary.tsx, guard.tsx, runtime.tsx)
│  │  ├─ frame/             # 미리보기 컨테이너 (iframe.tsx, shadow.tsx)
│  │  └─ preview/           # 컴파일 + 렌더링 (client.tsx)
│  ├─ pages/
│  │  ├─ playground/        # 메인 에디터 페이지
│  │  └─ preview/           # 풀스크린 미리보기 페이지
│  ├─ utils/
│  │  ├─ index.ts           # compile(), cn(), baseModules 등 핵심 유틸
│  │  ├─ ast/               # Babel AST 조작 유틸 (파이프라인 단계별 분리, index.ts는 재수출 배럴)
│  │  │  ├─ types.ts        # DataAttrNode, BindingItem 등 타입 정의
│  │  │  ├─ helpers.ts      # wrap/unwrap/attrValue/generateCode (여러 단계 공용)
│  │  │  ├─ binding.ts      # parseBinding(), getCurrentValue(), findEditableChildren()
│  │  │  ├─ value.ts        # JS 값 ↔ AST 리터럴 변환 (extractNodeValue 등)
│  │  │  ├─ extract.ts      # raw JSX 문자열 → DataAttrNode 트리 (extract())
│  │  │  ├─ update.ts       # 값 → AST 반영 (update(), bulkUpdate())
│  │  │  └─ tree.ts         # replaceIds()/fillIds()/clone()
│  │  └─ tailwind/          # Tailwind 관련 유틸
│  ├─ constants/index.ts    # 상수, 정규식, 기본 템플릿
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
  → AST 변환 (update()/bulkUpdate() 등) → 새 코드 문자열
  → PreviewContext 업데이트 → 미리보기 재렌더링
```

---

## 🏗️ 주요 파일 요약

| 파일                                | 역할                                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/index.ts`                | `compile()`, `cn()`, `baseModules`, `getCachedScriptBlob()`                                                                                         |
| `src/utils/ast/`                    | `extract()`, `update()`/`bulkUpdate()`, `parseBinding()`, `getCurrentValue()`, `clone()` — 모듈 구조는 [ast 스킬](.github/skills/ast/SKILL.md) 참고 |
| `src/constants/index.ts`            | `DATA_ATTR`, `REGEX`, `BINDING_PROP`, `DEFAULT_TEMPLATE`, `DRAGGABLE_ITEMS`                                                                         |
| `src/types/index.ts`                | `Module`, `Section` 타입                                                                                                                            |
| `src/components/context/states.ts`  | `PreviewContext`, `ErrorContext`, `usePreview()`, `useError()`                                                                                      |
| `src/components/preview/client.tsx` | 코드 컴파일 → 프레임 내 컴포넌트 렌더링                                                                                                             |
| `src/components/frame/iframe.tsx`   | iframe 샌드박스 + 스타일 동기화 + 자동 높이                                                                                                         |

---

## 📐 프로젝트 컨벤션

### 디렉토리 패턴

- 디렉토리명은 kebab-case (`error/`, `dnd/panel/` 등)
- "그룹화된" 컴포넌트(하위 컴포넌트를 가진 부모, 예: `error/`, `editor/`, `frame/`, `dnd/panel/`)는 각 하위 컴포넌트를 서브 디렉토리가 아니라 **같은 폴더 내 named file**로 둔다 (예: `error/boundary.tsx`, `editor/core.tsx`) — `ui-kit`의 `input/` 컴포넌트와 동일한 패턴
- `index.ts`는 그 파일들을 import해서 조합/재수출만 하는 얇은 **barrel**. 정적 프로퍼티로 합성되는 경우(`Editor.Core`, `Error.Boundary` 등)는 barrel에서 조합하고, 구현 파일(`error.tsx` 등)은 원래 export 식별자명을 그대로 유지 — barrel에서만 `import ErrorImpl from './error'`처럼 import 시점에 별칭을 준다
- 정적으로 합성되지 않고 내부적으로만 쓰이거나 직접 subpath import되는 하위 파일(예: `editor/core.tsx`, `context/states.ts`)은 barrel을 거치지 않고 그대로 둔다

### 재사용 가능한 UI/훅은 공유 라이브러리에 먼저

새 컴포넌트/기능을 만들 때 그 안의 UI 요소나 훅이 이 저장소를 넘어 재사용될 만하면(예: 범용 UI 프리미티브, 특정 도메인에 안 묶인 상태/이벤트 훅), 여기에 바로 구현하지 말고 **`ui-kit`(UI 컴포넌트) / `use-hooks`(React 훅)에 먼저 구현 → 머지/배포 → 여기서는 그 패키지를 의존성으로 가져다 쓰기**. 이 저장소의 AST 변환 로직처럼 이 앱 도메인 자체에 강하게 결합된 것만 로컬 구현이 맞다. 판단 기준/절차는 `.claude/skills/coding-style/SKILL.md`의 "D. 재사용 가능한 UI/훅은 공유 라이브러리에 먼저 구현" 참고 — `useHistoryState`/`useDebounce`/`useLocalStorage`(`@jbpark/use-hooks`)가 이 패턴으로 처리된 실제 사례.

### 경로 alias

```ts
~/components  →  src/cemnnoopst;
~/utils       →  src/ilstu;
~/constants   →  src/acnnosstt;
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
