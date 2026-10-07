# Live Editor — Project Overview

React 19 + TypeScript 기반의 인터랙티브 UI 에디터 라이브러리입니다.
Canvas의 DnD 편집 결과를 Babel AST 변환으로 소스 코드에 역으로 반영하고, 호스트에서 실행한 결과를 iframe 또는 Shadow DOM에 렌더링합니다. iframe은 DOM/CSS 격리용이며 JavaScript 실행의 보안 경계가 아닙니다.

데이터 흐름, commit 단계, `Live.Dnd` 내부, AST 계층, 용어집은 [ARCHITECTURE.ko.md](ARCHITECTURE.ko.md)(영어: [ARCHITECTURE.md](ARCHITECTURE.md))에 있습니다. 구조를 바꾸면 두 문서와 문서 사이트의 [How It Works](website/docs/how-it-works.mdx)를 함께 고칩니다.

---

## 📁 디렉토리 구조

```text
live-editor/
├─ .github/
│  ├─ skills/ast/           # Babel AST 변환 스킬 (SKILL.md)
│  ├─ scripts/              # changeset/릴리즈 노트 자동화 스크립트 (*.mjs)
│  └─ workflows/            # CI, changeset-draft, version, publish, release
├─ .claude/
│  ├─ skills/               # 코딩 컨벤션/설계 스킬 (아래 "관련 스킬 파일" 참고)
│  └─ commands/             # publish-check.md
├─ src/
│  ├─ components/
│  │  ├─ context/           # 전역 상태 (PreviewContext, ErrorContext, MessagesContext — UI 문구 `messages`)
│  │  ├─ dnd/               # DnD 시스템 (Canvas + Panel + Palette)
│  │  │  ├─ dnd.tsx, index.ts # Live.Dnd 컴포넌트와 공개 export
│  │  │  ├─ types.ts        # DndPanel·DndPalette·Props 공개 타입 (dnd.tsx와 분리)
│  │  │  ├─ layout.tsx      # Palette/Canvas/Panel/Layout 합성 컴포넌트
│  │  │  ├─ layout-context.ts # 커스텀 레이아웃·팔레트·패널 훅
│  │  │  ├─ edit-options.ts, panel-binding.ts, inspector.ts # 편집 에러·패널 바인딩·요소 picker (여러 영역 공용)
│  │  │  ├─ canvas/         # 캔버스: droppable, sortable, overlay, renderer(섹션 컴파일·렌더), section-fallback, inspector-highlight
│  │  │  ├─ palette/        # 팔레트: draggable, palette-drag(드래그 데이터)
│  │  │  ├─ state/          # 상태 훅: use-section-document(섹션 문서), use-dnd-keyboard, use-inspector-state, use-delete-flow
│  │  │  └─ panel/          # 프로퍼티 편집 패널 (children/field/items/node.tsx)
│  │  ├─ editor/            # CodeMirror 코드 에디터 (core.tsx, use-format-code.ts)
│  │  ├─ error/             # 에러 처리 (boundary.tsx, guard.tsx, runtime.tsx)
│  │  ├─ frame/             # 미리보기 컨테이너 (iframe.tsx, shadow.tsx, measure.ts, viewport-units.ts)
│  │  └─ preview/           # 컴파일 + 렌더링 (client.tsx, use-compiled-module.ts, base-modules.ts, use-dynamic-tailwind.ts)
│  ├─ pages/
│  │  ├─ index.tsx          # 로컬 개발 앱 셸 (해시로 페이지 전환, 다크 모드 토글)
│  │  ├─ playground/        # 코드 에디터·DnD 토글, undo/redo, 저장
│  │  ├─ custom-panel/      # 커스텀 Palette/Panel/Layout (docs 데모 재사용)
│  │  ├─ panel-meta/        # meta 키(tab/group/description/hint/visible)를 읽는 패널 (docs 데모 재사용)
│  │  ├─ inspector/         # 요소 선택, renderField, onEditError, onBeforeDelete
│  │  ├─ fallback/          # renderSectionFallback, shouldForceSectionFallback
│  │  ├─ preview-modes/     # iframe/shadow/in place 비교, syncStyle·테마 동기화
│  │  └─ shared/            # 페이지 공용 예제 섹션, 프레임 설정
│  ├─ utils/
│  │  ├─ index.ts           # compile(), cn() 등 핵심 유틸 (UI kit을 import하지 않음 — Node에서 로드 가능해야 함)
│  │  ├─ cache.ts           # 바운디드 LRU 캐시
│  │  ├─ selection.ts       # 다중 선택 헬퍼
│  │  ├─ ast/               # Babel AST 조작 유틸 (파이프라인 단계별 분리, index.ts는 재수출 배럴)
│  │  │  ├─ types.ts        # DataAttrNode, BindingItem 등 타입 정의
│  │  │  ├─ helpers.ts      # wrap/unwrap/attrValue/generateCode (여러 단계 공용)
│  │  │  ├─ jsx-name.ts     # getJSXTagName() — JSX 태그 이름 해석 (섹션 탐색·추출 공용)
│  │  │  ├─ binding.ts      # parseBinding(), getCurrentValue(), findEditableChildren()
│  │  │  ├─ value.ts        # AST에서 JS 값 읽기 (evaluateLiteral, parseValue, extractNodeValue 등)
│  │  │  ├─ editable-value.ts # 객체·배열 값의 편집 가능한 리프 (flattenEditableValue, setEditableValue)
│  │  │  ├─ value-expression.ts # JS 값 → AST 표현식 (valueToExpression, createNodeFromValue)
│  │  │  ├─ extract.ts      # raw JSX 문자열 → DataAttrNode 트리 (extract())
│  │  │  ├─ document.ts     # 문서 파싱/섹션 분리/미리보기 생성 (traverse)
│  │  │  ├─ children.ts     # 자식 JSX 소스 구간 편집 (이동/삭제/복제/추가)
│  │  │  ├─ array-source.ts # 밀집 배열 구간/쉼표 보존 편집
│  │  │  ├─ items.ts        # 배열 아이템 편집 (추가/이동/삭제)
│  │  │  ├─ patch.ts        # 소스 스팬 기반 부분 편집 적용 (applyEdits)
│  │  │  ├─ update.ts       # 값 → AST 반영 (update(), updateAll(); bulkUpdate()는 deprecated) — 바인딩 찾기·가드·속성 편집 단계
│  │  │  ├─ edit-source.ts  # update의 소스 편집기 (innerText/innerHTML/richtext/속성 추가·수정·삭제)
│  │  │  ├─ validate.ts     # 바인딩 값 검증
│  │  │  └─ tree.ts         # replaceIds()/fillIds()/clone()
│  │  └─ tailwind/          # Tailwind 관련 유틸
│  ├─ constants/index.ts    # 상수, 정규식, 기본 템플릿
│  ├─ types/index.ts        # TypeScript 타입 정의
│  ├─ index.tsx             # 라이브러리 공개 API (Live 및 합성 컴포넌트)
│  └─ main.tsx              # 로컬 개발 앱 진입점
├─ demos/                   # 문서용 독립 iframe 데모
├─ website/                 # Docusaurus 문서 사이트
├─ .changeset/              # changesets (버전/체인지로그)
├─ package.json
├─ vite.config.ts
├─ vitest.config.ts         # 테스트 설정
├─ tsdown.config.ts         # 라이브러리 빌드 설정
└─ tsconfig.app.json
```

