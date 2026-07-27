---
name: version-management
description: "changesets 기반 버전 관리/릴리스 흐름(Version Packages PR → 태그/GitHub Release, 아직 npm publish는 비활성)과, PR 머지 시 changeset 봇 커밋 때문에 발생하는 GitHub Actions 'action_required' 승인 이슈 대응법. Use when 새 changeset을 추가할 때, 'Version Packages' PR을 머지해야 할 때, PR이 CI는 다 통과한 것 같은데 mergeStateStatus가 BLOCKED로 안 풀릴 때, 또는 '버전 올려줘', 'release 진행' 같은 요청이 있을 때."
---

# Version Management (live-editor)

`@jbpark/live-editor`는 changesets로 버전을 관리하지만, `package.json`에 **`"private": true`가 설정돼 있어 아직 npm에 공개 배포되지 않는다.** (공개 배포를 시작하려면 이 플래그를 내리고 `publishConfig.access`를 추가해야 한다 — `publish.yml`에 그 전제가 코드/주석으로 이미 반영돼 있다.)

## 릴리스 흐름

1. **changeset 추가**: 사용자 대상 변경이 있는 PR에는 `.changeset/*.md`가 필요하다. `pnpm changeset`으로 수동 생성하거나, `changeset-draft.yml`(필수 상태 체크 `draft`)이 PR별로 초안을 자동 생성/갱신해준다.
2. **Version Packages PR**: main에 push될 때마다 `version.yml`이 돌면서, 누적된 changeset들로 `changeset-release/main` 브랜치에 "🔖 chore: version packages" PR을 열고 유지한다. `package.json` 버전 bump + `CHANGELOG.md` 갱신.
3. **머지 시 동작 (publish.yml)**: 이 PR을 머지하면 그 자체가 main push이므로 `publish.yml`이 실행된다.
   - 현재 버전이 이미 `vX.Y.Z` 태그로 있는지 확인 → 없으면 build.
   - `package.json`의 `private` 플래그를 확인해서 **`private: true`인 동안은 `npm publish` 스텝 자체를 건너뛴다** — 그래도 git 태그 push와 GitHub Release 생성은 그대로 진행된다 (배포와 무관하게 버전 이력은 남긴다는 뜻).
   - 나중에 `private: false`로 바뀌면 이 저장소도 use-hooks/ui-kit과 동일하게 OIDC Trusted Publishing으로 실제 npm publish가 일어나기 시작한다 — 그 시점부터는 Version Packages PR 머지가 "실제 공개 배포"가 되므로 사용자에게 더 명확히 확인받아야 한다.

현재 상태에서는 Version Packages PR 머지가 (아직은) npm에 아무것도 공개하지 않으므로 다른 일반 PR 머지와 비슷하게 취급해도 되지만, `private` 플래그가 바뀌었는지는 머지 전에 한 번 확인하는 습관을 들인다.

## 필수 상태 체크와 "action_required" 함정

이 저장소의 브랜치 룰셋도 `lint-and-build (Node v24.x)`와 `draft` 두 체크를 필수로 요구한다 (`gh api repos/pjb0811/live-editor/rulesets`로 확인 가능).

PR을 열면 `changeset-draft.yml` 봇이 그 브랜치에 커밋을 하나 더 push해서(draft changeset 추가/갱신) `synchronize` 이벤트가 발생할 수 있다. 이 새 커밋에 대해 재트리거된 CI/Changeset Draft 실행이 **`conclusion: action_required`, job 0개**로 멈추는 경우가 있는데, 실제로는 문제 없는 정상 재실행이다. 이러면 필수 체크가 "완료"로 안 잡혀 PR의 `mergeStateStatus`가 계속 `BLOCKED`로 남는다.

**해결 절차:**

```bash
gh run list --branch <branch> --json databaseId,name,status,conclusion,headSha,event
gh api -X POST repos/pjb0811/live-editor/actions/runs/<run_id>/approve
gh run watch <run_id> --exit-status
gh pr view <n> --json mergeable,mergeStateStatus   # CLEAN이면 머지 가능
```

## 브랜치 네이밍

Conventional Commits 접두어를 브랜치명에도 쓴다: `feat/*`, `fix/*`, `refactor/*`, `chore/*`.

⚠️ **함정**: git은 `feat`이라는 이름의 브랜치와 `feat/foo`라는 이름의 브랜치를 동시에 가질 수 없다 (ref 경로 충돌). 새 브랜치를 만들기 전에 `git branch -a`로 겹치는 bare 브랜치가 남아있는지 확인하고, 있으면 대체 이름을 쓰거나 삭제 여부를 사용자에게 먼저 물어본다.

## 참고

- 관련 워크플로우: `.github/workflows/changeset-draft.yml`, `.github/workflows/version.yml`, `.github/workflows/publish.yml`, `.github/workflows/ci.yml`
- `docs-deploy.yml`은 별개 — 문서/데모 사이트 배포용이며 버전 릴리스와 무관하게 동작한다.
