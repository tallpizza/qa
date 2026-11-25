// 로컬에서 QA 서버를 띄운다(시험용). Vercel 과 같은 handle 을 node http 로 감싼다.
//   QA_LINEAR_URL=http://localhost:5399/graphql QA_KEY_FAC=test node server/dev.mjs [포트=5398]
import { createServer } from "node:http"
import { handle } from "./handler.mjs"

const port = Number(process.argv[2] ?? 5398)
createServer(async (req, res) => {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const body = chunks.length ? Buffer.concat(chunks) : undefined
  const out = await handle(new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, body: req.method === "GET" || req.method === "HEAD" ? undefined : body }))
  res.writeHead(out.status, Object.fromEntries(out.headers)).end(Buffer.from(await out.arrayBuffer()))
}).listen(port, "0.0.0.0", () => console.log(`qa server on :${port}`))
