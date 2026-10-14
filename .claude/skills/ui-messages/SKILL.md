---
name: ui-messages
description: "Adding or changing live-editor's UI text (LiveMessages, ValidationMessages): where the English defaults live, the two Korean sets that must stay identical (the dev app and the localization docs), the compatibility policy for new keys, and the sync check. Use when adding a message key, a placeholder, a validation message or a message group, or when the user says '메시지 추가', '문구 추가', '한국어 번역', 'add a message'."
---

# UI 문구 추가·수정

호스트는 `Live`의 `messages`로 문구를 바꿉니다(#524). 패키지는 영어만 싣고, 한국어는 예시로 두 곳에 있습니다. 파일 위치는 환경 의존입니다(2026-10 확인. 다시 확인할 때는 `git grep -n "defaultMessages\|defaultValidationMessages\|KO_MESSAGES\|export const koMessages"`).

## 고칠 곳

1. **타입과 영어 기본값**
   - 일반 문구: `src/components/context/messages.ts`의 `LiveMessages` 인터페이스와 `defaultMessages`.
   - 검증 문구: `src/utils/ast/validate.ts`의 `ValidationMessages`와 `defaultValidationMessages`. `LiveMessages.validation`이 이 타입입니다.
   - 값이 들어가는 문구는 함수로 둡니다(`max: max => ...`). 번역이 어순을 정할 수 있게 하려는 것입니다.
2. **한국어 세트 두 곳**: dev 앱의 `src/pages/shared/ko-messages.ts`(`KO_MESSAGES`)와 문서 `website/docs/localization.mdx`의 "A complete Korean set"(`koMessages`). 둘 다 전체 `LiveMessages` 타입이라 키를 빠뜨리면 dev 앱은 타입 체크에서 실패합니다. 문서 쪽은 타입 체크가 없으므로 아래 비교로 확인합니다.
3. **새 그룹**이면 `localization.mdx`의 그룹 표에도 한 줄을 넣습니다.

## 두 한국어 세트 비교

출력이 비어야 합니다.

```bash
diff <(sed -n '/^export const koMessages/,/^};/p' website/docs/localization.mdx | tail -n +2) \
     <(sed -n '/^export const KO_MESSAGES/,/^};/p' src/pages/shared/ko-messages.ts | tail -n +2)
```

## 호환성

- **키 추가는 minor다.** 번역하기 전까지 영어로 나오고, 전체 `LiveMessages` 타입으로 선언한 호스트 세트는 컴파일이 실패해서 새 문구를 알게 됩니다. `localization.mdx`가 이 정책을 문서로 약속합니다.
- **키 이름 변경·삭제와 함수 시그니처 변경은 major다.** 호스트가 넘긴 함수의 타입이 맞지 않게 됩니다. 값의 종류가 다르면 새 키를 둡니다(#632의 `minDate`가 `min`을 넓히지 않은 이유).
- 문구 자체를 고치는 것은 patch입니다.
