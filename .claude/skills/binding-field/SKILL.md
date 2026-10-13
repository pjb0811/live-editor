---
name: binding-field
description: "Adding a binding type (BINDING_TYPES) or a binding field/constraint (minLength, step, protocols, ...) to live-editor end to end: every file that has to change from parsing to validation, the built-in panel, messages, docs and the API snapshot, and the compatibility traps (a new key leaves meta, widening an output type breaks hosts, a new FieldKind breaks exhaustive switches). Use when adding or changing a BindingType, a BindingFieldSpec field or a validation rule, or when the user says '바인딩 타입 추가', '제약 조건 추가', 'add a binding type', 'add a constraint'."
---

# 바인딩 타입·필드 추가

바인딩 하나가 선언에서 패널까지 가는 길은 여러 파일에 걸칩니다. 하나라도 빠지면 타입 체크는 통과해도 필드가 조용히 사라지거나(`meta`로 가거나) 문서와 동작이 어긋납니다. AST 쪽 세부 규칙은 `ast` 스킬, 메시지 추가는 `ui-messages` 스킬, 검증 명령은 `verify` 스킬을 함께 봅니다.

경로와 이름은 환경 의존입니다(2026-10 확인, #632·#633 기준). 다시 확인할 때는 `git grep -n "KNOWN_BINDING_KEYS\|STRING_VALUED_TYPES\|toBindingFields\|getFieldKind" -- src`.

## 1. 타입인가, 제약인가, widget인가

먼저 무엇을 추가하는지 정합니다(#236).

- **타입**(`BINDING_TYPES`): 값이 어떤 데이터인가. 값 형식이나 검증·쓰기 방식이 다를 때만 추가합니다(`email`, `date`).
- **제약**(`BindingFieldSpec` 필드): 값이 지켜야 할 규칙(`maxLength`, `step`).
- **widget**: 어떻게 그리는가(`slider`, 이미지 선택기). 라이브러리는 읽지 않으므로 코드 변경이 없습니다. 타입으로 만들지 않습니다.

## 2. 고칠 곳

### 타입을 추가할 때

1. `src/utils/ast/types.ts`의 `BINDING_TYPES`.
2. 값이 문자열이면 `src/utils/ast/binding.ts`의 `STRING_VALUED_TYPES`. 빠뜨리면 숫자처럼 보이는 문자열이 숫자로 읽히고 써집니다.
3. 읽기·쓰기에 특수 처리가 필요하면 `binding.ts`의 `getCurrentValue`/`getStructuredValue`, `edit-source.ts`와 `update.ts`의 `editProperty`(`ast` 스킬).
4. 검증이 있으면 `src/utils/ast/validate.ts`. 메시지는 `ui-messages` 스킬.
5. 내장 컨트롤: `src/components/dnd/panel/field-kind.ts`의 `FieldKind`와 `getFieldKind`(순서가 곧 우선순위), `field.tsx`의 분기. placeholder가 필요하면 `messages.panel`.

### 필드(제약)를 추가할 때

1. `src/utils/ast/types.ts`의 `BindingFieldSpec`에 필드와 주석.
2. `binding.ts`의 `KNOWN_BINDING_KEYS`와 `sanitizeField`. `pick(schema, raw.x)`로 읽어서, 값이 잘못되면 그 필드만 빠지게 합니다.
3. `src/components/dnd/panel-binding.ts`의 `PanelBinding` 필드와 `toBindingFields`. `toBindingFields`의 반환 타입 때문에 빠뜨리면 타입 에러가 납니다.
4. `validate.ts`의 검사와 `ValidationMessages` 키.
5. 내장 패널이 써야 하면 `field.tsx`(입력 속성), 배열이면 `items.tsx`와 `useDndItems`.

### 둘 다

- **테스트**: `validate.test.ts`(통과·실패·메시지), `binding.test.ts`(유효한 값은 남고 잘못된 값은 그 필드만 빠짐), 컨트롤이 바뀌면 `field-kind.test.ts`와 `field.test.tsx`.
- **문서**: `website/docs/data-binding.mdx`(바인딩 필드 표, Types 표의 검증 열, Constraints), `website/docs/custom-palette-panel.mdx`(`PanelBinding` 표, `BindingType` 개수와 목록, `getFieldKind` 표).
- **API 스냅샷**: export 이름이 바뀌지 않으면 `pnpm check-api-surface`는 그대로 통과합니다. 타입에 필드만 늘어나는 것은 스냅샷에 나오지 않습니다.
- **changeset**: 보통 `minor`. 아래 함정에 해당하면 changeset에 적습니다.

## 3. 호환성 함정

- **새 키가 `meta`에서 빠진다.** 지금까지 알 수 없는 키는 `meta`로 갔습니다. 새 필드 이름과 같은 키를 쓰던 바인딩은 그 값이 `meta`에서 사라지고 제약으로 검사됩니다(#632의 `step`). 문서의 공통 `meta` 키(`description`, `hint`, `group`, `tab`, `visible`)와 겹치는 이름은 쓰지 않습니다.
- **출력 타입을 넓히지 않는다.** `PanelBinding`은 호스트 코드가 읽는 타입입니다. 기존 필드 타입을 넓히면(`min: number` → `number | string`) 그 값을 쓰는 호스트 코드가 깨집니다. 새 필드를 따로 둡니다(`minDate`, #632).
- **유니온이 늘어난다.** `BindingType`이나 `FieldKind`에 값을 더하면 호스트의 빠짐없는 `switch`가 타입 에러를 냅니다. minor로 내고 PR에 적습니다.
- **검증을 엄격하게 바꾼다.** 이미 통과하던 값을 실패시키면 `validateBindingValue`를 직접 부르는 호스트에 영향이 있습니다. 편집할 때만 검사하므로 기존 소스는 바뀌지 않는다는 점과 함께 changeset에 적습니다(#633의 `date`).
- **`pattern`은 부분 일치다.** 자동으로 `^…$`를 씌우면 기존 바인딩의 결과가 조용히 바뀌므로 하지 않습니다.
