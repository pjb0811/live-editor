---
name: component-naming
description: 'ui-kit에서 검증돼 이 저장소에 전면 적용된 컴포넌트 폴더/파일 네이밍 및 배럴 파일 규칙(kebab-case 폴더·파일 + PascalCase export + 서브컴포넌트 형제 파일 + 순수 배럴). Use when 서브컴포넌트 있는 새 컴포넌트를 추가할 때, 폴더/파일명 케이스를 정할 때, 배럴에서 서브컴포넌트를 합성할 때.'
---

# Component Naming (live-editor에 적용된 컨벤션)

이 문서는 [ui-kit](https://github.com/pjb0811/ui-kit)에서 검증된 컴포넌트 네이밍·배럴 파일 규칙이며, **이 저장소에 이미 전면 적용돼 있다.** 새 코드는 이 규칙을 그대로 따른다.

## 현재 상태 — 전 경로 kebab-case

`src/`, `demos/`, `website/src/`에 대문자로 시작하는 파일·디렉토리는 하나도 없다.

```
src/components/   context  dnd  dnd/panel  editor  error  frame  preview
src/pages/        editor
src/utils/        ast  tailwind
```

확인 명령 (출력이 비어야 정상):

```bash
git ls-files src demos website/src | tr '/' '\n' | grep -E '^[A-Z]' | sort -u
```

## 규칙

- 폴더/파일명: kebab-case (`use-section-document.ts`, `demo-frame.tsx`)
- export되는 컴포넌트/Props 식별자: **PascalCase 유지** — 폴더·파일명과 별개다. 리네임 대상은 경로 문자열뿐이고 `export default Error`의 `Error` 자체는 바꾸지 않는다
- 서브컴포넌트가 있는 조합 컴포넌트는 중첩 폴더 대신 같은 depth의 형제 파일 + 순수 배럴 `index.ts`로 구성:

```
error/
├── error.tsx      # 메인 구현
├── boundary.tsx   # 서브컴포넌트
├── guard.tsx
├── runtime.tsx
└── index.ts       # 순수 배럴, 구현 없음
```

- 배럴은 명시적 교차 타입 캐스팅으로 서브컴포넌트를 부착한다 (import된 바인딩에는 TS expando property가 안 먹혀서 `Main.Sub = Sub` 직접 대입은 `TS2339` 에러):

```ts
// src/components/error/index.ts — 실제 적용 예
import ErrorBoundary from './boundary';
import ErrorImpl, { type Props } from './error';

type ErrorComponent = typeof ErrorImpl & { Boundary: typeof ErrorBoundary };
const Error = ErrorImpl as ErrorComponent;
Error.Boundary = ErrorBoundary;
```

구현 파일(`error.tsx`)은 원래 export 식별자명을 그대로 둔다. 배럴에서만 import 시점에 별칭(`ErrorImpl`)을 주는데, 이는 합성용 변수 `const Error`와 이름이 겹치는 걸 피하기 위한 것뿐이다.

정적으로 합성되지 않고 내부에서만 쓰이거나 직접 subpath로 import되는 하위 파일(`editor/core.tsx`, `context/states.ts`)은 배럴을 거치지 않고 그대로 둔다.

## 관련

- 케이스 무관 일반 절차(기존 컨벤션 파악, 안전한 일괄 리네임)는 `coding-style` 스킬 참고. 리네임이 필요하면 B절차(2단계 `git mv` + 경로 세그먼트 경계 치환)를 따른다.
- 원본 규칙과 채택 배경: ui-kit `.claude/skills/component-naming/SKILL.md`.
