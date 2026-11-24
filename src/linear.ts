import type { Config } from "./config"

const MUTATION = "mutation($i: IssueCreateInput!) { issueCreate(input: $i) { success issue { identifier url } } }"

export type Created = { identifier?: string; url?: string }

// 개인 API 키는 Authorization 에 그대로, OAuth 토큰(lin_oauth_)은 Bearer. 이미지 올리는 서버에도 같은 값을 넘긴다
export const authHeader = (key: string) => (key.startsWith("lin_oauth_") ? `Bearer ${key}` : key)

// 상태를 넣지 않으면 Triage 가 켜진 팀에서는 API 로 만든 일감이 Triage 로 들어가 일감 흐름이 집어 가지 못한다. 시작 상태는 data-state 로 지정한다.
export async function createIssue(cfg: Config, key: string, title: string, description: string): Promise<Created> {
  const auth = authHeader(key)
  let res: Response
  try {
    res = await fetch(cfg.linearUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({ query: MUTATION, variables: { i: { teamId: cfg.team, projectId: cfg.project, ...(cfg.state ? { stateId: cfg.state } : {}), title, description } } }),
    })
  } catch {
    throw new Error("Linear 에 닿지 못했습니다. 네트워크를 확인해 주세요.")
  }
  if (res.status === 401 || res.status === 403) throw new Error("Linear 키가 맞지 않습니다. 주소 끝에 ?qa=setup 을 붙여 키를 다시 넣어 주세요.")
  const out = (await res.json().catch(() => null)) as { data?: { issueCreate?: { success?: boolean; issue?: Created | null } }; errors?: { message: string }[] } | null
  const made = out?.data?.issueCreate
  if (!res.ok || !made?.success) throw new Error(`Linear 가 일감을 받지 않았습니다. ${out?.errors?.[0]?.message ?? `상태 ${res.status}`}`)
  return made.issue ?? {}
}
