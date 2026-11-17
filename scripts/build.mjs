// dist/qa.js 한 파일로 묶는다(IIFE, 압축). 앱 쪽에는 이 파일 하나와 <script> 태그 하나만 둔다.
import { build } from "esbuild"
import { statSync } from "node:fs"

await build({
  entryPoints: ["src/qa.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2022",
  outfile: "dist/qa.js",
  legalComments: "none",
  logLevel: "warning",
})
console.log(`dist/qa.js ${(statSync("dist/qa.js").size / 1024).toFixed(0)}KB`)
