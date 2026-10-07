---
name: coding-style
description: "Repo-agnostic coding-conventions toolkit — a growing set of procedures for working consistently within any codebase. Currently covers: (A) discovering and following a project's existing directory structure and coding conventions before writing/editing code (checks CLAUDE.md/AGENTS.md, README/CONTRIBUTING, formatter/linter configs, and neighboring files); (B) safely renaming directories/files to a different naming convention (e.g. PascalCase to kebab-case) across a codebase without breaking imports or losing git history; (C) restructuring a grouped/composition component (a parent with sub-components living in their own subdirectories, e.g. Error/Boundary, Input/Search) into named files with a thin composing barrel index.ts, matching ui-kit's own components/atoms/input/ pattern; (D) deciding whether a new reusable UI element or hook belongs in the shared ui-kit/use-hooks libraries first, before implementing it inline in an app repo; (E) writing and rewriting code comments: lead with what the code does, keep a reason only as a present-tense constraint, and replace history with an issue number; (F) naming booleans: `is`/`has`/`can` on boolean values and state, a bare adjective on props, `isX(value)` for predicates. Use when the user says '코딩 스타일대로', '컨벤션 맞춰줘', '이 프로젝트 스타일로', 'follow the project conventions', 'match the existing style', '케밥 케이스로 바꿔줘', '폴더명 리네임', 'rename directories to kebab-case', '배럴 파일 규칙', '그룹화된 컴포넌트 구조', '재사용 가능한 컴포넌트', '공유 라이브러리에 먼저', '주석 정리', '주석 다시 써줘', 'rewrite the comments', 'boolean 이름', 'is 접두사', or whenever writing a code comment, or before creating/editing a file in an unfamiliar repo without already having its conventions in context."
---

# Coding Style

저장소 전반에서 일관된 방식으로 코드를 다루기 위한 절차 모음. 여러 개의 독립된 하위 절차로 구성되며, 새로운 상황이 생기면 이 파일에 섹션을 추가해서 계속 확장한다.

- **A. 기존 컨벤션 파악하고 따르기** — 코드를 작성/수정하기 전에 항상 먼저 확인
- **B. 네이밍 컨벤션 일괄 변경** — 디렉토리/파일명 케이스 컨벤션을 바꿔야 할 때
- **C. 그룹화된/합성 컴포넌트의 배럴 파일 구조** — 하위 컴포넌트가 서브디렉토리+자체 index.tsx로 흩어져 있는 걸 named file + 얇은 배럴로 평탄화할 때
- **D. 재사용 가능한 UI/훅은 공유 라이브러리에 먼저 구현** — 새 컴포넌트/훅을 앱 저장소에 바로 만들지, `ui-kit`/`use-hooks`에 먼저 만들지 판단할 때
- **E. 주석 작성** — 코드 주석을 새로 쓰거나 기존 주석을 다시 쓸 때
- **F. boolean 이름 짓기** — boolean 값·상태·prop·판별 함수의 이름을 정할 때

---

## A. 기존 컨벤션 파악하고 따르기

새 코드를 작성하거나 기존 코드를 수정하기 전에, 이 저장소가 실제로 쓰고 있는 디렉토리 구조·코딩 컨벤션을 먼저 파악하고 그것을 따른다. 일반적으로 "옳다"고 알려진 스타일이나 다른 프로젝트에서 익힌 습관보다 **이 저장소의 기존 패턴이 항상 우선**한다.

### A1. 컨벤션 문서 탐색

작업 대상 저장소 루트(또는 서브패키지 루트)에서 아래를 순서대로 확인한다:

- `CLAUDE.md`, `AGENTS.md` — 있으면 최우선 소스. 명시적으로 작성된 규칙이므로 그대로 따른다.
- `README.md` / `CONTRIBUTING.md`의 "Development" / "코딩 컨벤션" 관련 섹션
- `docs/` 하위의 스타일 가이드 (`STYLE_GUIDE.md`, `CONVENTIONS.md` 등)
- `.cursor/rules`, `.windsurfrules` 같은 다른 AI 툴용 규칙 파일 (있다면 이 프로젝트에 실제로 통용되는 규칙일 가능성이 높음)

