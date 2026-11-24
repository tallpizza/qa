// 시험용 가짜 서버. 실제 Linear·이미지 올리는 서버 대신 받은 요청을 기록하고 정상 응답을 돌려준다.
//   node test/fake.mjs [포트=5399]   →  /qa.js (빌드 파일), POST /graphql, POST /upload, GET /log
import { createServer } from "node:http"
import { readFileSync, writeFileSync } from "node:fs"

const port = Number(process.argv[2] ?? 5399)
const log = []
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,OPTIONS" }

createServer((req, res) => {
  const url = new URL(req.url, "http://x")
  if (req.method === "OPTIONS") return res.writeHead(204, cors).end()
  if (req.method === "GET" && url.pathname === "/qa.js") return res.writeHead(200, { ...cors, "content-type": "text/javascript" }).end(readFileSync(new URL("../dist/qa.js", import.meta.url)))
  // 시험 전용 페이지. /page?state=<상태 id> 로 열면 같은 출처의 /graphql·/upload 로 보내는 위젯이 붙는다. ?upload=<주소> 로 이미지 올리는 서버만 진짜로 바꿀 수 있다
  if (req.method === "GET" && url.pathname === "/page") {
    const attrs = `data-team="test-team" data-project="test-project" data-app="fake" data-linear-url="/graphql" data-upload-url="${(url.searchParams.get("upload") ?? "/upload").replace(/"/g, "")}"${url.searchParams.get("state") ? ` data-state="${url.searchParams.get("state")}"` : ""}`
    return res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(`<!doctype html><meta charset=utf-8><title>시험 페이지</title><body style="font:16px system-ui;padding:24px"><h1>시험 페이지</h1><p>QA 도구 시험용입니다.</p><button id=card style="padding:24px">카드</button><script src="/qa.js" defer ${attrs}></script>`)
  }
  if (req.method === "GET" && url.pathname === "/log") return res.writeHead(200, { ...cors, "content-type": "application/json" }).end(JSON.stringify(log))
  const chunks = []
  req.on("data", (c) => chunks.push(c))
  req.on("end", () => {
    const body = Buffer.concat(chunks)
    if (url.pathname === "/upload") {
      const n = log.filter((l) => l.kind === "upload").length + 1
      writeFileSync(new URL(`./out-upload-${n}.png`, import.meta.url), body)
      log.push({ kind: "upload", bytes: body.length, authorization: req.headers.authorization, contentType: req.headers["content-type"]?.split(";")[0] })
      return res.writeHead(200, { ...cors, "content-type": "application/json" }).end(JSON.stringify({ url: `http://${req.headers.host}/img/${n}.png` }))
    }
    if (url.pathname === "/graphql") {
      const j = JSON.parse(body.toString("utf8"))
      log.push({ kind: "graphql", authorization: req.headers.authorization, input: j.variables.i })
      return res.writeHead(200, { ...cors, "content-type": "application/json" }).end(JSON.stringify({ data: { issueCreate: { success: true, issue: { identifier: "FAC-TEST", url: "https://example.invalid" } } } }))
    }
    res.writeHead(404, cors).end()
  })
}).listen(port, "0.0.0.0", () => console.log(`fake on :${port}`))
