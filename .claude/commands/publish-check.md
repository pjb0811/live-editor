@jbpark/live-editor 패키지 퍼블리시 전 상태를 점검합니다.

## 체크리스트 (순서대로 실행)

1. **`private` 플래그 확인**

   ```bash
   node -p "JSON.stringify({private:require('./package.json').private, publishConfig:require('./package.json').publishConfig})"
   ```

   현재 이 패키지는 **공개 배포 중**이다 — `private: false` + `publishConfig.access: "public"`
   (`930f080`, 2026-07-27 전환). 따라서 `publish.yml`의 "Publish to npm" 스텝이
   **실제로 실행된다.**

   ⚠️ 이 말은 곧 **"Version Packages" PR 머지 = npm 실제 공개 배포**라는 뜻이다.
   되돌릴 수 없으므로 머지 전에 사용자 확인을 받아야 한다는 점을 요약에 명시한다.

   확인 결과가 위 설명과 다르면(`private: true`로 되돌려져 있다면) publish 스텝이
   건너뛰어지는 상태이므로, 그 사실을 보고하고 **이 문서와 `.claude/skills/version-management/SKILL.md`를
   실제 상태에 맞게 고친다.**

2. **타입 체크**

   ```bash
   pnpm check-types
   ```

   오류가 있으면 내용을 보고하고 중단한다.

3. **빌드**

   ```bash
   pnpm build
   ```

   빌드 실패 시 오류 내용을 보고하고 중단한다. (`build` 스크립트가 내부적으로
   `check-types`를 다시 실행하므로 2번과 중복 실행되어도 정상이다.)

4. **버전 상태 확인**

   ```bash
   node -p "require('./package.json').version"
   npm view @jbpark/live-editor version 2>/dev/null || echo "not published yet"
   ```

   - `package.json` 버전이 npm 최신 버전보다 앞서 있으면, changesets의 "Version Packages" PR이 `main`에 이미 머지되어 버전을 승격시킨 상태 — 다음 `main` push 시 `publish.yml`이 자동으로 빌드/(공개 패키지면 퍼블리시)/태그한다.
   - 두 버전이 같으면 아직 승격할 변경사항이 없다는 뜻(= `.changeset/*.md`가 없거나 아직 Version Packages PR이 머지 안 됨). `CHANGELOG.md` 최상단 섹션이 최신 버전과 일치하는지로도 확인 가능.

5. **exports 필드 확인**

   ```bash
   node -p "Object.keys(require('./package.json').exports).join('\n')"
   ```

   - 현재 진입점: `.`, `./provider`, `./dnd`, `./editor`, `./preview`, `./error`,
     `./utils`, `./utils/ast`, `./utils/tailwind`, `./style.css`
   - `tsdown.config.ts`의 `entry` 키와 1:1로 맞는지 대조한다 — 둘 중 하나만 추가되면
     빌드는 통과하지만 소비자가 import할 수 없거나(exports 누락) 404가 난다(빌드 누락)
   - `src/index.tsx` 및 각 서브패스의 배럴(`src/components/*/index.ts`)이 실제로
     의도한 것을 export하는지 확인

6. **최종 요약**
   통과/실패 항목을 표로 정리한다. 별도 수동 퍼블리시 명령은 없다 — `main`에 changeset이
   쌓이면 "Version Packages" PR이 열리고, 그 PR을 머지하면 `publish.yml`이 자동으로
   빌드 → `npm publish` → 태그 → GitHub Release까지 처리한다.

   **머지가 곧 공개 배포**이므로, 요약 마지막에 "이 PR을 머지하면 vX.Y.Z가 npm에
   실제 배포된다"는 문장을 넣고 사용자 확인을 받는다.