이미 세션 컨텍스트에 CLAUDE.md 등이 로드돼 있다면 이 단계는 건너뛰고 그 내용을 바로 쓴다.

### A2. 포매터/린터 설정 확인

문서에 없는 세부 규칙(따옴표, 세미콜론, 들여쓰기, trailing comma 등)은 추측하지 말고 설정 파일에서 확인한다:

- `.prettierrc*`, `.editorconfig`, `eslint.config.*`/`.eslintrc*`
- `package.json`의 `prettier`/`eslint` 필드

### A3. 이웃 파일로 패턴 추론

문서화되지 않은 부분(디렉토리 배치, 네이밍, export 방식, 함수/컴포넌트 작성 패턴 등)은 같은 종류의 기존 파일 2~3개를 열어 실제 패턴을 확인한다:

- 같은 계층/카테고리의 다른 컴포넌트·모듈·훅 파일
- 최근에 추가된 파일일수록 현재 컨벤션을 더 잘 반영할 가능성이 높음 (git log로 최신 파일 확인 가능)
- 파일 배치(어느 디렉토리에 두는지), import 순서, 네이밍 컨벤션, 주석 스타일, 에러 처리 패턴까지 함께 관찰

### A4. 충돌 시 우선순위

1. 이 세션에서 사용자가 명시적으로 준 지시
2. 저장소의 컨벤션 문서 (CLAUDE.md 등)
3. 포매터/린터 설정
4. 이웃 파일에서 관찰한 실제 패턴
5. (위 어느 것도 없을 때만) 언어/프레임워크의 일반적인 관용 스타일 — 이 경우 어떤 근거로 그 스타일을 골랐는지 짧게 언급한다

문서와 실제 코드가 서로 다르면(문서가 오래됨) 실제 코드 쪽을 따르고, 문서가 낡았다는 점을 사용자에게 짚어준다.

### A5. 적용

파악한 컨벤션을 코드 작성/수정에 그대로 적용한다. 새로운 스타일을 도입하지 않는다 — 같은 목적을 기존 패턴으로 달성할 수 있으면 그쪽을 택한다.

### A 엣지 케이스

- **저장소에 해당 종류의 파일이 전혀 없음(이 카테고리의 첫 파일)**: 억지로 흉내 낼 기존 패턴이 없으므로, 컨벤션 문서의 일반 원칙(네이밍, 포맷 등)만 적용하고 언어/프레임워크의 표준 관용구를 따른다.
- **문서와 이웃 파일의 패턴이 서로 다름**: 더 최근에 수정된 쪽(git log 기준)을 우선하고, 필요하면 사용자에게 어느 쪽이 맞는지 확인한다.
- **모노레포에서 서브패키지마다 컨벤션이 다름**: 루트 문서와 서브패키지 자체 문서(예: `packages/foo/CLAUDE.md`)가 둘 다 있으면 서브패키지 쪽이 더 구체적이므로 우선한다.

---

## B. 네이밍 컨벤션 일괄 변경 (예: PascalCase → kebab-case)

디렉토리(또는 파일)명을 다른 케이스 컨벤션으로 안전하게 일괄 변환하는 절차. import가 깨지지 않고, git 히스토리(rename 추적)도 보존한 채로 진행한다.

### B0. 사전 확인

- **무엇을 바꾸는지 범위를 명확히 한다**: 디렉토리명만 바꾸는지, 파일명도 포함하는지. 보통 컴포넌트/모듈은 `{new-name}/index.ts` 구조라 파일명(`index.ts`)은 안 바뀌고 디렉토리명만 바뀐다.
- **export/식별자 이름은 그대로 둔다**: 폴더명 변경과 그 폴더가 export하는 JS/TS 식별자(컴포넌트명, 함수명 등)는 별개다. 바꾸는 대상은 **경로 문자열**뿐이지 `export default Foo`의 `Foo` 자체가 아니다 (다른 케이스 컨벤션 규칙이 명시적으로 있지 않는 한).
- **public API 표면 확인**: `package.json`의 `exports` 필드처럼 외부에 노출된 subpath가 있다면, 그 키(`"./Foo"`)까지 바꾸면 breaking change가 된다. 내부 경로 값만 바꾸고 키는 유지할지, 아니면 키까지 포함해 의도적으로 breaking change를 낼지 사용자에게 확인한다.

