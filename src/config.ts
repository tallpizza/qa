// 설정은 <script> 태그의 data- 속성으로 받는다. 비밀값(키)은 여기에 없고 쓰는 사람의 브라우저에만 저장된다.
export type Config = {
  team: string // Linear 팀 id (FAC)
  project: string // Linear 프로젝트 id (그 앱)
  state?: string // 일감이 시작할 Linear 상태 id. 비우면 팀 설정을 따르고, Triage 가 켜진 팀에서는 Triage 로 들어간다
  app: string // 사람이 읽는 앱 이름. 일감 본문에 적는다
  linearUrl: string
  uploadUrl: string // 이미지 올리는 서버(server/upload.mjs)의 /upload 주소
}

export function readConfig(): Config | null {
  const tag = (document.currentScript as HTMLScriptElement | null) ?? document.querySelector<HTMLScriptElement>("script[data-team][data-project]")
  const d = tag?.dataset
  if (!d?.team || !d.project) {
    console.warn("[qa] data-team, data-project 가 없어 꺼 둡니다")
    return null
  }
  return {
    team: d.team,
    project: d.project,
    state: d.state || undefined,
    app: d.app ?? location.hostname,
    linearUrl: d.linearUrl ?? "https://api.linear.app/graphql",
    // 비우면 앱과 같은 호스트의 5398 포트(macmini 에서 도는 앱용). https 로 배포한 앱은 https 주소를 넣어야 한다
    uploadUrl: d.uploadUrl ?? `http://${location.hostname}:5398/upload`,
  }
}
