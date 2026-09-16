---
name: ast
description: 'Babel AST 변환 코드를 작성하거나 src/utils/ast/ 모듈을 수정합니다. Use when: 새 바인딩 타입 추가, extract/update 파이프라인 수정, AST 관련 버그 수정 시.'
---

# Babel AST 변환 코드 작성

`src/utils/ast/`는 Canvas의 DnD/패널 편집 결과를 Babel AST 변환으로 소스 코드 문자열에 반영하는 핵심 모듈입니다.
`index.ts`는 로직 없이 아래 파일들의 export를 그대로 재수출하는 **배럴**이므로, 새 로직은 반드시 역할에 맞는 파일에 추가하고 `index.ts`는 건드리지 않습니다 (신규 public export를 추가하는 경우에만 배럴에 한 줄 추가).

## 모듈 맵 — 무엇을 고칠 때 어디를 보나

| 상황                                                                                      | 파일                                                                                    |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 새 `BindingType` 추가/바인딩 속성(label, property, options, render) 파싱 방식 변경        | `types.ts` (`BINDING_TYPES`) 및 `binding.ts` (`parseBinding`)                           |
| 특정 property에서 "현재 값"을 읽는 방식 변경 (예: richtext처럼 특수 속성에서 읽기)        | `binding.ts` (`getCurrentValue`)                                                        |
| raw JSX 문자열 → `DataAttrNode` 트리 변환 로직 (children/items 바인딩, fragment 처리 등)  | `extract.ts`                                                                            |
| 패널에서 입력한 값을 AST에 반영(write-back)하는 로직, 새 property 타입별 update 분기 추가 | `update.ts` (`update()`의 속성 분기 및 편집 헬퍼)                                       |
| JS 값 ↔ AST 리터럴(`t.StringLiteral` 등) 상호 변환                                        | `value.ts`                                                                              |
| `data-id` 재발급, 노드 clone                                                              | `tree.ts`                                                                               |
| 여러 파이프라인 단계가 공유하는 저수준 헬퍼 (`wrap`/`unwrap`/`attrValue`/`generateCode`)  | `helpers.ts` — 두 곳 이상에서 쓰지 않는 헬퍼는 여기 넣지 말고 사용처 파일에 로컬로 둔다 |
| 타입/인터페이스 정의                                                                      | `types.ts`                                                                              |

## 새 바인딩 타입을 추가하는 절차 (예: `richtext`)

1. `types.ts`의 `BINDING_TYPES`에 추가 (`BindingType`은 여기서 파생)
2. `binding.ts`의 Zod 스키마와 `parseBinding()`이 새 타입을 처리하는지 확인
3. 읽기 시 특수 처리가 필요하면 `binding.ts`의 `getCurrentValue()`에 분기 추가
4. 쓰기 시 특수 처리가 필요하면 `update.ts`에 소스 구간 편집 헬퍼를 추가하고 `update()`의 해당 속성 분기에서 호출
5. 패널 UI에서 새 타입을 렌더링해야 하면 `src/components/dnd/panel/field.tsx`에 분기 추가

## 의존 방향 (순환 참조 금지)

현재 내부 의존 관계의 주요 경로는 다음과 같습니다. 화살표는 import하는 방향입니다.

```text
value → helpers, types
binding → value, types
extract → binding, document, helpers, types, value
children → extract, helpers, patch, types
update → binding, children, document, helpers, patch, types, value
tree → helpers
```

- `binding.ts`는 `value.ts`를 사용합니다. 반대 방향의 import를 추가해 순환 참조를 만들지 않습니다.
- `document.ts`의 `traverse`는 Babel CJS/ESM 상호 운용을 처리한 공용 바인딩입니다.
- `document.ts`는 문서 파싱·섹션 편집·미리보기 캐시, `items.ts`는 배열 편집, `patch.ts`는 소스 구간 편집 적용, `validate.ts`는 바인딩 검증을 담당합니다.

## 작업 규칙

- **소스 보존 편집**: 공유·캐시 AST를 직접 변경하지 않는다. AST에서 위치를 찾고 `SourceEdit`/`applyEdits` 또는 기존 문서 구간 편집 함수로 원문을 수정한다. 새 값이나 복제 조각에 필요한 코드만 생성하며, 변경하지 않은 원문은 보존한다. `children.ts`의 구조 편집은 원본 JSX 구간을 이동·삭제·복제하고, 모델로 표현할 수 없는 구조는 원본을 유지하며 거부한다. `items.ts`/`array-source.ts`도 원본 구간을 편집한다. 희소/spread 배열의 값 수정은 원래 인덱스를 유지하고, 구조 변경은 무손실 거부한다.
- **Fragment 래핑**: JSX 조각을 래핑하는 경로에서는 `wrap()`/`unwrap()`을 짝지어 사용하고 소스 오프셋도 보정한다. 전체 문서의 `parse()`나 단일 표현식의 `parseExpression()`에는 일괄 적용하지 않는다.
- **data-id 보존**: Canvas ↔ AST 매핑 키이므로 `extract`/`update` 어느 경로에서도 유실되지 않도록 주의.
- **캐시 무효화**: `extract()`는 `extractCache`(raw 문자열 키)로 캐시된다. 캐시 키에 영향 없는 변경이면 무시해도 되지만, 파싱 로직 자체를 바꿨다면 관련 테스트에서 `clearExtractCache()` 호출이 필요한지 확인.
- **공개 API 유지**: `index.ts`가 재수출하는 이름/타입을 이유 없이 바꾸지 않는다 — `~/utils/ast`로 import하는 컴포넌트들과 `package.json`의 `./utils/ast` 서브패스 export가 이 배럴에 그대로 의존한다.

## References

- 프로젝트 개요: [`AGENTS.md`](../../../AGENTS.md)
- 데이터 흐름: `AGENTS.md`의 "핵심 데이터 흐름" 섹션