### B1. 대상 디렉토리 목록화 (깊이 내림차순)

중첩된 디렉토리가 있으면 **가장 깊은 것부터** 처리해야 한다. 얕은 디렉토리를 먼저 리네임하면 그 하위 경로가 통째로 바뀌어서 이후 처리 대상 경로가 무효화된다.

```bash
find <root> -mindepth <N> -type d | awk -F'/' '{print NF, $0}' | sort -rn | cut -d' ' -f2-
```

### B2. 케이스 변환 함수

PascalCase/camelCase → kebab-case 예시:

```bash
to_kebab() {
  echo "$1" | perl -pe 's/([a-z0-9])([A-Z])/$1-$2/g; $_ = lc($_);'
}
```

`FloatButton` → `float-button`, `TextArea` → `text-area`, `ColorPicker` → `color-picker` 처럼 동작한다. 변환 결과가 원본과 같으면(이미 목표 컨벤션이면) 스킵한다. 다른 방향의 변환(kebab→camel 등)이 필요하면 같은 자리에 해당 변환 로직으로 바꿔 쓴다.

### B3. 대소문자만 다른 리네임은 2단계로 처리 (필수)

**Windows(NTFS)와 macOS(APFS 기본값)는 대소문자를 구분하지 않는 파일시스템**이라, `git mv Button button`처럼 대소문자만 다른 리네임은 "Permission denied" 또는 "이미 존재함" 에러로 실패하거나, 파일시스템 레벨에서 무시될 수 있다. 임시 이름을 경유해서 2번 이동한다:

```bash
git mv "$dir" "$parent/__tmprename__${base}"
git mv "$parent/__tmprename__${base}" "$parent/$kebab"
```

이걸 대소문자 변경이 포함된 모든 리네임에 일괄 적용하면 안전하다 (하이픈 추가만으로 이름이 달라지는 경우는 1단계로도 되지만, 구분해서 처리하느니 전부 2단계로 통일하는 게 간단하고 안전하다).

### B4. import/export 경로 일괄 수정

디렉토리를 다 옮기고 나면 상대 경로로 그 디렉토리를 참조하던 모든 `import`/`export ... from`/`require()` 문자열이 깨진다. 이름 기반 치환은 위험하다 — 예를 들어 `Button`을 아무 데서나 치환하면 `FloatButton`처럼 그 이름을 포함하는 **다른** 이름까지 잘못 건드릴 수 있다.

**경로 세그먼트 경계를 지키는 치환**을 쓴다: 슬래시(`/`)나 따옴표(`'`/`"`) 사이에 정확히 그 이름 하나만 있을 때만 바꾼다. Node 스크립트로 처리하는 걸 권장한다 (정규식 하나로 모든 `from '...'` / `require('...')`을 찾아, 경로를 `/`로 split한 뒤 각 세그먼트를 매핑 테이블과 정확히 일치할 때만 치환):

```js
const importRe = /(from\s+|require\()(['"])(\.[^'"]*)\2/g;
// 매치된 specifier를 '/'로 split → 각 세그먼트가 매핑 테이블에 있으면 교체 → 재조합
```

이 방식이면 이름 충돌(같은 leaf 이름이 여러 부모 아래 중복되는 경우 등)이나 부분 문자열 오염(`Button` vs `FloatButton`) 걱정 없이 안전하게 처리된다.

**주의**: 매핑 테이블은 이번에 실제로 리네임한 디렉토리 이름만 포함해야 한다. 우연히 같은 이름을 가진, 리네임 범위 밖의 다른 디렉토리(예: 컴포넌트 트리 밖의 provider 폴더)까지 잘못 바뀔 수 있으니, 스크립트 실행 후 typecheck에서 나오는 에러를 반드시 하나하나 확인한다.

