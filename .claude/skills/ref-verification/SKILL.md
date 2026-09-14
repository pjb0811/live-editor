---
name: ref-verification
description: '저장소 상태를 확인할 때 작업 트리 대신 git ref를 기준으로 읽어, 동기화되지 않은 워크트리 때문에 낡은 코드를 사실로 단정하는 사고를 막는 절차. Use when PR/브랜치 변경 내용을 검토할 때, 문서·주석이 구현과 맞는지 대조할 때, grep/ls/cat으로 "이 코드가 지금 어떻게 돼 있나"를 확인할 때, 세션 중에 PR을 머지한 뒤 이어서 작업할 때, 또는 "최신 메인 기준으로 확인해줘" 같은 요청이 있을 때.'
---

# Ref 기준 검증 (live-editor)

코드 내용을 확인할 때 **작업 트리 파일을 읽지 말고 git ref에서 직접 읽는다.** `grep`/`ls`/`cat`/`node -p`는 전부 현재 체크아웃된 커밋을 보는데, 그 커밋이 최신이라는 보장이 없다.

> ⚠️ **핵심: `git fetch`가 최신이어도 작업 트리는 낡은 채로 남는다.** 원격 ref와 작업 트리는 별개로 움직인다. fetch만 했다고 안심하지 않는다.

## 왜 이 문서가 있나 — 실제 사고 (2026-09-14)

`docs/refresh-project-guidance` 브랜치를 검토하면서, 문서의 "에디터는 `@jbpark/ui-kit/CodeEditor`를 쓴다"는 서술을 **틀렸다고 잘못 단정**했다. 근거로 든 것은 이 명령이었다.

```bash
$ grep -rn 'CodeEditor' src/
(출력 없음)
```

하지만 이건 작업 트리(`f7dbbfa`)를 본 결과였고, 그 사이 main에는 마이그레이션이 들어와 있었다.

```
582cf70  refactor: consume @jbpark/ui-kit CodeEditor instead of a local CodeMirror surface (#327)
```

결정적인 부분은 **fetch 데이터가 낡지 않았다는 것**이다. reflog를 보면 최신 커밋은 검토 하루 전에 이미 받아둔 상태였다.

```
19c40e2  origin/main@{2026-09-13 00:30:17}: fetch --prune: fast-forward   ← 이미 있었음
```

즉 데이터가 아니라 **읽는 기준**이 낡았다. 게다가 같은 검토 안에서 기준이 섞여 있었다.

| 무엇을 했나                                 | 어떤 기준을 봤나         | 결과    |
| ------------------------------------------- | ------------------------ | ------- |
| 브랜치 비교 (`ahead/behind`, `diff --stat`) | `origin/main` (원격 ref) | ✅ 정확 |
| 내용 검증 (`grep`, `ls`, `node -p`)         | 작업 트리 (낡은 커밋)    | ❌ 오판 |

작업 트리가 낡은 이유도 외부 요인이 아니라 자초한 것이었다 — 사흘 전 릴리스 작업 때 `git reset --hard origin/main`으로 맞춰둔 뒤 다시 동기화하지 않았다. **그동안 같은 세션에서 PR을 3번 머지했고, 그때마다 main이 움직였다.**

## 절차

### 1. 검증 시작 전에 동기화한다

```bash
git fetch origin --prune
git status --short          # 변경사항 없는지 먼저 확인
git reset --hard origin/main
```

작업 중인 변경이 있으면 `reset --hard` 대신 ref 명시 방식(2번)을 쓴다.

### 2. 내용은 ref를 명시해서 읽는다

작업 트리 동기화 여부와 무관하게 항상 정확하다.

| 하려는 일         | 작업 트리 (위험)         | ref 명시 (안전)                                                                                    |
| ----------------- | ------------------------ | -------------------------------------------------------------------------------------------------- |
| 코드 검색         | `grep -rn 'X' src/`      | `git grep 'X' origin/main -- src/`                                                                 |
| 파일 읽기         | `cat path/to/f.ts`       | `git show origin/main:path/to/f.ts`                                                                |
| 디렉토리 목록     | `ls src/utils/ast/`      | `git ls-tree origin/main src/utils/ast/`                                                           |
| package.json 조회 | `node -p "require(...)"` | `git show origin/main:package.json \| node -p "JSON.parse(require('fs').readFileSync(0)).version"` |

