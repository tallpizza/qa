# QA

모든 웹앱에 한 줄로 붙이는 QA 도구. 평소에는 화면에 아무것도 없고, 단축키로 불러 영역을 고르고 찍고 표시해서 Linear 일감으로 보낸다.

```
Alt+Shift+Q (맥은 Option+Shift+Q, ⌥⇧Q) / 손가락 3개로 0.7초 길게 누르기(휴대폰)
 → 영역 고르기(▲ 상위 ▼ 하위, 전체 화면) → 촬영 → 펜·화살표·사각형·가리기 + 메모
 → 이미지는 Linear 에 공개 이미지로 올리고(주소를 아는 사람은 볼 수 있고, 지워지지 않는다), 팀·프로젝트·시작 상태를 지정해 일감 생성
```

서버는 Vercel 의 QA 서버(`server/handler.mjs`) 하나다: **https://qa-widget-gilt.vercel.app** (Vercel 팀 codestep, 프로젝트 qa-widget). 앱마다 엔드포인트 `/p/<프로젝트 이름>` 을 쓰고, Linear 키는 팀마다 하나씩 서버의 환경변수에만 있다(Linear 개인 API 키는 팀 단위로만 권한을 나눌 수 있다). 앱 코드·쓰는 사람의 브라우저에는 키가 없어 처음 쓰는 사람도 단축키만 누르면 된다.

이미지를 서버를 거쳐 올리는 이유: 브라우저는 Linear 저장소에 직접 올리지 못한다(그 저장소는 `linear.app` 에서 온 요청만 받는다). 공개 이미지로 올리는 이유: factory 세션은 Linear 도구가 막혀 있어 일감 본문의 이미지 주소를 `curl` 로 받아 본다.

## QA 서버

| 주소 | 하는 일 |
|---|---|
| `POST /p/<프로젝트>/upload` | 그림 바이트(png·jpeg·webp, 4MB 이하) → Linear `fileUpload(makePublic: true)` 로 올리고 `{"url"}` |
| `POST /p/<프로젝트>/issue` | `{"title","description"}` → 그 프로젝트의 팀·프로젝트·시작 상태를 붙여 일감을 만들고 `{"identifier","url"}` |
| `GET /health` · `GET /qa.js` | 살아 있는지 · 빌드한 위젯 |

엔드포인트 주소는 앱 페이지 소스에 보인다. 그래서 브라우저 `Origin` 이 그 프로젝트의 허용 출처(`projects.json` 의 `origins`, `*` 는 아무 글자)가 아니면 403 으로 거절한다. curl 처럼 Origin 을 꾸미면 막지 못한다(내부 QA 도구로는 충분하다고 정했다).

Vercel 함수는 4.5MB 넘는 본문을 받지 못해, 위젯은 PNG 가 4MB 를 넘으면 WebP, 그래도 넘으면 JPEG 로 줄여 보낸다.

### 프로젝트 더하기

1. `projects.json` 의 `projects` 에 `"<이름>": { team, project, state, origins }` 를 넣는다. `team` 은 `teams` 의 팀 키(예: `FAC`), 프로젝트·상태 id 는 Linear 에서 얻는다(비밀값 아님). `state` 를 비우면 Triage 가 켜진 팀에서는 API 일감이 Triage 로 들어간다.
2. 새 팀이면 `teams` 에 팀 키와 id 를 넣고, 그 팀의 Linear 키를 넣는다: `vercel env add QA_KEY_<팀 키> production` (예: `QA_KEY_FAC`). 이미 있는 팀이면 이 단계는 없다. Linear → 설정 → 보안 및 접근 → 개인 API 키, 권한은 일감 만들기·파일 올리기, 그 팀만. 키는 채팅·파일·커밋에 적지 않는다. 일감의 작성자는 그 키의 주인이 된다.
3. `vercel deploy --prod` (projects.json·환경변수 모두 새 배포부터 적용된다).

## 앱에 붙이기

```sh
pnpm install && pnpm run build
node scripts/vendor.mjs ../<앱>/public --app <이름> --endpoint https://qa-widget-gilt.vercel.app/p/<프로젝트 이름>   # 복사 + <script> 태그 출력
```

출력된 태그를 앱 `index.html` 에 넣는다. 복사 대신 `https://qa-widget-gilt.vercel.app/qa.js` 로 불러도 된다.

| 속성 | 뜻 |
|---|---|
| `data-endpoint` | QA 서버의 프로젝트 주소. 필수 |
| `data-app` | 일감 본문에 적는 앱 이름 |

## 시험

```sh
node test/fake.mjs 5399                                                             # 가짜 Linear(+ /qa.js, /page)
QA_LINEAR_URL=http://localhost:5399/graphql QA_KEY_FAC=test node server/dev.mjs 5397   # 로컬 QA 서버
```

`http://localhost:5399/page?endpoint=http://localhost:5397/p/graph-note` 를 열면 진짜 Linear 에 일감을 만들지 않고 전체 흐름을 볼 수 있다. 받은 요청은 `http://localhost:5399/log`.

## 캡처 라이브러리

snapdom. 안쪽 스크롤 위치·Tailwind 4 색(oklch)·SVG 그래프(React Flow)가 실제 화면과 같게 나온다. modern-screenshot 은 안쪽 스크롤을 무시해 뺐다. 알려진 결함: 스크롤한 상태에서 `position: sticky` 요소가 어긋난 자리에 찍힐 수 있다.

## 확인하지 못한 것

- 실제 아이폰·안드로이드 터치(3손가락 길게 누르기가 iOS 기본 제스처와 겹치는지, 손가락으로 그리기).
- 에이전트가 일감 본문의 이미지 주소를 `curl` 로 받아 읽는지(첫 일감으로 확인).
- 공개 이미지(`makePublic`) 주소가 로그인 없이 열리는지(첫 실제 전송으로 확인).
- 실제 Vercel → Linear 전송(키를 넣은 뒤 첫 전송으로 확인).
- WebGL·캔버스가 있는 화면은 비어 찍힐 수 있다.