### B5. 흩어진 하드코딩 경로 확인

`import`문 말고도 빌드 설정(`tsdown.config.ts`, `vite.config.ts`, `rollup` entry 등), `package.json`의 `exports`/`main`/`types`, 코드 제너레이터 템플릿에 리네임 대상 경로가 하드코딩돼 있을 수 있다. 저장소 전체에서 검색해서 놓친 게 없는지 확인한다.

### B6. 검증

- typecheck (`tsc -b` 등) — 대소문자 전용 파일시스템에서는 "Already included file name ... differs ... only in casing" (TS1261) 에러로 남은 불일치를 정확히 잡아준다. 이 에러 목록이 곧 안 고친 곳의 체크리스트다.
- lint, build까지 전체 실행해서 최종 확인한다.
- 스토리북 등 glob 기반 설정(`stories: ['../stories/**/*.stories.tsx']`)은 와일드카드라 대소문자 변경에 영향받지 않는다 — 별도 수정 불필요.

### B 엣지 케이스

- **같은 leaf 이름이 여러 부모 아래 중복됨** (예: `Item`이 `Menu/Item`, `List/Item`에 각각 존재): 이름 기반 매핑이라도 세그먼트 경계를 지키면 문제없다 — 어차피 같은 변환 함수를 적용하므로 결과가 항상 일관된다.
- **범위 밖인데 이름이 겹치는 디렉토리가 있음**: 매핑 테이블에 포함하지 말고, 혹시 스크립트가 잘못 건드렸으면 typecheck 에러로 발견해서 되돌린다.
- **public export 이름까지 바꿔야 하는지 애매함**: 추측하지 말고 사용자에게 breaking change 여부를 확인한다.

---

## C. 그룹화된/합성 컴포넌트의 배럴 파일 구조

부모 컴포넌트가 하나 이상의 하위 컴포넌트를 갖고 있고, 그 하위 컴포넌트들이 각자 서브디렉토리 + 자체 `index.tsx`로 흩어져 있는 경우("그룹화된" 컴포넌트)에 적용하는 구조 규칙. 이 저장소(`ui-kit`) 자신의 `packages/ui/src/components/atoms/input/`에서 이미 쓰이던 패턴이며, `live-editor` 저장소 전체(`src/components/*`, `src/pages/*`)에 실제 적용해서 검증됨.

### C0. 판별 기준

다음에 해당하면 이 패턴을 적용한다:

- 부모 디렉토리 안에 하위 컴포넌트가 각자 자기 이름의 서브디렉토리(`Boundary/`, `Core/`, `Field/` 등) 안에서 `index.tsx` 하나로만 구성되어 있음
- 하위 컴포넌트가 정적 프로퍼티로 부모에 합성되는 경우(`Input.Search`, `Error.Boundary` 등)든, 부모 내부에서만 쓰이는 구현 디테일이든(`Dnd`의 `Draggable`/`Droppable` 등), 직접 subpath로 import되어 쓰이는 것이든(`Editor.Tiptap`처럼 합성 안 되고 `~/components/editor/tiptap`으로 바로 쓰이는 경우) 상관없이 동일하게 적용
- 하위 컴포넌트 자체가 또 하위 컴포넌트를 가지면(예: `Dnd/Panel/Field` 등) 같은 패턴을 재귀적으로 적용 — `Panel` 자신도 하나의 "그룹"이 되어 자기만의 named file들 + 자기만의 `index.ts` 배럴을 가짐

### C1. 목표 구조

```
error/
  index.ts       ← 순수 배럴 — 아래 파일들 import해서 조합/재수출만 함, 자체 JSX/로직 없음
  error.tsx      ← 그룹 자신의 구현 (기존 Error/index.tsx의 실제 내용)
  boundary.tsx   ← 기존 Error/Boundary/index.tsx
  guard.tsx      ← 기존 Error/Guard/index.tsx
  runtime.tsx    ← 기존 Error/Runtime/index.tsx
```

