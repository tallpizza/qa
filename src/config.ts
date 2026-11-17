// 설정은 <script> 태그의 data- 속성으로 받는다. 비밀값(키)은 여기에 없고 쓰는 사람의 브라우저에만 저장된다.
export type Expire = "1h" | "12h" | "24h" | "72h"
export type Config = {
  team: string // Linear 팀 id (FAC)
  project: string // Linear 프로젝트 id (그 앱)
  app: string // 사람이 읽는 앱 이름. 일감 본문에 적는다
  linearUrl: string
  uploadUrl: string
  expire: Expire
}

const EXPIRES: Expire[] = ["1h", "12h", "24h", "72h"]

export function readConfig(): Config | null {
  const tag = (document.currentScript as HTMLScriptElement | null) ?? document.querySelector<HTMLScriptElement>("script[data-team][data-project]")
  const d = tag?.dataset
  if (!d?.team || !d.project) {
    console.warn("[qa] data-team, data-project 가 없어 꺼 둡니다")
    return null
  }
  const expire = EXPIRES.find((e) => e === d.expire) ?? "72h"
  return {
    team: d.team,
    project: d.project,
    app: d.app ?? location.hostname,
    linearUrl: d.linearUrl ?? "https://api.linear.app/graphql",
    uploadUrl: d.uploadUrl ?? "https://litterbox.catbox.moe/resources/internals/api.php",
    expire,
  }
}
