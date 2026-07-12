@jbpark/live-editor 패키지 퍼블리시 전 상태를 점검합니다.

## 체크리스트 (순서대로 실행)

1. **`private` 플래그 확인**

   `package.json`의 `"private"` 필드를 확인한다. `true`로 되어 있으면 `publish.yml`의
   "Publish to npm" 스텝이 자동으로 건너뛰어진다(`private`이 아닐 때만 실행). 실제
   npm 공개 배포를 시작하려면 `false`로 바꾸고 `publishConfig.access: "public"`을
   추가해야 한다는 점을 보고한다.

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

4. **CHANGELOG.md `Unreleased` 상태 확인**

   `CHANGELOG.md`의 `## [Unreleased]` 섹션을 확인한다.
   - `<!-- next-bump: ... -->` 마커와 `### ` 하위 섹션이 없으면 경고: 다음 `main`
     푸시에서 `promote-changelog.mjs`가 승격할 내용이 없음
   - 마커가 있으면 예정된 bump 타입과 누적된 변경 항목을 요약해서 보고

5. **package.json 버전 확인**
   - `package.json`의 `version` 필드 출력
   - npm 최신 버전과 비교: `npm view @jbpark/live-editor version 2>/dev/null || echo "not published yet"`

6. **exports 필드 확인**
   - `package.json`의 `exports` 필드(`.`, `./utils`, `./utils/ast`, `./utils/tailwind`, `./style.css`)에
     새로 추가된 진입점이 누락되지 않았는지 확인
   - `src/index.ts` 및 관련 서브패스 파일들의 실제 export 목록과 대조

7. **최종 요약**
   통과/실패 항목을 표로 정리한다. `private: true`가 아직 남아 있으면 최우선 경고로 표시하고,
   문제가 없으면 배포 흐름을 안내한다:
   - `develop` 푸시 → `changelog-develop.yml`이 `CHANGELOG.md`의 `Unreleased`에 항목 누적
   - `develop`이 `main`으로 머지 → `publish.yml`이 `Unreleased`를 버전으로 승격해 릴리스 PR 생성
   - 릴리스 PR 머지 → 빌드 + 태그 생성 (+ `private`이 아니면 npm 배포)까지 자동 실행
