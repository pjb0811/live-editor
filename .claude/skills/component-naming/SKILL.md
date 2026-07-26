---
name: component-naming
description: "ui-kit에서 검증된 컴포넌트 폴더/export 네이밍 및 배럴 파일 규칙(kebab-case 폴더 + PascalCase export + 서브컴포넌트 배럴)을 이 저장소의 향후 목표 컨벤션으로 문서화 — 단, 이 저장소의 기존 컴포넌트 폴더는 전부 PascalCase라 실제 코드와 충돌함. Use when 서브컴포넌트 있는 새 컴포넌트를 추가할 때, 폴더명 케이스를 어떻게 할지 판단이 필요할 때. 기존 코드를 리네임하기 전에는 반드시 이 문서의 '기존 코드와의 충돌' 절을 먼저 읽는다."
---

# Component Naming (목표 컨벤션 — live-editor, 기존 코드와 충돌 있음)

이 문서는 [ui-kit](https://github.com/pjb0811/ui-kit)에서 실제로 적용/검증된 컴포넌트 네이밍·배럴 파일 규칙을 참고용으로 가져온 것이다.

## ⚠️ 기존 코드와의 충돌 — 반드시 먼저 읽을 것

이 저장소의 `src/components/**`, `src/pages/**`는 전부 **PascalCase 폴더** 컨벤션을 쓰고 있다 (`Context`, `Dnd`, `Dnd/Panel`, `Editor`, `Error`, `Frame`, `Preview`, `Playground` 등 — 예외는 `Context/states` 하나뿐, 이것도 원래 컨벤션에서 벗어난 오타성 예외로 추정).

`coding-style` 스킬의 원칙("이 저장소의 기존 패턴이 항상 우선한다")에 따라, **이 아래 kebab-case 규칙을 기존 PascalCase 컴포넌트에 소급 적용하지 않는다.** 사용자가 명시적으로 "케밥케이스로 전체 전환해줘" 같은 지시를 하기 전까지는:

- 기존 컴포넌트를 수정할 때는 그 컴포넌트가 속한 폴더의 기존 PascalCase 명명을 그대로 따른다.
- 새 컴포넌트를 추가할 때도 **주변 폴더와의 일관성**(PascalCase)이 우선한다 — 이 문서의 kebab-case 목표 컨벤션보다 앞선다.
- 이 문서는 "언젠가 이 저장소도 kebab-case로 전환하기로 결정하면 어떤 규칙을 쓸지"에 대한 참고 자료로만 존재한다. 실제 전환은 별도로 명시적인 사용자 요청이 있을 때만 진행한다 (`coding-style` 스킬의 B절차로).

## 참고용 목표 규칙 (전환 결정 시 적용)

- 폴더/파일명: kebab-case
- export되는 컴포넌트/Props 식별자: PascalCase 유지 (폴더명과 별개)
- 서브컴포넌트가 있는 조합 컴포넌트는 중첩 폴더 대신 같은 depth의 형제 파일 + 순수 배럴 `index.ts`로 구성:

```
some-thing/
├── some-thing.tsx  # 메인 구현
├── sub-part.tsx     # 서브컴포넌트
└── index.ts         # 순수 배럴, 구현 없음
```

- 배럴은 명시적 교차 타입 캐스팅으로 서브컴포넌트를 부착한다 (import된 바인딩에는 TS expando property가 안 먹혀서 `Main.Sub = Sub` 직접 대입은 `TS2339` 에러):

```ts
type MainComponent = typeof MainImpl & { SubPart: typeof SubPart };
const Main = MainImpl as MainComponent;
Main.SubPart = SubPart;
```

## 관련

- 케이스 무관 일반 절차(기존 컨벤션 파악, 안전한 일괄 리네임)는 `coding-style` 스킬 참고.
- 원본 규칙과 채택 배경: ui-kit `.claude/skills/component-naming/SKILL.md`.
