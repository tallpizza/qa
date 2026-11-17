# QA

모든 웹앱에 한 줄로 붙이는 QA 도구. 평소에는 화면에 아무것도 없고, 단축키로 불러 영역을 고르고 찍고 표시해서 Linear 일감으로 보낸다.

```
Alt+Shift+Q (맥은 Option+Shift+Q, ⌥⇧Q) / 손가락 3개로 0.7초 길게 누르기(휴대폰)
 → 영역 고르기(▲ 상위 ▼ 하위, 전체 화면) → 촬영 → 펜·화살표·사각형·가리기 + 메모
 → 이미지는 Litterbox(72시간 뒤 삭제)에 올리고, Linear 팀 FAC 에 프로젝트를 붙여 일감 생성(상태는 팀 기본=대기)
```

서버가 없다. 키는 쓰는 사람의 브라우저(localStorage, 주소마다)에만 저장되고 앱 코드에는 없다. 키가 없으면 도구는 아무 반응도 하지 않는다.

## 앱에 붙이기

```sh
pnpm install && pnpm run build
node scripts/vendor.mjs ../<앱>/public --app <이름> --team <팀 id> --project <프로젝트 id>   # 복사 + <script> 태그 출력
```

출력된 태그를 앱 `index.html` 에 넣는다. 복사 대신 CDN 으로 불러도 된다: `https://cdn.jsdelivr.net/gh/tallpizza/qa@<태그 또는 커밋>/dist/qa.js` (`@main` 은 캐시가 길어 고정 버전을 권한다). 팀·프로젝트 id 는 Linear 에서 얻는다(비밀값 아님).

| 속성 | 뜻 |
|---|---|
| `data-team` · `data-project` | Linear 팀 id(FAC) · 그 앱 프로젝트 id. 필수 |
| `data-app` | 일감 본문에 적는 앱 이름 |
| `data-expire` | 이미지 보관 `1h` `12h` `24h` `72h`(기본 72h) |
| `data-linear-url` · `data-upload-url` | 시험 때 가짜 서버로 바꾼다 |

## 처음 쓸 때 (기기·주소마다 한 번)

1. Linear → 설정 → 보안 및 접근 → 개인 API 키. 권한은 "일감 만들기"만, 그 팀만.
2. 앱에서 단축키(또는 3손가락 길게 누르기)를 누르면 키가 없을 때 키 입력창이 뜬다. 키를 넣으면 저장되고 그 뒤부터 촬영이 열린다. 주소 끝에 `?qa=setup` 을 붙여도 열린다(키 바꾸기·지우기). 키는 채팅·파일·커밋에 적지 않는다.

키는 그 브라우저의 그 주소(출처)에만 저장된다. `localhost` 와 배포 주소는 따로 넣는다.

## 시험

`node test/fake.mjs 5399` 가 Linear·Litterbox 대역과 `/qa.js` 를 낸다. 앱 페이지에서 `<script src="http://<호스트>:5399/qa.js" data-linear-url="http://<호스트>:5399/graphql" data-upload-url="http://<호스트>:5399/upload" data-team=… data-project=…>` 를 주입하면 진짜 Linear 에 일감을 만들지 않고 전체 흐름을 볼 수 있다.

## 캡처 라이브러리

snapdom. 안쪽 스크롤 위치·Tailwind 4 색(oklch)·SVG 그래프(React Flow)가 실제 화면과 같게 나온다. modern-screenshot 은 안쪽 스크롤을 무시해 뺐다. 알려진 결함: 스크롤한 상태에서 `position: sticky` 요소가 어긋난 자리에 찍힐 수 있다.

## 확인하지 못한 것

- 실제 아이폰·안드로이드 터치(3손가락 길게 누르기가 iOS 기본 제스처와 겹치는지, 손가락으로 그리기).
- 에이전트가 일감 본문의 이미지 주소를 `curl` 로 받아 읽는지(첫 일감으로 확인).
- WebGL·캔버스가 있는 화면은 비어 찍힐 수 있다.
