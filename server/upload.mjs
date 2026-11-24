// 이미지 올리는 서버. 위젯이 보낸 그림을 Linear 에 공개 이미지로 올리고 그 주소를 돌려준다.
// 브라우저는 Linear 저장소(storage.googleapis.com)에 직접 올리지 못한다. 그 저장소는 linear.app 에서 온 요청만 받는다(CORS).
// 그래서 이 서버가 Linear 에 올릴 자리를 받고(fileUpload, makePublic) 그림을 대신 PUT 한다.
// 키는 저장하지 않는다. 요청마다 Authorization 헤더로 받아 Linear 에 그대로 넘긴다. 이 서버에는 비밀값이 없다.
//   node server/upload.mjs [포트=5398] [주소=0.0.0.0]
//   POST /upload  본문: 그림 바이트(Content-Type: image/png·jpeg·webp), Authorization: Linear 키
//     → 200 {"url": 이미지 주소} | 4xx·5xx {"error": 사람이 읽는 문구}
import { createServer } from "node:http"

const port = Number(process.argv[2] ?? 5398)
const host = process.argv[3] ?? "0.0.0.0"
const LINEAR = process.env.QA_LINEAR_URL ?? "https://api.linear.app/graphql"
const MAX_MB = 20
const TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }
const MUTATION =
  "mutation($size: Int!, $type: String!, $name: String!) { fileUpload(size: $size, contentType: $type, filename: $name, makePublic: true) { success uploadFile { uploadUrl assetUrl headers { key value } } } }"
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-private-network": "true",
  "access-control-max-age": "600",
}

class Fail extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on("data", (c) => {
      size += c.length
      if (size <= MAX_MB * 1024 * 1024) chunks.push(c)
    })
    req.on("end", () => (size > MAX_MB * 1024 * 1024 ? reject(new Fail(413, `그림이 너무 큽니다(최대 ${MAX_MB}MB).`)) : resolve(Buffer.concat(chunks))))
    req.on("error", reject)
  })
}

// Linear 에 올릴 자리(서명된 PUT 주소)를 받는다. Linear 의 문구를 그대로 붙여 키 문제인지 권한 문제인지 사람이 가릴 수 있게 한다.
async function slot(key, size, type) {
  let res
  try {
    res = await fetch(LINEAR, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: key },
      body: JSON.stringify({ query: MUTATION, variables: { size, type, name: `qa.${TYPES[type]}` } }),
    })
  } catch {
    throw new Fail(502, "이미지 올리는 서버가 Linear 에 닿지 못했습니다. 다시 보내 보세요.")
  }
  const out = await res.json().catch(() => null)
  const made = out?.data?.fileUpload
  if (made?.success && made.uploadFile) return made.uploadFile
  const err = out?.errors?.[0]
  const said = err?.message ?? `상태 ${res.status}`
  if (err?.extensions?.code === "AUTHENTICATION_ERROR" || res.status === 401)
    throw new Fail(401, `Linear 가 이 키로 이미지 올리기를 받지 않았습니다. 키가 틀렸거나, 키에 이미지 올리기 권한이 없을 수 있습니다. 키를 바꾸려면 주소 끝에 ?qa=setup 을 붙이세요. (Linear: ${said})`)
  if (err?.extensions?.code === "FORBIDDEN" || res.status === 403 || /scope|permission/i.test(said))
    throw new Fail(403, `이 Linear 키에는 이미지 올리기 권한이 없습니다. (Linear: ${said})`)
  throw new Fail(502, `Linear 가 이미지 자리를 주지 않았습니다. 다시 보내 보세요. (Linear: ${said})`)
}

// 서명에 들어간 헤더는 값을 바꾸지 않고 그대로 보낸다(바꾸면 저장소가 403 을 준다)
async function put(target, type, body) {
  const headers = { "content-type": type, "cache-control": "public, max-age=31536000" }
  for (const { key, value } of target.headers) headers[key.toLowerCase()] = value
  let res
  try {
    res = await fetch(target.uploadUrl, { method: "PUT", headers, body })
  } catch {
    throw new Fail(502, "Linear 저장소에 닿지 못했습니다. 다시 보내 보세요.")
  }
  if (!res.ok) throw new Fail(502, `Linear 저장소가 그림을 받지 않았습니다(상태 ${res.status}). 다시 보내 보세요.`)
}

createServer(async (req, res) => {
  const send = (status, obj) => res.writeHead(status, { ...CORS, "content-type": "application/json; charset=utf-8" }).end(JSON.stringify(obj))
  const path = (req.url ?? "").split("?")[0]
  const from = req.headers.origin ?? "-"
  if (req.method === "OPTIONS") return res.writeHead(204, CORS).end()
  if (req.method === "GET" && path === "/health") return send(200, { ok: true })
  if (req.method !== "POST" || path !== "/upload") return send(404, { error: "없는 주소입니다." })
  try {
    const key = req.headers.authorization
    if (!key) throw new Fail(401, "키가 없습니다. 주소 끝에 ?qa=setup 을 붙여 키를 넣어 주세요.")
    const type = String(req.headers["content-type"] ?? "").split(";")[0].trim()
    if (!TYPES[type]) throw new Fail(415, `그림만 받습니다(png·jpeg·webp). 받은 형식: ${type || "없음"}`)
    const body = await readBody(req)
    if (!body.length) throw new Fail(400, "그림이 비어 있습니다.")
    const target = await slot(key, body.length, type)
    await put(target, type, body)
    console.log(`${new Date().toISOString()} 올림 ${body.length}B ${from}`)
    send(200, { url: target.assetUrl })
  } catch (e) {
    if (e instanceof Fail) console.log(`${new Date().toISOString()} 거절 ${e.status} ${from} ${e.message}`)
    else console.error(e)
    send(e instanceof Fail ? e.status : 500, { error: e instanceof Fail ? e.message : "이미지 올리는 서버에 오류가 났습니다. 다시 보내 보세요." })
  }
}).listen(port, host, () => console.log(`qa upload on ${host}:${port}`))
