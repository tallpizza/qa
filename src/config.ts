// 설정은 <script> 태그의 data- 속성으로 받는다. 키·팀·프로젝트는 QA 서버(server/handler.mjs, projects.json)에 있고 여기에는 엔드포인트 주소만 있다.
export type Config = {
  endpoint: string // QA 서버의 프로젝트 주소. 예: https://<도메인>/p/graph-note
  app: string // 사람이 읽는 앱 이름. 일감 본문에 적는다
}

export function readConfig(): Config | null {
  const tag = (document.currentScript as HTMLScriptElement | null) ?? document.querySelector<HTMLScriptElement>("script[data-endpoint]")
  const d = tag?.dataset
  if (!d?.endpoint) {
    console.warn("[qa] data-endpoint 가 없어 꺼 둡니다")
    return null
  }
  return { endpoint: d.endpoint.replace(/\/+$/, ""), app: d.app ?? location.hostname }
}
