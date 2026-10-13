---
name: ast
description: 'Writing or changing code in src/utils/ast/: the module map (which file does what), the import direction between modules, and the rules for source-preserving edits, fragment wrapping, data-id, the extract caches and the public barrel. Use when changing the extract/update pipeline, fixing an AST bug, or adding a module there. To add a binding type or constraint end to end, use the binding-field skill.'
---

# Babel AST 변환 코드 작성

`src/utils/ast/`는 Canvas의 DnD/패널 편집 결과를 소스 코드 문자열에 반영하는 모듈입니다. 데이터 흐름과 AST 계층 전체는 [`ARCHITECTURE.ko.md`](../../../ARCHITECTURE.ko.md)에 있습니다.

`index.ts`는 공개 API만 재수출하는 **배럴**입니다. 새 로직은 역할에 맞는 모듈 파일에 넣고, 라이브러리 내부 코드는 배럴이 아니라 모듈 파일(`~/utils/ast/items` 등)에서 import합니다. 내부 helper는 배럴에 넣지 않습니다(#522). 공개 export가 바뀌면 `pnpm check-api-surface`가 실패하므로, 의도한 변경이면 `--update`로 스냅샷을 갱신해 함께 커밋합니다.

## 모듈 맵

| 상황                                                                      | 파일                                                                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 바인딩 선언 파싱(`parseBinding`, 필드 sanitize), 문자열로 다루는 타입     | `binding.ts`. 타입·필드를 추가할 때는 `binding-field` 스킬                                                |
| 특정 property에서 "현재 값" 읽기                                          | `binding.ts` (`getCurrentValue`, `getStructuredValue`)                                                    |
| raw JSX 문자열 → `DataAttrNode` 트리                                      | `extract.ts`                                                                                              |
| 패널 값 → 소스 반영                                                       | `update.ts` (`findBinding` → `checkEdit` → `editProperty`), 소스 편집기는 `edit-source.ts`                |
| AST에서 JS 값 읽기 (코드 실행 없이)                                       | `value.ts`                                                                                                |
| 객체·배열 값의 편집 가능한 리프 나열과 교체                               | `editable-value.ts`                                                                                       |
| JS 값 → AST 표현식·소스 텍스트                                            | `value-expression.ts`                                                                                     |
| 문서 파싱, 섹션 분리·편집, 미리보기 캐시                                  | `document.ts`                                                                                             |
| 자식 JSX 구간 편집 / 배열 아이템 편집 / 밀집 배열 구간                    | `children.ts` / `items.ts` / `array-source.ts`                                                            |
| 소스 구간 편집 적용                                                       | `patch.ts` (`SourceEdit`, `applyEdits`)                                                                   |
| 바인딩 값 검증                                                            | `validate.ts`                                                                                             |
| `data-id` 재발급, 노드 clone                                              | `tree.ts`                                                                                                 |
| 여러 단계가 쓰는 저수준 헬퍼 (`wrap`/`unwrap`/`attrValue`/`generateCode`) | `helpers.ts`. 한 곳에서만 쓰는 헬퍼는 사용처 파일에 둔다                                                  |
| JSX 태그 이름 해석 (`section`, `ui.Space`)                                | `jsx-name.ts` (`getJSXTagName`). `document.ts`가 `@babel/generator`를 끌어오지 않도록 `helpers.ts`와 분리 |
| 타입 정의                                                                 | `types.ts`                                                                                                |

## 의존 방향

화살표는 import 방향입니다. 순환 참조를 만들지 않습니다(환경 의존, 2026-10 확인).

```text
types, patch, jsx-name → (없음)
helpers → types
validate → types
value → helpers, types
value-expression → types
editable-value → value
binding → types, value
tree → helpers
document → jsx-name, patch, tree
array-source → patch, value
extract → binding, document, helpers, jsx-name, types, value
children → extract, helpers, patch, types
items → array-source, helpers, patch, types, value, value-expression
edit-source → binding, helpers, patch, types, value, value-expression
update → binding, children, document, edit-source, helpers, jsx-name, patch, types
```

다시 확인할 때(테스트·벤치 제외):

```bash
cd src/utils/ast && for f in $(ls *.ts | grep -v -E 'test|bench|index.ts'); do echo "${f%.ts} → $(grep -oE "from '\./[a-z-]+'" $f | sed "s/from '\.\///;s/'//" | sort -u | tr '\n' ' ')"; done
```

- `value.ts`(읽기)는 `editable-value.ts`나 `value-expression.ts`를 import하지 않습니다. `binding.ts`는 `value.ts`를 쓰고, 반대 방향은 없습니다.
- `traverse`는 `document.ts`가 내보내는 공용 바인딩을 씁니다. Babel CJS/ESM 상호 운용을 거기서 처리합니다.

## 작업 규칙

- **소스 보존 편집.** 공유·캐시 AST를 직접 변경하지 않는다. AST에서 위치를 찾고 `SourceEdit`/`applyEdits` 또는 기존 문서 구간 편집 함수로 원문을 고친다. 새 값이나 복제 조각에 필요한 코드만 생성하고, 바꾸지 않은 원문은 그대로 둔다. `children.ts`, `items.ts`, `array-source.ts`의 구조 편집도 원본 구간을 옮기거나 지우거나 복제하며, 모델로 표현할 수 없는 구조(희소·spread 배열 등)는 원본을 유지한 채 거부한다.
- **Fragment 래핑.** JSX 조각을 파싱하는 경로에서만 `wrap()`/`unwrap()`을 짝지어 쓰고 소스 오프셋도 보정한다. 전체 문서의 `parse()`나 단일 표현식의 `parseExpression()`에는 쓰지 않는다.
- **data-id 보존.** Canvas ↔ AST 매핑 키이므로 `extract`/`update` 어느 경로에서도 잃지 않는다.
- **extract 캐시.** `extract()`는 raw 문자열을 키로 캐시하고, `bindings`/`bindingKeys` 조합마다 캐시를 따로 둔다(#509, #513). 파싱 결과가 달라지는 변경이면 테스트에서 `clearExtractCache()`가 필요한지 본다. 이 함수는 `clearEditorCaches()`에도 등록돼 있다.
- **공개 API.** `index.ts`가 재수출하는 이름·타입을 이유 없이 바꾸지 않는다. `package.json`의 `./utils/ast` 서브패스가 이 배럴에 그대로 의존한다.
