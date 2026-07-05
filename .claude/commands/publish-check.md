@jbpark/live-editor 패키지 퍼블리시 전 상태를 점검합니다.

## 체크리스트 (순서대로 실행)

1. **`private` 플래그 확인**

   `package.json`의 `"private"` 필드를 확인한다. `true`로 되어 있으면 changesets가
   `npm publish`를 실행해도 npm이 게시를 거부한다. 퍼블리시 전에 `false`로 바꾸거나
   제거해야 한다는 점을 반드시 보고한다.

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

4. **Changeset 상태 확인**

   ```bash
   pnpm changeset status
   ```

   - 변경사항이 없으면 경고: 퍼블리시할 버전 변경이 없을 수 있음
   - pending changeset이 있으면 버전과 내용을 요약해서 보고

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
   - `main`에 changeset과 함께 푸시 → `publish.yml` 워크플로우가 버전 PR 생성 및
     머지 후 자동으로 `changeset publish` 실행
   - 로컬에서 직접 하려면: `pnpm exec changeset version && pnpm exec changeset publish`
