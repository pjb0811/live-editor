@jbpark/live-editor 패키지 퍼블리시 전 상태를 점검합니다.

## 체크리스트 (순서대로 실행)

1. **`private` 플래그 확인**

   `package.json`의 `"private"` 필드를 확인한다. `true`로 되어 있으면 `publish.yml`의
   "Publish to npm" 스텝이 자동으로 건너뛰어진다(`private`이 아닐 때만 실행). 실제
   npm 공개 배포를 시작하려면 `false`로 바꾸고 `publishConfig.access: "public"`을
   추가해야 한다는 점을 보고한다. (최초 배포는 npm의 OIDC Trusted Publisher 등록
   전이라 별도 부트스트랩이 필요 — 진행 시 안내한다.)

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
   - `package.json`의 `exports` 필드(`.`, `./utils`, `./utils/ast`, `./utils/tailwind`, `./style.css`)에
     새로 추가된 진입점이 누락되지 않았는지 확인
   - `src/index.ts` 및 관련 서브패스 파일들의 실제 export 목록과 대조

6. **최종 요약**
   통과/실패 항목을 표로 정리한다. `private: true`가 아직 남아 있으면 최우선 경고로 표시하고,
   문제가 없으면 배포 흐름을 안내한다: 별도 수동 퍼블리시 명령은 없다 — `main`에 changeset이
   쌓이면 "Version Packages" PR이 열리고, 그 PR을 머지하면 `publish.yml`이 자동으로
   빌드/(공개 패키지면 퍼블리시)/태그/GitHub Release까지 처리한다.
