---
name: verify
description: "Which checks to run in live-editor before committing or opening a PR, by what the change touches (src, a public export, docs, the lockfile, only tests or docs), how to show a new test catches the bug, and what CI runs that a local run may skip. Use before committing or opening a PR, after bumping a dependency, or when the user says '검증해줘', '테스트 돌려줘', 'run the checks', 'is this ready'."
---

# 변경 종류별 검증

공유 `pr` 스킬은 "실행한 검사와 결과를 적고, 하지 않은 검사는 하지 않았다고 쓴다"를 정합니다. 이 스킬은 이 저장소에서 **무엇을** 실행하는지 정합니다. 명령은 `package.json`의 scripts와 `.github/workflows/ci.yml`이 정본입니다(환경 의존, 2026-10 확인. 다시 확인할 때는 `node -p "Object.keys(require('./package.json').scripts).join(' ')"`와 `ci.yml`).

## 변경별 명령

| 바꾼 것                                   | 실행할 것                                                                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/` 코드                               | `pnpm check-types`, `pnpm lint`, `pnpm knip`, `pnpm test`, `pnpm test:browser`                                                            |
| 공개 export나 진입점                      | 위에 더해 `pnpm build`, `pnpm check-api-surface`(의도한 변경이면 `--update`로 스냅샷 갱신)                                                |
| `website/docs/`                           | `pnpm --dir website typecheck`, `pnpm --dir website build`. MDX 표·코드 블록이 깨지면 빌드에서 드러납니다                                 |
| AGENTS.md, ARCHITECTURE, 스킬 같은 문서만 | `pnpm exec prettier --check <파일>`. 적은 경로와 이름이 실제로 있는지 `ls`/`git grep`으로 확인합니다                                      |
| 의존성(lockfile)                          | `pnpm install --frozen-lockfile` 후 위 검사. Playwright가 올라가면 브라우저를 새로 받아야 합니다: `pnpm exec playwright install chromium` |
| 테스트 파일 이동·이름 변경                | 옮기기 전과 후의 `pnpm test` 테스트 개수가 같은지 비교합니다                                                                              |

- `pnpm build`는 `check-types`를 먼저 돌리므로 타입 에러가 있으면 빌드도 실패합니다.
- `pnpm test:browser`가 "Executable doesn't exist"로 전부 실패하면 코드 문제가 아니라 브라우저가 없는 것입니다.
- commit 시 husky + lint-staged(`package.json`의 `lint-staged`)가 바뀐 `js·ts·css·md` 파일에 prettier, 코드 파일에 `pnpm lint`와 `tsc -b`를 돌립니다. `.mdx`는 대상이 아니므로 문서를 고쳤으면 `pnpm exec prettier --write`를 직접 돌립니다. 테스트도 직접 돌려야 합니다.

## 새 테스트가 실제로 잡는지

테스트를 추가했으면 고친 코드를 잠깐 되돌리거나 검사를 끄고(`if (false && ...)` 등) 그 테스트가 실패하는지 봅니다. 확인한 뒤 원래대로 돌리고 `git diff`로 되돌렸는지 확인합니다. PR의 How to test에 "이 변경을 빼면 N개가 실패한다"로 적습니다.

## CI만 돌리는 것

`ci.yml`의 `lint-and-build`는 위 검사에 더해 `check-package-types.mjs`, `check-node-entries.mjs`(가장 오래 지원하는 Node에서도), `check-entry-babel.mjs`를 돌립니다. 로컬에서 돌리지 않았으면 PR에 그렇게 적고 CI 결과로 확인합니다.
