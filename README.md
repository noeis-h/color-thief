# COLOR THIEF

색을 훔치고 건네주며 길을 여는 아이소메트릭 퍼즐 게임입니다. (20 스테이지)

- 빨강: 봉인된 상자를 태웁니다
- 파랑: 물을 얼려 다리를 만듭니다
- 노랑: 발전기를 켜 문을 엽니다

## 조작

- **클릭**: 이동 (오브젝트를 클릭하면 바로 옆 칸까지 걸어갑니다)
- **SPACE**: 상하좌우 옆 칸의 색 훔치기 / 주기
- **Z**: 되돌리기 · **R**: 재시작 · **H**: 힌트

힌트는 3단계(넌지시 → 단서 → 정답)이며, 힌트를 볼 때마다 클리어 별이 하나씩 줄어듭니다.
진행 상황은 브라우저에 자동 저장됩니다.

## 실행 방법

[Node.js](https://nodejs.org) 18 이상이 필요합니다.

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:5173 을 엽니다.

배포용 빌드는 `npm run build` → `dist/` 폴더에 만들어지며, `npx vite preview`로 확인할 수 있습니다.
(`dist/index.html`을 파일로 바로 열면 브라우저 보안 정책 때문에 실행되지 않습니다. 웹 서버로 열어 주세요.)

## 폴더 구성

| 경로 | 내용 |
|---|---|
| `src/main.ts` | 게임 루프, 입력, 저장 연결 |
| `src/game.ts` | 게임 규칙 (이동, 색 훔치기/주기, 되돌리기) |
| `src/levels.ts` | 20개 스테이지 지도와 힌트 |
| `src/render.ts` | 아이소메트릭 렌더링 (텍스처를 블록 면에 매핑) |
| `src/fx.ts` | 색 리본, 파티클 효과 |
| `src/ui.ts` | 플레이 방법, 힌트, 스테이지 선택, 클리어 화면 |
| `src/save.ts` | 진행 상황 저장 (localStorage) |
| `src/assets.ts`, `src/placeholders.ts` | 이미지 로딩 (이미지가 없을 때 쓰는 임시 그림 포함) |
| `public/assets/` | AI로 생성한 게임 이미지 21장 |

## 플레이 링크

https://noeis-h.github.io/color-thief/
