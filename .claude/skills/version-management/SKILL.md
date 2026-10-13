---
name: version-management
description: "live-editor specifics for releases: `@jbpark/live-editor` is public on npm, so merging the 'Version Packages' PR publishes it; what publish.yml does here (test before publish, npm via OIDC, NVIDIA-polished release notes), the required checks, and the manual release backfill. The common changesets flow, the `action_required` approval and branch naming are in the shared `changesets-release` skill, and pre-release checks in `publish-check`. Use with those when adding a changeset, merging a 'Version Packages' PR, or when the user says '버전 올려줘', 'release 진행', 'npm 배포'."
---

# Version Management (live-editor)

공통 흐름(changeset → Version Packages PR → 머지 시 `publish.yml`), `action_required` 실행 승인, 브랜치 이름 규칙은 공유 `changesets-release` 스킬을, 배포 전 점검은 공유 `publish-check` 스킬을 따른다. 이 문서는 이 저장소에만 있는 내용이다.

## 패키지와 배포 상태

- 배포 대상은 저장소 루트의 `@jbpark/live-editor` 하나다. `private: false`, `publishConfig.access: "public"`이고 2026-07-27(`930f080`)부터 npm에 공개 배포된다(환경 의존, 2026-10 확인).
- **Version Packages PR 머지 = npm 공개 배포**다. 머지 전에 매번 사용자 확인을 받는다.
- `publish-check`에 넘길 값: 패키지 디렉터리는 저장소 루트, npm 이름은 `package.json`의 `name`과 같고, 배포되는 `exports`도 루트 `package.json`에 있다. 따로 정할 값은 없다.
- 상태는 문서가 아니라 직접 확인한다. 결과가 이 문서와 다르면 실제 상태를 따르고, 문서가 낡았다는 사실을 근거(확인한 ref, 명령 출력)와 함께 사용자에게 보고한다. 문서는 사용자가 요청할 때만 고친다.

  ```bash
  git show origin/main:package.json | node -p "const p=JSON.parse(require('fs').readFileSync(0));({private:p.private,version:p.version,publishConfig:p.publishConfig})"
  npm view @jbpark/live-editor version
  ```

## 이 저장소의 `publish.yml`

> 아래 순서는 환경 사실이다(환경 의존, 2026-10 확인: `origin/main`). 다시 확인할 때는 `git show origin/main:.github/workflows/publish.yml`을 읽는다.

`already_tagged`(현재 버전의 `vX.Y.Z` 태그가 이미 있으면 아무것도 하지 않음)를 통과하면 다음 순서로 돈다.

1. install → **test** → build
2. `is_private` 확인 후 `npm publish`. OIDC Trusted Publishing이라 `NPM_TOKEN`이 필요 없고, pnpm이 아직 지원하지 않아 이 스텝만 `npm`으로 실행한다. `is_private` 게이트는 안전망으로 남아 있지만 지금은 통과한다.
3. `v<version>` 태그 push
4. `CHANGELOG.md`에서 해당 버전 절을 뽑아 GitHub Release를 만든다. 릴리스 노트는 NVIDIA API(`NVIDIA_API_KEY`)로 다듬고, 실패하면 원본 changelog로 폴백한다. 릴리스를 막지 않는다.

태그는 있는데 Release가 없으면 `release.yml`("Release (manual backfill)")을 `workflow_dispatch`로 실행한다(`tag` 입력값 필요).

## 필수 상태 체크

브랜치 룰셋은 `lint-and-build`와 `draft`를 요구한다(환경 의존, 2026-10 확인). 지금 값은 이렇게 확인한다.

```bash
gh api repos/pjb0811/live-editor/rulesets -q '.[].id' | while read id; do gh api repos/pjb0811/live-editor/rulesets/$id -q '.rules[]|select(.type=="required_status_checks")|.parameters.required_status_checks[].context'; done
```

`draft`(`changeset-draft.yml`)는 `opened`와 `synchronize`에만 돈다. base가 바뀌거나 PR을 다시 열어도 돌지 않으므로, 다른 PR 위에 쌓은 PR은 base가 `main`으로 바뀐 뒤 새 커밋을 push해야 머지할 수 있다.

## 워크플로

환경 의존, 2026-10 확인. 다시 확인할 때는 `git ls-tree --name-only origin/main .github/workflows/`.

- `.github/workflows/changeset-draft.yml`, `version.yml`, `publish.yml`, `release.yml`, `ci.yml`
- 문서 사이트는 GitHub Actions가 아니라 Vercel이 배포한다(`vercel.json`: `pnpm --dir website build` → `website/build`). 버전 릴리스와 무관하다.