정적으로 합성되는 하위 컴포넌트는 `index.ts`에서 `X.Y = Y` 형태로 조합 (이 저장소의 `input/index.ts`가 원조 예시):

```ts
// error/index.ts
import ErrorBoundary from './boundary';
import ErrorImpl, { type Props } from './error';
import ErrorGuard from './guard';
import ErrorRuntime from './runtime';

type ErrorComponent = typeof ErrorImpl & {
  Boundary: typeof ErrorBoundary;
  Runtime: typeof ErrorRuntime;
  Guard: typeof ErrorGuard;
};

const Error = ErrorImpl as ErrorComponent;

Error.Boundary = ErrorBoundary;
Error.Runtime = ErrorRuntime;
Error.Guard = ErrorGuard;

export { ErrorBoundary, ErrorRuntime, ErrorGuard };
export type { Props };
export default Error;
```

정적 합성 없이 그룹 자신의 구현만 재수출하면 되는 경우(하위 파일들은 그룹 내부에서만 import되거나, 다른 곳에서 직접 subpath로 import됨)는 배럴이 훨씬 단순해진다:

```ts
// frame/index.ts
export { default, type FrameProps } from './frame';
```

### C2. 핵심 규칙 — 구현 파일의 export 식별자는 바꾸지 않는다

옮겨진 구현 파일(`error.tsx` 등)은 원래 쓰던 export 식별자명을 그대로 유지한다 (`export default Error;`). 배럴에서만 import 시점에 별칭을 준다 (`import ErrorImpl from './error'`) — 이건 배럴 스코프 안에서 합성용 변수(`const Error = ...`)와 이름이 충돌하는 걸 피하기 위한 것일 뿐, 실제로 바뀌는 건 파일/디렉토리 경로뿐이고 export되는 식별자 자체는 하나도 바뀌지 않는다.

### C3. 구현 파일에서 하위 컴포넌트를 실제로 렌더링에 쓰는 경우

`Editor`의 경우 `Editor.Core = Core`로 합성도 되지만, `editor.tsx` 자신의 렌더링 로직 안에서도 `<Core ... />`를 실제로 사용한다. 이런 경우 구현 파일에서 하위 컴포넌트 import를 지우면 안 된다 — 배럴로 옮기는 건 **합성 대입문(`Editor.Core = Core;`)과 그 재수출**뿐이고, 구현에 실제로 필요한 import/사용은 구현 파일에 그대로 남긴다.

### C4. 실행 절차 (섹션 B 절차의 확장)

섹션 B(네이밍 일괄 변경)의 deepest-first / git mv / 경로-세그먼트 인식 치환 / typecheck 기반 검증 절차를 그대로 따르되, 각 그룹마다 다음을 추가한다:

1. 하위 컴포넌트들을 `git mv Parent/SubPart/index.tsx Parent/sub-part.tsx`로 부모 레벨까지 끌어올리고 kebab-case로 리네임 (한 번의 git mv로 이동+리네임 동시 처리됨)
2. 부모 자신의 `index.tsx`를 `git mv Parent/index.tsx Parent/parent-name.tsx`로 옮김
3. 옮겨진 부모 구현 파일에서 합성 대입문(`X.Y = Z;`)과 그로 인한 재수출(`export { Z };`)만 제거 — 실제 렌더링에 쓰이는 import/사용은 유지 (C3 참고)
4. 새 `index.ts` 배럴 작성 (C1 패턴)
5. 그룹 내부에서 서로를 상대경로로 참조하던 import들을 전부 수정 — 서브디렉토리 관계(`../Field`, `..`)가 이제 형제 관계(`./field`, `./error`)로 바뀌었기 때문에 특히 주의. 원래 `Error/Boundary/index.tsx`가 `import Error from '..'`로 부모를 참조하던 게, 평탄화 후엔 `import Error from './error'`가 되는 식 — 이걸 놓치면 부모 디렉토리 자체를 잘못 가리키게 되어 타입체크에서 잡힌다
6. 마지막으로 그룹 디렉토리 자체를 kebab-case로 리네임