---

## 🔑 핵심 데이터 흐름

```text
코드 문자열 (PreviewContext)
  → compile() — Babel 인브라우저 트랜스파일 + 캐시
  → 호스트의 new Function()으로 모듈 실행
  → React 렌더링 (iframe/Shadow DOM/호스트 DOM 선택)
  → 사용자가 DnD/패널로 요소 편집
  → AST 변환 (update()/updateAll() 등) → 새 코드 문자열
  → PreviewContext 업데이트 → 미리보기 재렌더링
```

---

## 🏗️ 주요 파일 요약

| 파일                                | 역할                                                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/index.ts`                | `compile()`, `cn()`, `getCachedScriptBlob()`. UI kit을 import하지 않음 (`check-node-entries.mjs`로 검사)                                                                        |
| `src/utils/ast/`                    | 공개: `extract()`, `update()`/`updateAll()`, `validateBindingValue()` 등. 내부 코드는 배럴 대신 모듈 파일에서 import — 모듈 구조는 [ast 스킬](.github/skills/ast/SKILL.md) 참고 |
| `src/constants/index.ts`            | `DATA_ATTR`, `REGEX`, `BINDING_PROP`, `DEFAULT_TEMPLATE`, `PALETTE_SECTIONS`                                                                                                    |
| `src/types/index.ts`                | `Module`, `Section` 타입                                                                                                                                                        |
| `src/components/context/states.ts`  | `PreviewContext`, `ErrorContext`, `usePreview()`, `useError()`                                                                                                                  |
| `src/components/preview/client.tsx` | 코드 컴파일 → 프레임 내 컴포넌트 렌더링                                                                                                                                         |
| `src/components/frame/iframe.tsx`   | iframe DOM/CSS 격리 + 스타일 동기화 + 자동 높이                                                                                                                                 |

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

```text
~/* → ./src/*
```

TypeScript와 Vite/Vitest 설정에 같은 별칭을 사용합니다.

### 주석

- 주석은 지금 코드를 처음 읽는 사람을 위해 씁니다. 무엇을 하는지 먼저 쓰고, 이유는 지켜야 할 제약일 때만 현재형으로 쓰며, 과거 이야기는 이슈 번호(`(#450)`)로 대신합니다. 자세한 규칙과 예시는 `.claude/skills/coding-style/SKILL.md`의 "E. 주석 작성"을 따릅니다.

### boolean 이름

- 값과 상태는 `isOpen`, `hasError`처럼 `is`/`has`/`can`을 붙이고, prop은 `open`, `disabled`처럼 접두사 없이 짓습니다. 판별 함수는 `isX(value)`입니다. 자세한 기준은 `.claude/skills/coding-style/SKILL.md`의 "F. boolean 이름 짓기"를 따릅니다.

### CSS

- **Tailwind CSS 4** + `cn()` 유틸리티 (`clsx` + `tailwind-merge`)
- inline style은 미리보기 프레임 내부 또는 Tailwind로 표현 불가한 동적 스타일에만 사용

### 상태 관리

- 전역 상태: `PreviewContext` (코드), `ErrorContext` (에러)
- Redux/Zustand 없음 — 순수 React Context + hooks

### 컴파일 & 캐시

- `compile(code, modules)` — 바운디드 LRU 캐시 (최대 50개)
- Babel의 TypeScript/React/env 프리셋으로 변환하고 호스트에서 모듈 실행
- 캐시 일치 조건: 원본 코드 + 정렬한 모듈 이름·값 스냅샷. 객체/함수는 참조, 원시값은 `Object.is`로 비교하며 서로 다른 모듈 조합도 50개 LRU 한도 안에서 별도 보관
- 문서 파싱 캐시와 섹션 미리보기 캐시는 `src/utils/ast/document.ts`에서 관리

---

### Changeset

- PR에 `.changeset/*.md`가 없으면 `changeset-draft.yml`이 PR 브랜치에 초안 changeset 커밋을 push합니다. 모델이 쓴 문구와 bump라 실제 변경과 맞지 않을 수 있습니다.
- 일부러 changeset을 넣지 않는 PR(아직 배포되지 않은 변경을 다듬는 PR, 문서·CI·리팩터링만 바꾸는 PR 등)에는 `pnpm changeset --empty`로 빈 changeset을 넣습니다. bump와 CHANGELOG 항목 없이 draft만 건너뜁니다. 빈 changeset만 쌓인 상태의 Version PR은 그 파일을 지우기만 하고 버전은 그대로입니다.
- 머지를 확인할 때 PR head SHA가 로컬 tip과 다르면, 추가된 커밋(`git log <local>..<head>`)을 확인합니다. 봇이 넣은 changeset이 다음 Version PR의 CHANGELOG와 GitHub Release로 그대로 나갑니다(4.5.0에서 실제로 발생).
- 버전·배포 흐름 전체는 [version-management 스킬](.claude/skills/version-management/SKILL.md)을 참고합니다.

## ⚙️ 개발 명령어

개발·빌드는 CI와 같은 Node 24 계열(24.11 이상)과 `package.json`의 `packageManager`에 고정된 pnpm 버전을 사용합니다(Corepack을 켜면 자동으로 그 버전이 쓰입니다). 루트와 `website/`는 각각 잠금 파일 기준으로 설치합니다.

```bash
pnpm install --frozen-lockfile
pnpm --dir website install --frozen-lockfile
pnpm dev           # Vite 개발 서버 (HMR)
pnpm build         # 타입 체크 + 라이브러리 빌드 (tsdown)
pnpm build:demos   # 문서용 iframe 데모 빌드
pnpm check-types   # tsc -b 타입 체크만
pnpm check-api-surface # 빌드된 dist의 export 목록을 스냅샷과 비교 (pnpm build 후, 의도한 변경은 --update)
pnpm lint          # ESLint
pnpm test          # Vitest 1회 실행
pnpm test:watch    # Vitest watch 모드
pnpm bench         # Vitest 벤치마크
pnpm build:demo    # 로컬 앱을 dist-demo에 빌드
pnpm exec vite preview --outDir dist-demo # 로컬 앱 빌드 미리보기
pnpm --dir website start # 라이브러리·데모 빌드와 캐시 정리 후 문서 개발 서버 실행 (라이브러리 변경은 재실행해야 반영)
pnpm --dir website typecheck # 문서 타입 검사
pnpm --dir website build # 라이브러리·데모 선행 빌드 후 문서 빌드
```

---

## ⚠️ 주의사항

1. **실행 경계** — 미리보기는 `compile()` 경로를 사용합니다. 현재 코드는 호스트 권한으로 실행되므로 신뢰할 수 있는 코드만 다룹니다. iframe의 `sandbox` 속성을 JavaScript 격리로 간주하지 않습니다
2. **소스 보존 편집** — 공유·캐시 AST를 직접 변경하지 않습니다. 기존 소스 구간 편집(`applyEdits` 등)을 사용하고 필요한 조각만 생성해 변경하지 않은 원문을 보존합니다
3. **Fragment 래핑 주의** — JSX 조각 파싱 경로에서 `wrap()`/`unwrap()`을 짝지어 사용합니다. 전체 문서나 단일 표현식 파싱까지 일괄 래핑하지 않습니다
4. **data-id 보존** — Canvas ↔ AST 매핑 키이므로 변환 과정에서 손실되지 않도록 주의
5. **캐시 유효성** — 코드와 주입 모듈 모두 결과에 영향을 줍니다. 모듈 구현을 바꿀 때는 새 모듈 객체와 새 `modules` 맵을 전달합니다. 내부 속성을 직접 변경하는 것은 자동 감지하지 않습니다. 직접 `compile()`을 호출한다면 `clearCompilationCache()` 후 다시 호출할 수 있지만, 캐시 초기화만으로 React 재렌더나 훅 재계산이 발생하지는 않습니다

---

## 🛠️ 기술 스택

| 영역   | 기술                                         |
| ------ | -------------------------------------------- |
| Core   | React 19, TypeScript 6                       |
| 번들러 | Vite 8 (dev), tsdown (lib build)             |
| DnD    | @dnd-kit/core, sortable, modifiers           |
| 에디터 | @jbpark/ui-kit/CodeEditor (CodeMirror 기반)  |
| UI     | @jbpark/ui-kit, lucide-react, Tailwind CSS 4 |
| AST    | @babel/standalone (인브라우저)               |

---

라이브러리는 tsdown으로 ESM과 타입 선언을 빌드합니다. `package.json`의 `/provider`, `/editor`, `/dnd`, `/preview`, `/error`, `/utils` 및 AST/Tailwind 하위 진입점으로 기능별 import를 제공합니다. `Live.Dnd`는 `Palette`, `Canvas`, `Panel`, `Layout`과 커스텀 패널용 훅을 공개합니다.

## 🔗 관련 스킬 파일

| 스킬                  | 경로                                            | 설명                        |
| --------------------- | ----------------------------------------------- | --------------------------- |
| ast                   | `.github/skills/ast/SKILL.md`                   | Babel AST 변환 코드 작성    |
| coding-style          | `.claude/skills/coding-style/SKILL.md`          | 코딩 스타일/컨벤션          |
| component-naming      | `.claude/skills/component-naming/SKILL.md`      | 컴포넌트/파일 네이밍        |
| composition-patterns  | `.claude/skills/composition-patterns/SKILL.md`  | 컴포넌트 합성 패턴          |
| react-best-practices  | `.claude/skills/react-best-practices/SKILL.md`  | React 베스트 프랙티스       |
| version-management    | `.claude/skills/version-management/SKILL.md`    | 버전/changeset 관리         |
| web-design-guidelines | `.claude/skills/web-design-guidelines/SKILL.md` | 웹 디자인 가이드라인        |
| writing-guidelines    | `.claude/skills/writing-guidelines/SKILL.md`    | 문서/텍스트 작성 가이드라인 |
| publish-check         | `.claude/commands/publish-check.md`             | 배포 전 점검 커맨드         |
