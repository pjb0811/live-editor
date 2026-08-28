---
name: version-management
description: "changesets 기반 버전 관리/릴리스 흐름(Version Packages PR 머지 = npm 실제 공개 배포 + 태그/GitHub Release)과, PR 머지 시 changeset 봇 커밋 때문에 발생하는 GitHub Actions 'action_required' 승인 이슈 대응법. Use when 새 changeset을 추가할 때, 'Version Packages' PR을 머지해야 할 때, PR이 CI는 다 통과한 것 같은데 mergeStateStatus가 BLOCKED로 안 풀릴 때, 또는 '버전 올려줘', 'release 진행' 같은 요청이 있을 때."
---

# Version Management (live-editor)

`@jbpark/live-editor`는 changesets로 버전을 관리하며, **npm에 공개 배포되는 패키지다.** `package.json`에 `"private": false` + `publishConfig.access: "public"`이 설정돼 있고(`930f080`, 2026-07-27에 전환), 레지스트리에 실제로 올라가 있다.

> ⚠️ **가장 중요한 점: `Version Packages` PR을 머지하면 그 즉시 npm에 실제 공개 배포가 일어난다.** 되돌릴 수 없으므로(npm unpublish는 72시간 제한 + 이미 받아간 사용자에게는 무의미) 머지 전에 **반드시 사용자에게 확인받는다.** 다른 일반 PR 머지와 같은 무게로 취급하지 않는다.

## 상태 먼저 확인하기

이 문서는 위 상태를 사실로 적고 있지만, 플래그는 언제든 바뀔 수 있는 값이다. 실제로 이 문서가 한 번 낡았던 적이 있다(전환 시점에 갱신되지 않아, `private: true`라 배포가 비활성이라고 잘못 안내하고 있었다). **문서를 믿지 말고 매번 직접 확인한다:**

```bash
git show origin/main:package.json | node -p "const p=JSON.parse(require('fs').readFileSync(0));({private:p.private,version:p.version,publishConfig:p.publishConfig})"
npm view @jbpark/live-editor version    # 레지스트리에 실제로 올라가 있는지
```

`private`가 `false`면 배포가 살아있는 것이고, 아래 3번이 실제 publish로 이어진다. 확인 결과가 이 문서와 다르면 **문서 쪽을 고친다.**

## 릴리스 흐름

1. **changeset 추가**: 사용자 대상 변경이 있는 PR에는 `.changeset/*.md`가 필요하다. `pnpm changeset`으로 수동 생성하거나, `changeset-draft.yml`(필수 상태 체크 `draft`)이 PR별로 초안을 자동 생성/갱신해준다.
2. **Version Packages PR**: main에 push될 때마다 `version.yml`이 돌면서, 누적된 changeset들로 `changeset-release/main` 브랜치에 "🔖 chore: version packages" PR을 열고 유지한다. `package.json` 버전 bump + `CHANGELOG.md` 갱신.
3. **머지 시 동작 (publish.yml)**: 이 PR을 머지하면 그 자체가 main push이므로 `publish.yml`이 실행된다.
   - `already_tagged` 확인 — 현재 `package.json`의 버전이 이미 `vX.Y.Z` 태그로 있으면 아무것도 안 한다. 대부분의 main push(일반 PR 머지)가 여기서 걸러지고, 버전이 막 올라간 직후에만 통과한다.
   - install → build
   - `is_private` 확인 후 **`npm publish`** (OIDC Trusted Publishing — `NPM_TOKEN` 불필요. pnpm이 아직 지원하지 않아 이 스텝만 `npm`으로 나간다)
   - `v<version>` 태그 push
   - `CHANGELOG.md`에서 해당 버전 섹션을 뽑아 GitHub Release 생성 (NVIDIA API로 릴리스 노트를 다듬되, 실패하면 원본 changelog로 폴백 — 릴리스를 막지 않는다)

   `is_private` 게이트는 지워지지 않았지만 **지금은 안전망일 뿐 publish를 막지 않는다.** `private: false`이므로 조건이 통과한다.

## 배포 후 확인

```bash
npm view @jbpark/live-editor version        # 새 버전인지
npm view @jbpark/live-editor dist-tags --json
gh release list --limit 3                    # 태그 + Release 생성됐는지
gh run list --branch main --limit 3          # Publish 워크플로 success인지
```

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