### C5. 검증

섹션 B와 동일 — typecheck/lint/test/build, 그리고 각 `index.ts`를 직접 읽어서 원래 합성되던 정적 프로퍼티/재수출 타입이 전부 그대로 보존됐는지 눈으로 한 번 더 확인한다 (기계적 치환만으로는 놓치기 쉬운 부분).

### C 엣지 케이스

- **하위 컴포넌트가 실제로는 부모에 합성되지 않고 그냥 형제로만 서로 참조함** (예: `Dnd/Panel/Field`가 `Dnd/Panel/Children`을 import): 이것도 동일하게 평탄화 대상. "합성되는가"는 배럴이 조합 로직을 갖는지 여부만 결정하고, 평탄화 자체의 적용 여부와는 무관
- **파일에 JSX가 없는 하위 모듈** (예: `Context/states/index.tsx`처럼 `createContext`/`useContext`만 있는 경우): 확장자를 `.tsx` → `.ts`로 바꿔도 됨. 다른 곳에서 이 모듈을 배럴 경유가 아니라 직접 subpath(`~/components/context/states`)로 import해왔다면 그 관례는 그대로 유지 — 억지로 배럴에 재수출을 추가하지 않는다

---

## D. 재사용 가능한 UI/훅은 공유 라이브러리에 먼저 구현

새 컴포넌트/기능을 구현할 때, 그 안에 포함된 UI 요소나 훅이 지금 작업 중인 저장소를 넘어 재사용될 가능성이 있다면, 그 앱 저장소(`live-editor` 등)에 바로(inline) 구현하지 않고 **공유 라이브러리에 먼저 구현**한다 — UI 컴포넌트는 `ui-kit`, React 훅은 `use-hooks`. 거기서 머지/배포한 뒤, 앱 저장소는 그 패키지를 의존성으로 추가해서 가져다 쓴다.

### D0. 판단 기준

새 컴포넌트/훅을 만들기 전에 스스로 묻는다: "이게 지금 작업 중인 프로젝트 말고 다른 프로젝트에서도 쓸모가 있을까?"

- **그렇다 / 애매하다** → 공유 라이브러리 우선 경로를 기본값으로 제안한다 (아래 D1)
- **아니다, 이 앱의 특정 로직에 강하게 결합돼 있다** (예: `live-editor`의 AST 변환 내부 로직처럼 그 저장소의 도메인 자체) → 로컬 구현이 맞다. 억지로 추상화하지 않는다

일반적인 재사용성 신호:

- 순수 UI 프리미티브/합성 컴포넌트 (버튼, 입력, 피커, 레이아웃 등) → `ui-kit` 후보
- 특정 도메인 로직 없이 범용적인 상태/이벤트/브라우저 API 훅 (디바운스, 로컬스토리지, 히스토리 상태, 스크롤 등) → `use-hooks` 후보

### D1. 실행 순서

1. 공유 라이브러리(`ui-kit` 또는 `use-hooks`) 저장소로 가서 새 브랜치에 구현 (섹션 A대로 그 저장소의 기존 컨벤션을 먼저 파악하고 따른다)
2. 테스트/데모 페이지 등 그 라이브러리 자체의 기존 관례에 맞춰 추가
3. PR 올리고 머지 (changesets 기반 버전업 → npm 배포까지 필요하면 그 흐름도 완료됐는지 확인)
4. 그 다음에야 원래 작업하던 앱 저장소로 돌아와서, 방금 배포된 패키지 버전을 의존성으로 추가하고 가져다 쓴다
5. 앱 저장소 쪽 PR은 "라이브러리 X에 Y를 추가하고, 여기서는 그걸 가져다 쓴다"는 게 diff에 분명히 드러나야 한다 — 로컬 구현과 섞어서 한 PR에 욱여넣지 않는다

### D2. 실제 사례

`live-editor`에 undo/redo를 추가할 때(2026-07-28), `useHistoryState`라는 undo/redo 가능한 상태 훅이 필요했는데, `live-editor` 로컬에 바로 구현하는 대신:

