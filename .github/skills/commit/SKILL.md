---
name: commit
description: '커밋 메시지를 생성합니다. 스테이징된 변경 사항을 분석하여 프로젝트 커밋 컨벤션에 맞는 메시지를 작성합니다. Use when: git commit 전에 메시지를 작성할 때.'
argument-hint: '(선택) 추가 컨텍스트 (예: "영어로", "fix 타입으로")'
---

# 커밋 메시지 생성

스테이징된 Git 변경 사항을 분석하여 프로젝트 커밋 컨벤션에 맞는 커밋 메시지를 생성합니다.

## When to Use

- `git commit` 직전에 메시지를 작성해야 할 때
- gitmoji + 타입 + 스코프 형식이 필요할 때
- 스테이징된 변경 사항을 요약해야 할 때

## Procedure

1. `.github/COMMIT_CONVENTION.md` 파일을 읽어 커밋 컨벤션 규칙을 확인합니다.
2. `get_changed_files`로 **staged** 상태의 변경 파일 diff를 가져옵니다.
3. 현재 브랜치명을 확인하여 scope에 우선 사용합니다.
4. `pnpm-lock.yaml`, `package-lock.json` 등 lock 파일 변경은 해석에서 **제외**합니다.
5. 컨벤션 규칙(형식, 타입, 이모지, 스코프)을 **정확히** 따라 커밋 메시지를 생성합니다.
6. 커밋 메시지만 복사 가능한 fenced code block으로 출력하고 부가 설명은 최소화합니다.

## Rules

- **컨벤션 우선**: `.github/COMMIT_CONVENTION.md` 기준을 반드시 따름
- **스코프**: 브랜치명 우선 → 없으면 변경 영역명
- **이모지**: gitmoji 하나만 선택, 타입 앞에 배치
- **언어**: 기본 영어 (사용자가 한국어 요청 시 한국어로 작성)
- **lock 파일 제외**: lock 파일 변경은 메시지 작성 시 무시
- **staged 기준**: 스테이징된 파일만 분석 대상
- **출력 형식**: 최종 응답은 커밋 메시지 한 개만 fenced code block으로 감싸서 출력

## References

- 커밋 컨벤션: [`.github/COMMIT_CONVENTION.md`](../../COMMIT_CONVENTION.md)
