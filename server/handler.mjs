// QA 서버. 위젯이 보낸 그림과 일감을 프로젝트(엔드포인트)별 Linear 키로 Linear 에 넣는다. Vercel 에서 돈다(api/index.mjs).
// 키는 위젯·브라우저에 없다. 프로젝트 설정(팀·프로젝트·시작 상태·허용 출처)은 projects.json, 키는 팀마다 환경변수 QA_KEY_<팀 키>(예: QA_KEY_FAC).
// Linear 개인 API 키는 팀 단위로만 권한을 나눌 수 있어 키도 팀마다 하나다.
//   GET  /health
//   POST /p/<프로젝트>/upload  본문: 그림 바이트(image/png·jpeg·webp) → 200 {"url": Linear 공개 이미지 주소}
//   POST /p/<프로젝트>/issue   본문: {"title","description"} → 200 {"identifier","url"}
//   실패 → 4xx·5xx {"error": 사람이 읽는 문구}
// 엔드포인트 주소는 앱 페이지 소스에 보이므로, 브라우저 Origin 이 그 프로젝트의 허용 출처가 아니면 거절한다.
import config from "../projects.json" with { type: "json" }

const { teams, projects } = config

const LINEAR = process.env.QA_LINEAR_URL ?? "https://api.linear.app/graphql"
const MAX_MB = 4 // Vercel 함수 요청 본문 한도(4.5MB) 아래
const TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }
const UPLOAD =
  "mutation($size: Int!, $type: String!, $name: String!) { fileUpload(size: $size, contentType: $type, filename: $name, makePublic: true) { success uploadFile { uploadUrl assetUrl headers { key value } } } }"
const ISSUE = "mutation($i: IssueCreateInput!) { issueCreate(input: $i) { success issue { identifier url } } }"

class Fail extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export const keyEnv = (name) => `QA_KEY_${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`

// "http://localhost:*" 처럼 * 는 아무 글자(포트 등)
const allowed = (origin, patterns) =>
  patterns.some((p) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`).test(origin))

const json = (status, obj, cors = {}) => new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json; charset=utf-8" } })

async function linear(key, query, variables) {
  let res
  try {
    res = await fetch(LINEAR, { method: "POST", headers: { "content-type": "application/json", authorization: key }, body: JSON.stringify({ query, variables }) })
  } catch {
    throw new Fail(502, "QA 서버가 Linear 에 닿지 못했습니다. 다시 보내 보세요.")
  }
  const out = await res.json().catch(() => null)
  const err = out?.errors?.[0]
  if (err || !res.ok) {
    const said = err?.message ?? `상태 ${res.status}`
    if (err?.extensions?.code === "AUTHENTICATION_ERROR" || res.status === 401)
      throw new Fail(502, `QA 서버의 이 프로젝트 Linear 키가 맞지 않습니다. 관리자에게 알려 주세요. (Linear: ${said})`)
    if (err?.extensions?.code === "FORBIDDEN" || res.status === 403 || /scope|permission/i.test(said))
      throw new Fail(502, `QA 서버의 이 프로젝트 Linear 키에 권한이 없습니다. 관리자에게 알려 주세요. (Linear: ${said})`)
    throw new Fail(502, `Linear 가 요청을 받지 않았습니다. 다시 보내 보세요. (Linear: ${said})`)
  }
  return out.data
}

async function upload(key, req) {
  const type = String(req.headers.get("content-type") ?? "").split(";")[0].trim()
  if (!TYPES[type]) throw new Fail(415, `그림만 받습니다(png·jpeg·webp). 받은 형식: ${type || "없음"}`)
  const body = new Uint8Array(await req.arrayBuffer())
  if (!body.length) throw new Fail(400, "그림이 비어 있습니다.")
  if (body.length > MAX_MB * 1024 * 1024) throw new Fail(413, `그림이 너무 큽니다(최대 ${MAX_MB}MB).`)
  const made = (await linear(key, UPLOAD, { size: body.length, type, name: `qa.${TYPES[type]}` }))?.fileUpload
  if (!made?.success || !made.uploadFile) throw new Fail(502, "Linear 가 이미지 자리를 주지 않았습니다. 다시 보내 보세요.")
  // 서명에 들어간 헤더는 값을 바꾸지 않고 그대로 보낸다(바꾸면 저장소가 403 을 준다)
  const headers = { "content-type": type, "cache-control": "public, max-age=31536000" }
  for (const { key: k, value } of made.uploadFile.headers) headers[k.toLowerCase()] = value
  let res
  try {
    res = await fetch(made.uploadFile.uploadUrl, { method: "PUT", headers, body })
  } catch {
    throw new Fail(502, "Linear 저장소에 닿지 못했습니다. 다시 보내 보세요.")
  }
  if (!res.ok) throw new Fail(502, `Linear 저장소가 그림을 받지 않았습니다(상태 ${res.status}). 다시 보내 보세요.`)
  return { url: made.uploadFile.assetUrl }
}

// 상태를 넣지 않으면 Triage 가 켜진 팀에서는 API 로 만든 일감이 Triage 로 들어가 일감 흐름이 집어 가지 못한다
async function issue(key, p, req) {
  const b = await req.json().catch(() => null)
  if (typeof b?.title !== "string" || !b.title.trim() || typeof b.description !== "string") throw new Fail(400, "제목과 본문이 필요합니다.")
  const input = { teamId: teams[p.team], projectId: p.project, ...(p.state ? { stateId: p.state } : {}), title: b.title.slice(0, 250), description: b.description }
  const made = (await linear(key, ISSUE, { i: input }))?.issueCreate
  if (!made?.success) throw new Fail(502, "Linear 가 일감을 받지 않았습니다. 다시 보내 보세요.")
  return { identifier: made.issue?.identifier, url: made.issue?.url }
}

export async function handle(req) {
  const path = new URL(req.url).pathname
  if (req.method === "GET" && path === "/health") return json(200, { ok: true })
  const m = path.match(/^\/p\/([a-z0-9-]+)\/(upload|issue)$/)
  const p = m && Object.hasOwn(projects, m[1]) ? projects[m[1]] : null
  if (!p) return json(404, { error: "없는 주소입니다." })
  const origin = req.headers.get("origin") ?? ""
  const ok = allowed(origin, p.origins)
  const cors = ok
    ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "600", vary: "origin" }
    : { vary: "origin" }
  if (req.method === "OPTIONS") return new Response(null, { status: ok ? 204 : 403, headers: cors })
  if (req.method !== "POST") return json(405, { error: "POST 만 받습니다." }, cors)
  try {
    if (!ok) throw new Fail(403, `이 화면 주소(${origin || "출처 없음"})는 QA 서버의 ${m[1]} 허용 목록에 없습니다.`)
    const key = process.env[keyEnv(p.team)]
    if (!key) throw new Fail(503, `QA 서버에 ${p.team} 팀의 Linear 키가 아직 없습니다. 관리자에게 알려 주세요.`)
    const out = m[2] === "upload" ? await upload(key, req) : await issue(key, p, req)
    console.log(`${m[1]} ${m[2]} ${origin}`)
    return json(200, out, cors)
  } catch (e) {
    if (e instanceof Fail) console.log(`${m[1]} ${m[2]} 거절 ${e.status} ${origin} ${e.message}`)
    else console.error(e)
    return json(e instanceof Fail ? e.status : 500, { error: e instanceof Fail ? e.message : "QA 서버에 오류가 났습니다. 다시 보내 보세요." }, cors)
  }
}