- `use-hooks`에 `useHistoryState` 구현 → PR → 머지 → npm 배포 (`@jbpark/use-hooks` 새 버전)
- `live-editor`가 그 새 버전을 의존성으로 추가해서 `App.tsx`에서 가져다 씀
- 같은 세션에서, `live-editor`가 직접 구현해서 쓰던 `useDebounce`도 `use-hooks`의 기존 구현으로 교체

### D 엣지 케이스

- **공유 라이브러리에 이미 비슷한 게 있는데 완전히 똑같진 않음**: 새로 만들기 전에 기존 것을 확장/일반화할 수 있는지부터 검토한다.
- **급하게 먼저 써봐야 검증이 되는 경우**: 앱 저장소에 임시로 구현해서 프로토타이핑하는 것 자체는 막지 않지만, 검증되면 공유 라이브러리로 옮기는 후속 작업이 뒤따라야 한다 — "임시"가 영구적으로 로컬에 남지 않도록 사용자에게 후속 작업으로 남겨둔다.
- **어느 라이브러리로 가야 할지 애매함** (UI 컴포넌트인데 훅도 포함): UI 렌더링이 주된 산출물이면 `ui-kit`, 순수 로직/상태 관리가 주된 산출물이면 `use-hooks`. 둘 다 필요하면 분리해서 각각 해당 라이브러리에 넣는다.

---

## E. 주석 작성

주석은 **지금 코드를 처음 읽는 사람**을 위해 쓴다. 이 코드를 고친 당시의 리뷰어가 아니다. 과거에 무엇이 잘못됐고 어떻게 고쳤는지는 git 기록과 이슈에 이미 남아 있다. 영어가 모국어가 아닌 사람이나 번역 도구로 읽는 사람도 바로 이해할 수 있어야 한다.

### E1. 규칙

1. **무엇을 하는지 먼저** 1~2문장으로 쓴다. 이름과 코드만 봐도 분명하면 주석을 달지 않는다.
2. **이유는 코드만 보면 잘못 고치기 쉬울 때만** 쓴다. 과거 이야기가 아니라 지금 지켜야 할 제약을 현재형으로 쓴다 ("Don't add `onChange` here: a callback must come from the current render (#336).").
3. **과거 이야기는 이슈 번호 하나로** 대신한다. "used to", "previously", "the previous implementation", "before #N", "no longer", "any more" 같은 표현을 쓰지 않는다. `(#450)`이면 충분하다.
4. **평이한 단어와 짧은 문장**을 쓴다. 관용 표현("funnelled", "churn", "dead end", "for free")은 피한다.
5. **공개 API 주석은 완전하게 둔다.** props, 공개 인터페이스의 필드, 반환 타입 설명은 사용자를 위한 계약이므로 값, 기본값, 상호작용을 빠짐없이 쓴다. 과거 이야기만 뺀다.
6. **벤치마크 수치, 검토했다 버린 대안, 다른 파일의 옛 버전 이야기**는 주석에 남기지 않고 PR이나 이슈에 쓴다.

### E2. 예시 (live-editor #538)

```ts
// 전: 과거 이야기가 대부분이다
// Uncontrolled usage (`<Live.Dnd />` with no `value`) used to read
// nothing but DEFAULT_TEMPLATE forever: every edit committed through
// useSectionDocument writes into PreviewContext, but this component
// never read `code` back — so the section a reader just dragged in
// vanished on the very next render. ...
const value = _value === undefined ? code : _value;

// 후: 지금 무엇을 하는지
// The host's `value` when it passes one (controlled), otherwise the
// provider's code. An empty string counts as a value, as in `Live.Preview`.
const value = _value === undefined ? code : _value;
```

```ts
// 전: 이유를 이야기로 설명한다
// Deliberately no `onChange`: a callback belongs to the render that made
// it, not to the parse. Keeping the two in one memo is what caused #336 —
// editing another section leaves `selectedCode` ... identical, so the memo
// was reused and handed back callbacks still bound to the previous document ...

// 후: 지켜야 할 제약과 이슈 번호
// One entry per bound property, from `fields` alone. Don't add `onChange`
// here: a callback must come from the current render, and this memo can
// outlive it (#336).
```

