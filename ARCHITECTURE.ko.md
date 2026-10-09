# 아키텍처

[English](./ARCHITECTURE.md) | [한국어](./ARCHITECTURE.ko.md)

이 문서는 Live Editor 자체를 고치는 사람을 위한 문서입니다. 문서가 어디에 있고, 어떻게 캔버스와 패널이 되고, 편집이 어떻게 소스로 돌아가는지, 코드의 각 단어가 무엇을 뜻하는지 설명합니다. 라이브러리 사용법은 [문서 사이트](https://live-editor-lab.vercel.app)를 보세요. 사이트의 [How It Works](./website/docs/how-it-works.mdx) 페이지는 같은 모델을 파일 경로 없이 설명합니다.

처음에는 순서대로 읽기를 권합니다. 각 절은 앞 절에서 정의한 용어를 씁니다.

1. [핵심 아이디어](#핵심-아이디어)
2. [용어집](#용어집)
3. [소스 지도](#소스-지도)
4. [문서는 누가 가지고 있나](#문서는-누가-가지고-있나)
5. [읽기 경로: 코드에서 캔버스와 패널까지](#읽기-경로-코드에서-캔버스와-패널까지)
6. [쓰기 경로: 세 단계의 commit](#쓰기-경로-세-단계의-commit)
7. [`Live.Dnd` 내부](#livednd-내부)
8. [AST 계층](#ast-계층)
9. [컴파일과 렌더링](#컴파일과-렌더링)
10. [에러, 문구, 캐시](#에러-문구-캐시)
11. [자주 하는 변경은 어디서 시작하나](#자주-하는-변경은-어디서-시작하나)
12. [알려진 거친 부분](#알려진-거친-부분)

## 핵심 아이디어

**중요한 상태는 소스 코드 문자열 하나뿐입니다.** 화면의 모든 것은 이 문자열에서 만들어지고, 모든 편집은 이 문자열을 바꾸는 일입니다.

- 캔버스는 컴포넌트 트리를 따로 들고 있지 않습니다. 코드가 바뀔 때마다 섹션을 코드에서 다시 읽습니다.
- 패널은 필드 값을 따로 들고 있지 않습니다. 선택된 섹션의 코드에서 읽습니다.
- 편집은 모델에서 코드를 다시 만들어 내지 않습니다. 값이 들어 있는 소스 구간을 정확히 찾아 그 구간만 바꿉니다. 그래서 주변의 포맷, 주석, 지원하지 않는 문법이 그대로 남습니다.

화면이 이상해 보이면, 거의 항상 "어떤 상태가 어긋났나?"가 아니라 "코드에 뭐라고 쓰여 있었고, 그걸 어떻게 읽었나?"를 물어야 합니다.

## 용어집

같은 영어 단어가 계층마다 다른 뜻으로 쓰입니다. 아래는 코드에서 실제로 쓰는 뜻입니다.

### 문서

| 용어                                | 뜻                                                                                                                                                                       | 위치                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| **Document** (문서)                 | 소스 문자열 전체. default export가 React 컴포넌트(보통 `App`)인 모듈입니다. `PreviewContext`의 `code`나 호스트의 `value`로 들고 있습니다.                                | `components/context/states.ts`                      |
| **Container** (컨테이너)            | 자식 `<section>`들이 편집 가능한 섹션이 되는 요소. id로 찾으며, `containerId`가 없으면 `app-container`입니다.                                                            | `constants/index.ts`의 `DEFAULT_CONTAINER_ID`       |
| **Section** (섹션)                  | 컨테이너 바로 안의 `<section>` 하나. 코드에서는 `Section { id, name, code }`이고, `id`는 `data-id`, `name`은 `data-name`(없으면 대체 이름), `code`는 그 JSX 소스입니다.  | `types/index.ts`                                    |
| **Section preview** (섹션 미리보기) | 컨테이너에 섹션 _하나만_ 넣은 문서. 캔버스의 각 칸이 자기 미리보기를 따로 컴파일하므로, 섹션 하나가 깨져도 나머지는 영향을 받지 않습니다.                                | `utils/ast/document.ts`의 `generateSectionPreviews` |
| **Problem** / **stale**             | 문서를 읽을 수 없는 이유(`parse-error` 또는 `container-not-found`). 파싱되지 않는 동안 캔버스와 패널은 *마지막으로 파싱된 버전*을 보여 주며 `stale`, 즉 읽기 전용입니다. | `inspectDocument`, `useSectionDocument`             |

### 요소와 바인딩

| 용어                 | 뜻                                                                                                                                                                                                                                                                                                                                          | 위치                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **`data-id`**        | 요소의 식별자. 미리보기의 DOM 요소와 소스의 JSX를 연결하며, 모든 편집이 이 주소로 대상을 찾습니다. 섹션은 모두 고유한 id를 받습니다(`fillSectionIds`). 섹션 안에서는 비어 있는 `data-id=""`를 섹션 id를 바탕으로 결정적으로 채우므로(`fillIdsFrom`) 캔버스와 패널이 같은 id를 봅니다. `data-id` 속성이 아예 없는 요소는 편집할 수 없습니다. | `utils/ast/tree.ts`                               |
| **Node** (노드)      | `DataAttrNode`. `extract()`가 읽은 JSX 요소 하나로, 태그 이름·속성·텍스트·자식·해석된 바인딩을 담습니다. DOM 노드가 아닙니다.                                                                                                                                                                                                               | `utils/ast/types.ts`                              |
| **Binding** (바인딩) | `BindingItem`. 요소의 _property_ 하나를 편집할 수 있다는 선언으로, `label`, `type`, 제약 조건을 가집니다. 요소의 `data-binding` → `data-binding-key`가 가리키는 `bindingKeys` 항목 → 컴포넌트의 `bindings` 항목 순으로 찾습니다.                                                                                                            | `utils/ast/binding.ts`의 `resolveBindings`        |
| **Property**         | 바인딩이 편집하는 대상. 속성 이름(`src`, `title`, `data-size`)이거나 네 가지 특별한 이름 `innerText`, `innerHTML`, `children`, `items` 중 하나입니다.                                                                                                                                                                                       | `constants/index.ts`의 `BINDING_PROP`             |
| **Panel binding**    | `PanelBinding`. 패널용으로 펼친 바인딩 하나로, 현재 `value`, 소스 텍스트 `rawValue`, 그리고 commit하는 `onChange`를 가집니다. `useDndPanel().bindings`가 돌려주는 것이 이것입니다.                                                                                                                                                          | `components/dnd/panel-binding.ts`                 |
| **Field** (필드)     | 패널이 panel binding 하나에 그리는 컨트롤. `getFieldKind`가 종류(텍스트, 숫자, 색상, Items 편집기 등)를 고르고, `renderField`로 바꿀 수 있습니다.                                                                                                                                                                                           | `components/dnd/panel/field.tsx`, `field-kind.ts` |

### "item"은 네 가지 뜻입니다

공개 API는 "item"을 서로 다른 네 가지에 씁니다. 내부 코드는 그중 첫째와 넷째를 "section"이라고 부르며, 공개 이름은 major 버전 전까지 그대로 둡니다.

| 보이는 곳                                                               | 뜻                                                                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `Live.Dnd`의 `items` prop, `DndPalette.items`, `Live.Dnd.DraggableItem` | **팔레트 항목**: 캔버스로 끌어 놓는 섹션 템플릿. 타입은 `Section`. 내부에서는 `PALETTE_SECTIONS`. |
| `BindingItem`                                                           | **바인딩** (위 참고).                                                                             |
| `useDndItems`, `Items`, `SortableItems`, `items.ts`, `items` property   | **배열 항목**: 필드에 바인딩된 배열 리터럴의 원소 하나.                                           |
| `DndPanel.item`                                                         | **선택된 섹션**.                                                                                  |

### 그 바깥의 편집기

| 용어                       | 뜻                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Provider**               | `Live` / `ContextProvider`. 문서(`PreviewContext`), 마지막 에러(`ErrorContext`), UI 문구(`MessagesContext`)를 들고 있으며, 모든 화면이 여기서 읽습니다.             |
| **Region** (영역)          | `Live.Dnd`의 세 영역: 팔레트, 캔버스, 패널. 커스텀 레이아웃이 이들을 배치하고, 커스텀 팔레트와 패널은 `useDndPalette()` / `useDndPanel()`로 같은 데이터를 읽습니다. |
| **Commit**                 | 새 문서를 쓰는 일. 호스트의 `onChange`와 provider의 `setCode`로 보냅니다. 모든 편집은 commit으로 끝납니다.                                                          |
| **Edit error** (편집 에러) | `DndEditError`. 편집기가 거절한 편집으로, 번역된 `title`과 `description`을 가집니다. `onEditError`로 가거나, 없으면 기본 toast로 표시됩니다.                        |
| **Module**                 | `compile()`의 결과 `{ exports, error? }`.                                                                                                                           |
| **Frame**                  | 컴포넌트가 렌더링되는 곳: iframe, shadow root, 또는 제자리. DOM/CSS 격리용이며 보안 경계가 아닙니다.                                                                |

## 소스 지도

```text
src/
├─ index.tsx            패키지 진입점: `Live`와 그 정적 멤버
├─ constants/           DATA_ATTR, BINDING_PROP, DEFAULT_TEMPLATE; palette-sections.ts는 기본 팔레트 섹션
├─ types/               Section, Module
├─ components/
│  ├─ context/          provider: 문서, 에러, UI 문구
│  ├─ editor/           Live.Editor — CodeMirror 화면, provider로 debounce해서 반영
│  ├─ preview/          Live.Preview — 문서 전체를 컴파일하고 렌더링
│  ├─ frame/            iframe / shadow / 제자리 컨테이너, 스타일 동기화, 자동 높이
│  ├─ error/            Live.Error — 에러 박스, React error boundary, window 에러 guard
│  └─ dnd/              Live.Dnd ("Live.Dnd 내부" 참고)
│     ├─ canvas/        섹션 칸: 드롭 영역, 정렬, renderer, fallback, overlay
│     ├─ palette/       드래그할 수 있는 팔레트 섹션과 그 드래그 데이터
│     ├─ state/         훅: 섹션 문서, 키보드, 요소 picker, 삭제
│     └─ panel/         기본 패널과 필드 편집기들
└─ utils/
   ├─ compile.ts        Babel 변환 + `new Function`, LRU 캐시
   ├─ sections.ts       AST 계층 위의 섹션 헬퍼 (extractSections, createDocument 등)
   ├─ ast/              JSX 소스 읽기와 편집 ("AST 계층" 참고)
   └─ tailwind/         미리보기용 Tailwind CSS 생성
```

의존 방향은 한쪽입니다. `components/*`가 `utils/*`를 쓰고, 반대는 없습니다. `utils/`는 일반 Node에서 불러올 수 있어야 해서 UI kit을 import하지 않습니다. UI kit은 Node가 불러올 수 없는 스타일시트를 import하기 때문입니다. CI가 이를 확인합니다(`check-node-entries`).

## 문서는 누가 가지고 있나

```text
                 ┌──────────────────────────────┐
                 │  Provider (PreviewContext)   │
                 │  code ── setCode             │
                 └──────────────────────────────┘
                    ▲    │           ▲    │          │
       debounce     │    │ draft가   │    │ value    │ code
       반영         │    ▼ 따라감    │    ▼          ▼
                 Live.Editor      Live.Dnd        Live.Preview
                                  commit ──► 호스트 onChange (controlled일 때)
```

- **Provider**는 `code` 문자열 하나를 들고 있습니다. `setCode`는 같은 업데이트에서 마지막 에러도 지우므로, 고친 문서에 예전 에러가 남지 않습니다.
- **`Live.Editor`**는 타이핑이 바로 보이도록 로컬 draft를 두고, `debounce` ms 뒤(또는 blur, 저장, unmount 때) provider에 반영합니다. provider가 다른 곳에서 바뀌면 uncontrolled 편집기의 draft가 따라갑니다.
- **`Live.Dnd`**는 호스트가 `value`를 주면 그것을(controlled), 아니면 provider의 `code`를 읽습니다. 모든 commit은 호스트의 `onChange`와 `setCode` 양쪽으로 갑니다.
- **`Live.Preview`**는 `code` prop을, 없으면 provider의 `code`를 읽습니다.

그래서 어디에도 `value`가 없으면 세 화면은 provider만으로 동기화됩니다. `value`가 있으면 문서의 주인은 호스트이고, provider는 다른 화면으로 가는 통로입니다.

## 읽기 경로: 코드에서 캔버스와 패널까지

새 문서 문자열이 화면에 나타나기까지 일어나는 일입니다. 여기 있는 것은 모두 순수한 파생 계산이며, 코드가 바뀔 때 다시 계산하고 비싼 곳은 캐시합니다.

```text
문서 문자열
  │  fillSectionIds          모든 섹션에 고유한 data-id 부여 (아직 소스에 쓰지 않음)
  │  inspectDocument         파싱되나? 컨테이너가 있나? → ok | problem
  │                          (파싱 에러 → 마지막으로 파싱된 버전을 계속 보여 줌)
  ▼
extractSections              → Section[] { id, name, code }
  │
  ├─► 캔버스, 섹션마다
  │     createSectionPreviewCache   컨테이너에 이 섹션만 넣은 문서,
  │                                 id는 fillIdsFrom(section.code, section.id)로 채움
  │     Renderer → useCompiledModule → compile()   Babel + new Function
  │     Frame (iframe / shadow / 없음) → 섹션의 React 트리
  │
  └─► 패널, 선택된 섹션에 대해
        fillIdsFrom(section.code, section.id)       캔버스와 같은 id
        extract(code, bindingOptions)               → 바인딩이 붙은 DataAttrNode[]
        resolvePanelBindings                        → PanelBinding[] (value, rawValue)
        withPanelCommit                             + 각각의 onChange
        useDndPanel().bindings → Panel → Field      getFieldKind가 컨트롤을 고름
```

이 구조가 동작하는 이유는 두 가지입니다.

- **양쪽이 id를 같은 방식으로 채웁니다.** 캔버스 미리보기와 패널은 비어 있는 `data-id=""`를 섹션 id와 요소 위치로 똑같이 채웁니다. 그래서 미리보기에서 요소를 클릭하면(요소 picker), 편집으로 id가 소스에 쓰이기 전에도 그 요소의 필드를 찾을 수 있습니다.
- **섹션 미리보기는 각각 별도의 문서입니다.** 각 칸은 컨테이너에 자기 섹션만 넣은 문서 전체를 컴파일합니다. 그래서 컨테이너 밖의 import와 헬퍼 컴포넌트가 그대로 동작하고, 바뀌지 않은 섹션은 같은 문자열이 나와 `React.memo`가 건너뛰며, 에러는 그 칸 안에 머뭅니다.

파일: `components/dnd/state/use-section-document.ts`(앞부분), `components/dnd/state/use-section-editing.ts`(`fields` memo), `components/dnd/canvas/renderer.tsx`, `components/dnd/panel-binding.ts`, `utils/ast/document.ts`, `utils/ast/extract.ts`.

## 쓰기 경로: 세 단계의 commit

편집은 항상 새 문서 문자열로 끝나지만, 시작하는 단계는 세 가지입니다. 각 단계는 자기 편집을 바로 위 단계의 입력으로 바꿉니다.

```text
③ 값 단계            Items / Children 편집기
   useDndItems         items.ts가 배열 리터럴의 소스를 편집
   useDndChildren      변경을 children 편집으로 기술
        │  binding.onChange(새 값)
        ▼
② 섹션 단계          필드, 또는 onNodeChange / onNodesChange
   commitChanges       updateAll(섹션 코드, 변경들)
                         update()가 data-id로 요소를 찾고,
                         바인딩을 맞춘 뒤 소스 구간을 돌려줌;
                         applyEdits가 그 구간만 씀
        │  patch({ ...section, code })
        ▼
① 문서 단계          팔레트 드롭, 이동, 복제, 삭제, 순서 변경, 또는 위의 ②
   useSectionDocument.commit
                       replaceSections → fillSectionIds
        │
        ▼
   호스트 onChange(next) + provider setCode(next)
```

### ① 문서 단계 — `useSectionDocument`

`components/dnd/state/use-section-document.ts`는 섹션 목록과, 섹션 소스 목록을 다시 문서로 만드는 `commit` 함수 하나를 가지고 있습니다. 모든 섹션 작업(`add`, `remove`, `copy`, `move`, `reorder`, `patch`)은 같은 `commit`에 다른 목록을 넘기는 것입니다.

- **stale이면 거절합니다.** 문서가 파싱되지 않으면 모든 작업이 commit 대신 `onBlockedEdit`를 부릅니다. 쓰려는 섹션 구간이 현재 소스가 아니라 마지막으로 파싱된 버전의 것이기 때문입니다.
- **같은 tick의 commit.** 한 이벤트 안의 두 commit은 같은 렌더의 문서에서 시작합니다. `pendingRef`가 마지막 commit의 결과를 기억해서, 두 번째가 첫 번째를 덮어쓰지 않고 그 위에 쌓습니다(#450). `getCommittedSection`이 이것을 ② 단계에 알려 줍니다.
- **id는 commit할 때만 씁니다.** 문서를 열기만 해서는 작성자의 코드가 바뀌지 않습니다. 채운 id는 첫 실제 편집과 함께 소스에 들어갑니다.

### ② 섹션 단계 — `commitChanges`

`components/dnd/state/use-section-editing.ts`에 있습니다. 패널 편집 하나, 또는 하나의 commit으로 묶인 여러 편집(`onNodesChange`)이 선택된 섹션 코드에 대한 `updateAll` 호출이 됩니다. `update()`(`utils/ast/update.ts`)는 다음 순서로 동작합니다.

1. 섹션을 파싱하고 `data-id`가 맞는 요소를 찾습니다.
2. `findBinding`: 그 요소의 바인딩을 `extract`와 같은 세 출처에서 해석하고, `property`(없으면 `label`)가 맞는 것을 찾습니다.
3. `checkEdit`: 편집기가 관리하는 속성이거나 필수 속성을 지우려는 편집을 거절합니다.
4. `editProperty`: 그 property의 편집기(`edit-source.ts`)를 실행합니다: `innerText`, `innerHTML`(또는 richtext), `children`, 또는 속성(수정, 추가, 삭제).
5. 각 편집기는 바뀐 트리가 아니라 **바꿀 소스 구간**을 돌려줍니다. `applyEdits`(`utils/ast/patch.ts`)가 그 구간만 원본 텍스트에 씁니다.

거절된 편집은 `reason`이 있는 `UpdateFailure`를 돌려줍니다. `describeUpdateFailure`가 이것을 편집 에러의 제목과 설명으로 바꿉니다.

### ③ 값 단계 — Items와 Children

어떤 값은 그 자체로 구조를 가집니다. `items` 값은 배열 리터럴이라 행을 이동·복제·추가·삭제할 수 있고, `children` 값은 요소의 JSX 자식입니다.

- **`useDndItems`**(`components/dnd/panel/use-dnd-items.ts`)는 배열을 파싱하고, 편집을 거쳐도 유지되는 식별자(`item-identity.ts`)를 각 행에 주고, 각 동작을 배열 소스의 편집으로 바꿉니다(`utils/ast/items.ts`, `array-source.ts`). 새 배열 소스는 바인딩의 `onChange`, 즉 ② 단계로 갑니다.
- **`useDndChildren`**(`components/dnd/panel/use-dnd-children.ts`)는 동작(이동, 복제, 삭제, 추가)과 대상을 기술해서 `children` property의 값으로 ② 단계에 보냅니다. `update()`는 이것을 `editChildrenSource`(`utils/ast/children.ts`)에 넘기고, 이 함수는 현재 소스와 대조한 뒤에 적용합니다.
- **중첩 바인딩.** 배열 항목 안의 JSX(`{ label: <b data-id="x" ... /> }`)는 최상위 `extract()`에 보이지 않습니다. `extract()`는 속성 값 안으로 들어가지 않기 때문입니다. Items 편집기가 그 JSX를 다시 extract하고, 그 필드를 `data-id`로 `onNodeChange`를 통해 commit합니다(#308).

## `Live.Dnd` 내부

`components/dnd/dnd.tsx`가 중심입니다. 자기 문서 상태는 없습니다. 상태를 가진 훅들을 부르고, 평범한 데이터 객체 세 개를 만들어 context로 영역에 넘깁니다.

```text
Dnd (dnd.tsx)
├─ useSectionDocument   섹션, 미리보기, 선택, 문서 단계 commit           (위의 ①)
├─ useDeleteFlow        onBeforeDelete에 물어본 뒤 삭제
├─ useDndKeyboard       센서, 키보드 이동, 스크린 리더 안내
├─ useInspectorState    요소 picker: hover 강조, 선택 → 섹션 선택 + onNodePick
├─ useEditErrors        편집 에러를 어디로 보낼지와 그 문구
├─ useSectionEditing    fields memo(읽기 경로)와 commitChanges(위의 ②)
│
├─ palette = { items, onAdd }                     ┐
├─ panel   = { item, bindings, onNodeChange, ... }├─ DndRegionContext → useDndPalette / useDndPanel / useDndLayout
├─ canvas  = <Droppable> + <Sortable> + <Renderer>┘
│
├─ DndEditOptionsContext   renderField, reportError, bindingOptions (Field, useDndItems가 읽음)
├─ DndInspectorContext     요소 picker 상태 (useDndInspector)
├─ SectionFallbackContext  renderSectionFallback
└─ children ?? <Layout />  기본 Palette / Canvas / Panel 배치
```

- **공개 타입은 컴포넌트와 따로 있습니다.** `DndPanel`, `DndPalette`, props는 `types.ts`에, `PanelBinding`과 commit 콜백은 `panel-binding.ts`에 있습니다. 타입이 필요한 파일은 `dnd.tsx`가 아니라 거기서 가져옵니다.
- **컴포넌트가 아니라 데이터를 넘깁니다.** 기본 팔레트와 패널도 커스텀 구현과 똑같이 `useDndPalette()`, `useDndPanel()`로 읽습니다. 그래서 공개 API가 기본 구현이 쓰는 것보다 뒤처질 수 없습니다(#237).
- **영역은 배치만 담당합니다.** `Live.Dnd.Palette`, `Canvas`, `Panel`(`layout.tsx`)은 영역의 내용을 필요한 컨테이너로 감쌀 뿐입니다. 커스텀 레이아웃은 자기 `children`을 넘기고, 드래그 context 안이라면 어디든 배치할 수 있습니다.
- **드래그 앤 드롭**은 `@dnd-kit`입니다. 팔레트 섹션은 `palette/palette-drag.ts`의 드래그 데이터를 싣고, 모든 곳이 이를 `paletteSectionOf`로 읽습니다. `onDragEnd`가 이를 `add`로, 캔버스 안의 드래그는 `reorder`로 바꿉니다. 끌고 있는 섹션은 `canvas/overlay.tsx`가 그립니다.
- **패널**(`panel/panel.tsx`)은 `bindings`를 요소별로 묶고 각각 `Field`를 그립니다. `Field`는 먼저 `renderField`에 묻고, 없으면 `getFieldKind`로 분기하는 `BuiltinField`를 씁니다. `items`와 `children` 편집기는 중첩된 값마다 `Field`를 다시 그리므로, `field.tsx`와 `items.tsx`, 그리고 `field.tsx`, `children.tsx`, `node.tsx`는 서로를 일부러 import합니다. `src`의 import 순환은 이것뿐이며, `FieldProps` 같은 공유 타입은 `panel/types.ts`에 두어 순환이 늘지 않게 합니다.

## AST 계층

`utils/ast/`는 `@babel/standalone`으로 JSX 소스를 읽고 편집합니다. 파일은 파이프라인 순서를 따릅니다.

| 단계 | 파일                                                             | 하는 일                                                                                                                      |
| ---- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 공용 | `types.ts`, `helpers.ts`, `jsx-name.ts`                          | 타입; `wrap`/`unwrap`(JSX 조각을 프로그램으로 파싱하고 되돌림), `generateCode`; 작성된 그대로의 태그 이름                    |
| 문서 | `document.ts`, `tree.ts`                                         | 문서 파싱(캐시), 컨테이너와 섹션 찾기, 섹션 목록을 다시 끼워 넣기, 섹션 미리보기 만들기; `data-id` 채우기와 교체             |
| 읽기 | `extract.ts`, `binding.ts`, `value.ts`, `editable-value.ts`      | JSX → `DataAttrNode[]`; 바인딩 해석과 파싱; 코드를 실행하지 않고 리터럴 값 읽기; 객체·배열 값의 편집 가능한 리프 나열과 교체 |
| 쓰기 | `update.ts`, `edit-source.ts`, `value-expression.ts`, `patch.ts` | 요소와 바인딩 찾기, 편집 확인, 소스 구간 만들기(값에서 표현식 만들기 포함), 적용하기                                         |
| 구조 | `items.ts`, `array-source.ts`, `children.ts`                     | 나머지를 바이트 단위로 그대로 두고 배열 리터럴과 JSX 자식 편집                                                               |
| 검사 | `validate.ts`                                                    | `validateBindingValue`: required, min/max, pattern, url, date                                                                |

이 계층의 모든 변경이 따르는 규칙입니다([AST 스킬](./.github/skills/ast/SKILL.md)에도 있습니다).

- **공유되거나 캐시된 AST를 직접 바꾸지 않습니다.** 파싱 결과는 캐시되므로, 구간을 기록하고 텍스트를 고칩니다.
- **다시 생성하지 말고 구간을 편집합니다.** 바뀌는 바이트만 새로 씁니다. 요소나 섹션 전체를 다시 생성하면 포맷이 바뀌고 주석이 사라집니다.
- **추측하지 말고 거절합니다.** 안전하게 편집할 수 없는 형태(spread, 빈 자리, 계산된 값)이면 실패를 돌려주고 소스를 그대로 둡니다. 지원 범위는 [Editable Syntax](./website/docs/editable-syntax.mdx) 페이지에 있습니다.
- **JSX 조각을 파싱할 때만 `wrap()`과 `unwrap()`을 짝지어 씁니다.**
- **배럴이 아니라 모듈 파일을 import합니다.** `utils/ast/index.ts`는 공개 API만 담은 공개 진입점입니다. 라이브러리 코드는 `./update`, `./extract` 등을 직접 import하므로 내부 helper를 export할 필요가 없습니다. `check-api-surface`가 공개 export를 스냅샷과 비교합니다.

## 컴파일과 렌더링

```text
code ─► compile(code, modules)          utils/compile.ts
          Babel: typescript? + env + react → CommonJS
          new Function(exports, require, module, React)
          require: 'react', 'ui-kit', 'ui-kit/utils', 또는 `modules`의 키
        ─► Module { exports.default: Component } 또는 { error }
        ─► Frame                        components/frame/
             iframe: iframe 문서로 portal, 호스트 스타일 복사,
                     내용에 맞춰 높이 조절
             shadow: shadow root로 portal
             없음:   제자리에서 렌더링
        ─► 컴포넌트를 Error.Boundary + Error.Guard로 감쌈
```

- **코드는 호스트 페이지의 JavaScript realm에서 실행됩니다.** iframe은 portal로 렌더링 결과만 받습니다. DOM과 CSS를 격리할 뿐 JavaScript는 격리하지 않으니, 신뢰할 수 있는 코드만 실행하세요.
- `compile()`은 코드와 각 모듈의 identity를 키로 최대 50개까지 캐시합니다. 모듈 구현이 바뀌면 새 `modules` 객체를 넘기세요.
- `Live.Preview`는 문서 전체를 한 번 컴파일합니다(`preview/client.tsx`). `Live.Dnd`는 칸마다 섹션 미리보기를 하나씩 컴파일합니다(`dnd/canvas/renderer.tsx`). 둘 다 `useCompiledModule`을 쓰며, 이 훅이 호스트의 `modules`에 기본 모듈(`preview/base-modules.ts`)을 더합니다.

## 에러, 문구, 캐시

**에러**는 누가 대응할 수 있느냐에 따라 다른 곳으로 갑니다.

| 실패한 것                               | 표시 방식                                    | 코드                                    |
| --------------------------------------- | -------------------------------------------- | --------------------------------------- |
| 미리보기 컴파일                         | 에러 박스, `messages.errors.compile`         | `preview/client.tsx`                    |
| 미리보기의 렌더링이나 이벤트 핸들러     | 에러 박스; `ErrorContext`에도 기록           | `error/boundary.tsx`, `error/guard.tsx` |
| 캔버스 섹션 하나 (컴파일, 렌더링, 강제) | 그 칸에만, 또는 `renderSectionFallback`      | `dnd/canvas/renderer.tsx`               |
| 편집기가 거절한 편집                    | `DndEditError` → `onEditError`, 없으면 toast | `dnd/edit-options.ts`                   |

**UI 문구**는 `components/context/messages.ts`에 있습니다. 화면에 보이거나 스크린 리더가 읽는 모든 문자열은 `useLiveMessages()`에서 옵니다. 새 문구를 추가하려면 거기와 `src/pages/shared/ko-messages.ts`에 키를 넣어야 합니다. 이 파일은 전체 타입으로 지정돼 있어서 키가 빠지면 타입 검사가 실패합니다.

**캐시**는 크기가 제한되어 있고 provider가 소유합니다: 컴파일 캐시, 문서 파싱 캐시, extract 캐시, 외부 스크립트 blob. 마지막 provider가 unmount되면 모두 비웁니다(`utils/editor-caches.ts`).

## 자주 하는 변경은 어디서 시작하나

| 하고 싶은 것                          | 시작할 곳                                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 필드에서 새 작성 문법 지원            | `utils/ast/edit-source.ts`와 `update.ts`(쓰기), `extract.ts` / `value.ts`(읽기), 그다음 Editable Syntax 페이지 |
| 바인딩 `type` 추가나 필드 컨트롤 변경 | `utils/ast/types.ts`의 `BINDING_TYPES`, `panel/field-kind.ts`, `panel/field.tsx`                               |
| 섹션 작업의 동작 변경                 | `dnd/state/use-section-document.ts`                                                                            |
| 패널 편집의 commit 방식 변경          | `dnd/state/use-section-editing.ts`의 `commitChanges`                                                           |
| 배열이나 children 편집 변경           | `panel/use-dnd-items.ts` / `use-dnd-children.ts`, `utils/ast/items.ts` / `children.ts`                         |
| 커스텀 패널에 무언가 공개             | `dnd/types.ts`의 `DndPanel`, 그다음 `dnd/index.ts`와 공개 API 스냅샷                                           |
| 미리보기 격리나 크기 조절 변경        | `components/frame/`                                                                                            |
| UI 문구 추가                          | `components/context/messages.ts`와 한국어 세트                                                                 |

패키지가 export하는 것이 바뀌면 `.github/scripts/api-surface.snapshot.json`도 갱신합니다(`pnpm check-api-surface --update`).

## 알려진 거친 부분

지금은 등록된 것이 없습니다. 구조가 필요 이상으로 따라가기 어려운 곳을 발견하면 정리 후보로 여기에 추가합니다.
