---
name: ast
description: 'Babel AST 변환 코드를 작성하거나 src/utils/ast/ 모듈을 수정합니다. Use when: 새 바인딩 타입 추가, extract/update 파이프라인 수정, AST 관련 버그 수정 시.'
---

# Babel AST 변환 코드 작성

`src/utils/ast/`는 Canvas의 DnD/패널 편집 결과를 Babel AST 변환으로 소스 코드 문자열에 반영하는 핵심 모듈입니다.
`index.ts`는 로직 없이 아래 파일들의 export를 그대로 재수출하는 **배럴**이므로, 새 로직은 반드시 역할에 맞는 파일에 추가하고 `index.ts`는 건드리지 않습니다 (신규 public export를 추가하는 경우에만 배럴에 한 줄 추가).

## 모듈 맵 — 무엇을 고칠 때 어디를 보나

| 상황                                                                                      | 파일                                                                                          |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 새 `BindingType` 추가/바인딩 속성(label, property, options, render) 파싱 방식 변경        | `binding.ts` (`parseBinding`) — 유효 타입 배열에도 추가                                       |
| 특정 property에서 "현재 값"을 읽는 방식 변경 (예: richtext처럼 특수 속성에서 읽기)        | `binding.ts` (`getCurrentValue`)                                                              |
| raw JSX 문자열 → `DataAttrNode` 트리 변환 로직 (children/items 바인딩, fragment 처리 등)  | `extract.ts`                                                                                  |
| 패널에서 입력한 값을 AST에 반영(write-back)하는 로직, 새 property 타입별 update 분기 추가 | `update.ts` (`update()`의 `switch (propertyBinding.property)` 및 `propertyBinding.type` 분기) |
| JS 값 ↔ AST 리터럴(`t.StringLiteral` 등) 상호 변환                                        | `value.ts`                                                                                    |
| `data-id` 재발급, 노드 clone                                                              | `tree.ts`                                                                                     |
| 여러 파이프라인 단계가 공유하는 저수준 헬퍼 (`wrap`/`unwrap`/`attrValue`/`generateCode`)  | `helpers.ts` — 두 곳 이상에서 쓰지 않는 헬퍼는 여기 넣지 말고 사용처 파일에 로컬로 둔다       |
| 타입/인터페이스 정의                                                                      | `types.ts`                                                                                    |

## 새 바인딩 타입을 추가하는 절차 (예: `richtext`)

1. `types.ts`의 `BindingType` union에 추가
2. `binding.ts`의 `parseBinding()` 내 유효 타입 배열(`['array', 'object', ..., 'richtext']`)에 추가
3. 읽기 시 특수 처리가 필요하면 `binding.ts`의 `getCurrentValue()`에 분기 추가
4. 쓰기 시 특수 처리가 필요하면 `update.ts`에 `updateXxx()` 헬퍼를 추가하고 `update()`의 해당 `switch` 분기(`property` 또는 `propertyBinding.type`)에서 호출
5. 패널 UI에서 새 타입을 렌더링해야 하면 `src/components/dnd/panel/field.tsx`에 분기 추가

## 의존 방향 (순환 참조 금지)

```
types.ts ← helpers.ts ← binding.ts, value.ts ← extract.ts ← update.ts
                                                  ↑
                                          tree.ts (helpers.ts만 의존)
```

- `update.ts`는 `extract.ts`의 `nodeToJSX`를 가져다 쓰지만, 반대 방향(`extract.ts`가 `update.ts`를 import)은 금지
- `binding.ts`/`value.ts`는 서로 의존하지 않는 leaf 모듈로 유지

## 작업 규칙

- **AST 불변 업데이트**: `traverse()` 콜백에서 노드를 직접 mutate한 뒤 항상 `generate()`로 새 코드 문자열을 뽑아 반환한다. 원본 `code` 문자열을 직접 조작하지 않는다.
- **Fragment 래핑**: 파싱 시 `wrap()`으로 `<>{code}</>` 감싸고, 출력 시 `unwrap()`으로 다시 벗긴다 (`helpers.ts`).
- **data-id 보존**: Canvas ↔ AST 매핑 키이므로 `extract`/`update` 어느 경로에서도 유실되지 않도록 주의.
- **캐시 무효화**: `extract()`는 `extractCache`(raw 문자열 키)로 캐시된다. 캐시 키에 영향 없는 변경이면 무시해도 되지만, 파싱 로직 자체를 바꿨다면 관련 테스트에서 `clearExtractCache()` 호출이 필요한지 확인.
- **공개 API 유지**: `index.ts`가 재수출하는 이름/타입을 이유 없이 바꾸지 않는다 — `~/utils/ast`로 import하는 컴포넌트들과 `package.json`의 `./utils/ast` 서브패스 export가 이 배럴에 그대로 의존한다.

## References

- 프로젝트 개요: [`AGENTS.md`](../../../AGENTS.md)
- 데이터 흐름: `AGENTS.md`의 "핵심 데이터 흐름" 섹션