### E3. 기존 주석을 다시 쓸 때

- **코드는 바꾸지 않는다.** 주석만 바꾸는 PR에 동작 변경을 섞지 않는다.
- **코드가 그대로인지 확인한다.** 수정 전후 파일을 주석 없이 트랜스파일해서 비교한다(예: TypeScript `transpileModule`에 `removeComments: true`). 출력이 같아야 한다.
- **실제 코드와 어긋난 주석은 이번에 고친다.** 다시 쓰다 보면 예전 버전을 설명하는 주석이 나온다. 코드를 읽고 지금 동작에 맞게 쓴다.
- **줄 수와 과거 이야기 표현 수를 전후로 세어** PR에 적는다.
- **영역 단위로 PR을 나눈다.** 한 PR에 리뷰할 수 있는 만큼만 넣는다.

### E 엣지 케이스

- **우회 코드(workaround)**: 외부 라이브러리 버그 때문에 이상해 보이는 코드는 이유를 남긴다. 다만 "무엇을 우회하는지"와 "없애도 되는 조건"을 현재형으로 쓰고, 발견 경위는 이슈로 보낸다.
- **이슈 번호가 없는 과거 이야기**: 이야기를 지우고 제약만 남긴다. 제약도 없다면 주석을 지운다.
- **저장소 언어**: 주석 언어는 저장소 관례를 따른다(이 저장소들은 영어). 한국어 설명이 필요하면 코드가 아니라 문서(`ARCHITECTURE.ko.md` 등)에 둔다.

---

## F. boolean 이름 짓기

boolean은 쓰이는 자리에 따라 이름 짓는 방식이 다르다. React 문서, React와 라이브러리가 돌려주는 값, 이 저장소의 공개 API가 모두 이 방식을 따른다.

### F1. 규칙

| 자리                       | 형태                                    | 예                                                                             |
| -------------------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| 값, 상태, 반환 객체의 필드 | `is`/`has`/`can`/`should` + 형용사·분사 | `const [isOpen, setIsOpen]`, `isMobile`, `hasError`, `useDndLayout().isMobile` |
| 컴포넌트 prop, HTML 속성   | 접두사 없는 형용사                      | `open`, `disabled`, `autoHeight`, `syncStyle`                                  |
| 판별 함수                  | `isX(value)`, `hasX(value)`             | `isComponentTagName(name)`, `isVisuallyHidden(style)`                          |

- prop은 `open`, 그 prop으로 만든 내부 상태는 `isOpen`으로 둔다. 이름이 겹치지 않으니 `_open`, `openProp` 같은 별칭이 필요 없다.
- prop이 처음 한 번만 쓰이는 초기값이면 `defaultOpen`처럼 `default` 접두사를 붙인다(React의 `defaultValue`, `defaultChecked`).
- `_`로 시작하는 이름은 "쓰지 않는 변수"로 남겨 둔다. ESLint의 `no-unused-vars`가 `^_`를 무시하도록 설정돼 있어서, 쓰는 변수에 `_`를 붙이면 나중에 안 쓰게 됐을 때 경고가 나오지 않는다.

### F 엣지 케이스

- **공개 API 이름은 바꾸지 않는다.** 규칙과 다른 공개 이름이 있어도 메이저 버전 전에는 그대로 두고, 내부 변수만 규칙을 따른다.
- **외부 라이브러리가 정한 이름**(dnd-kit의 `isOver`, `isDragging` 등)은 그대로 쓴다.
- **접두사 없는 이름이 boolean으로 읽히지 않을 때**(`empty`, `primitive`, `quoted`)는 특히 `is`를 붙인다. 값인지 boolean인지 이름만으로 알 수 있어야 한다.
- **기존 이름을 이 규칙에 맞추려고 일괄 변경하지 않는다.** 새로 쓰거나 고치는 코드에 적용한다. 일괄 변경은 사용자가 요청할 때만 한다.
