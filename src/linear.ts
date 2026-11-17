import type { Config } from "./config"

const MUTATION = "mutation($i: IssueCreateInput!) { issueCreate(input: $i) { success issue { identifier url } } }"

export type Created = { identifier?: string; url?: string }

// 개인 API 키는 Authorization 에 그대로, OAuth 토큰(lin_oauth_)은 Bearer. 상태는 넣지 않아 팀 기본(대기)이 된다.
export async function createIssue(cfg: Config, key: string, title: string, description: string): Promise<Created> {
  const auth = key.startsWith("lin_oauth_") ? `Bearer ${key}` : key
  let res: Response
  try {
    res = await fetch(cfg.linearUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({ query: MUTATION, variables: { i: { teamId: cfg.team, projectId: cfg.project, title, description } } }),
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
