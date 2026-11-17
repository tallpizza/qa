// 시험용 가짜 서버. 실제 Linear·Litterbox 대신 받은 요청을 기록하고 정상 응답을 돌려준다.
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
  if (req.method === "GET" && url.pathname === "/log") return res.writeHead(200, { ...cors, "content-type": "application/json" }).end(JSON.stringify(log))
  const chunks = []
  req.on("data", (c) => chunks.push(c))
  req.on("end", () => {
    const body = Buffer.concat(chunks)
    if (url.pathname === "/upload") {
      const n = log.filter((l) => l.kind === "upload").length + 1
      const fields = [...body.toString("latin1").matchAll(/name="(reqtype|time)"\r\n\r\n([^\r]*)/g)].map((m) => [m[1], m[2]])
      writeFileSync(new URL(`./out-upload-${n}.png`, import.meta.url), body.subarray(body.indexOf(Buffer.from("\r\n\r\n", "latin1"), body.indexOf("fileToUpload")) + 4, body.lastIndexOf("\r\n--")))
      log.push({ kind: "upload", bytes: body.length, fields: Object.fromEntries(fields), contentType: req.headers["content-type"]?.split(";")[0] })
      return res.writeHead(200, { ...cors, "content-type": "text/html" }).end(`http://${req.headers.host}/img/${n}.png`)
    }
    if (url.pathname === "/graphql") {
      const j = JSON.parse(body.toString("utf8"))
      log.push({ kind: "graphql", authorization: req.headers.authorization, input: j.variables.i })
      return res.writeHead(200, { ...cors, "content-type": "application/json" }).end(JSON.stringify({ data: { issueCreate: { success: true, issue: { identifier: "FAC-TEST", url: "https://example.invalid" } } } }))
    }
    res.writeHead(404, cors).end()
  })
}).listen(port, "0.0.0.0", () => console.log(`fake on :${port}`))
