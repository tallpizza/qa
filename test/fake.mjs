// 시험용 가짜 Linear. QA 서버(server/dev.mjs)의 QA_LINEAR_URL 을 여기로 돌리면 진짜 Linear 에 일감을 만들지 않고 전체 흐름을 본다.
//   node test/fake.mjs [포트=5399]   →  POST /graphql(fileUpload·issueCreate), PUT /storage/<n>, GET /log, GET /qa.js, GET /page?endpoint=<QA 서버 프로젝트 주소>
import { createServer } from "node:http"
import { readFileSync, writeFileSync } from "node:fs"

const port = Number(process.argv[2] ?? 5399)
const log = []

createServer((req, res) => {
  const url = new URL(req.url, "http://x")
  const base = `http://${req.headers.host}`
  if (req.method === "GET" && url.pathname === "/qa.js") return res.writeHead(200, { "content-type": "text/javascript" }).end(readFileSync(new URL("../dist/qa.js", import.meta.url)))
  if (req.method === "GET" && url.pathname === "/page") {
    const endpoint = (url.searchParams.get("endpoint") ?? "").replace(/"/g, "")
    return res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(`<!doctype html><meta charset=utf-8><title>시험 페이지</title><body style="font:16px system-ui;padding:24px"><h1>시험 페이지</h1><p>QA 도구 시험용입니다.</p><button id=card style="padding:24px">카드</button><script src="/qa.js" defer data-endpoint="${endpoint}" data-app="fake"></script>`)
  }
  if (req.method === "GET" && url.pathname === "/log") return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(log))
  const chunks = []
  req.on("data", (c) => chunks.push(c))
  req.on("end", () => {
    const body = Buffer.concat(chunks)
    if (req.method === "PUT" && url.pathname.startsWith("/storage/")) {
      const n = url.pathname.split("/").pop()
      writeFileSync(new URL(`./out-upload-${n}`, import.meta.url), body)
      log.push({ kind: "put", bytes: body.length, contentType: req.headers["content-type"], signed: req.headers["x-signed"] })
      return res.writeHead(200).end()
    }
    if (url.pathname === "/graphql") {
      const j = JSON.parse(body.toString("utf8"))
      if (j.query.includes("fileUpload")) {
        const n = log.filter((l) => l.kind === "fileUpload").length + 1
        log.push({ kind: "fileUpload", authorization: req.headers.authorization, vars: j.variables })
        const uploadFile = { uploadUrl: `${base}/storage/${n}`, assetUrl: `${base}/img/${n}`, headers: [{ key: "x-signed", value: "yes" }] }
        return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: { fileUpload: { success: true, uploadFile } } }))
      }
      log.push({ kind: "issueCreate", authorization: req.headers.authorization, input: j.variables.i })
      return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ data: { issueCreate: { success: true, issue: { identifier: "FAC-TEST", url: "https://example.invalid" } } } }))
    }
    res.writeHead(404).end()
  })
}).listen(port, "0.0.0.0", () => console.log(`fake linear on :${port}`))
