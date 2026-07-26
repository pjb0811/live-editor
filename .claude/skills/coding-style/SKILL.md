---
name: coding-style
description: "Repo-agnostic coding-conventions toolkit — a growing set of procedures for working consistently within any codebase. Currently covers: (A) discovering and following a project's existing directory structure and coding conventions before writing/editing code (checks CLAUDE.md/AGENTS.md, README/CONTRIBUTING, formatter/linter configs, and neighboring files); (B) safely renaming directories/files to a different naming convention (e.g. PascalCase to kebab-case) across a codebase without breaking imports or losing git history. Use when the user says '코딩 스타일대로', '컨벤션 맞춰줘', '이 프로젝트 스타일로', 'follow the project conventions', 'match the existing style', '케밥 케이스로 바꿔줘', '폴더명 리네임', 'rename directories to kebab-case', or before creating/editing a file in an unfamiliar repo without already having its conventions in context."
---

# Coding Style

저장소 전반에서 일관된 방식으로 코드를 다루기 위한 절차 모음. 여러 개의 독립된 하위 절차로 구성되며, 새로운 상황이 생기면 이 파일에 섹션을 추가해서 계속 확장한다.

- **A. 기존 컨벤션 파악하고 따르기** — 코드를 작성/수정하기 전에 항상 먼저 확인
- **B. 네이밍 컨벤션 일괄 변경** — 디렉토리/파일명 케이스 컨벤션을 바꿔야 할 때

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