원격 파일을 직접 볼 수도 있다.

```bash
gh api "repos/pjb0811/live-editor/contents/package.json?ref=<branch>" --jq '.content' | base64 -d
```

### 3. 비교 기준과 검증 기준을 일치시킨다

브랜치를 `origin/main` 기준으로 비교했으면 **내용도 `origin/main`에서 읽는다.** 위 사고가 정확히 이 규칙을 어긴 경우다.

```bash
BASE=origin/main
HEAD=origin/<branch>

git log --oneline $BASE..$HEAD          # 앞선 커밋
git log --oneline $HEAD..$BASE          # 뒤처진 커밋 (비어야 rebase 불필요)
git diff --stat $BASE...$HEAD           # 변경 파일
git grep 'X' $BASE -- src/              # 검증도 같은 BASE로
```

### 4. 격리가 필요하면 임시 워크트리를 쓴다

브랜치 내용으로 명령을 실행해야 할 때(포맷 검사, 빌드 등)는 현재 워크트리를 건드리지 말고 분리한다.

```bash
git worktree add /tmp/review <ref> --detach
# ... 검증 ...
git worktree remove /tmp/review --force
```

## 반드시 지킬 것

- **세션 중에 PR을 머지했다면, 이어지는 작업 전에 반드시 재동기화한다.** 머지는 main을 발밑에서 움직이는 행위다. 이게 가장 흔한 낡음의 원인이다.
- **`git worktree list` 출력을 흘려보지 않는다.** 각 워크트리의 체크아웃 커밋이 찍히므로, 다른 워크트리와 커밋이 다르면 그 자체가 경고 신호다. 위 사고에서도 main 워크트리가 `19c40e2`로 찍혀 있었는데 알아채지 못했다.
- **"없음"을 결론으로 쓰기 전에 기준을 의심한다.** grep이 빈 결과를 냈을 때 "존재하지 않는다"가 아니라 "이 커밋에는 없다"가 정확한 서술이다. 문서/구현 불일치를 지적하려면 **어떤 ref에서 확인했는지 함께 밝힌다.**
- **오래된 세션에서는 변할 수 있는 사실을 재확인한다.** 의존성 목록, 파일 구조, 버전, export 목록은 며칠이면 바뀐다. 반대로 "왜 이 버그가 생겼는지" 같은 인과 맥락은 유지해도 된다.

## 하지 않을 것

- **낡은 기준을 피하겠다고 세션을 주기적으로 닫지 않는다.** 새 세션은 워크트리를 우연히 최신으로 잡아줄 뿐 원인을 고치지 않고, 축적된 맥락(어느 PR에서 유래한 회귀인지 등)을 잃는 비용이 크다. 위 사고도 세션 수명이 아니라 재동기화 누락이 원인이었다.
- **`git pull`로 대충 맞추지 않는다.** 워크트리가 detached이거나 다른 브랜치면 의도와 다르게 동작한다. `fetch` + 명시적 `reset --hard origin/main`이 예측 가능하다.
- **검증 대상 브랜치를 현재 워크트리에 체크아웃하지 않는다.** 세션 워크트리의 브랜치가 바뀌면 이후 작업이 꼬인다. 임시 워크트리(4번)를 쓴다.

## 참고

- 이 저장소는 워크트리를 여러 개 쓴다 (`live-editor/`, `live-editor.worktrees/*`). 서로 다른 커밋에 있는 게 정상이므로, "옆 워크트리가 최신이니 내 것도 최신"이라고 가정하지 않는다.
- `git push`가 막힌 환경이라 커밋 반영은 GitHub Git Data API를 쓴다. 이때 원격 ref가 기준이 되므로 ref 명시 습관이 그대로 이어진다.
- 릴리스 흐름에서 main이 움직이는 지점은 `.claude/skills/version-management/SKILL.md` 참고.
