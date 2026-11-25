// 빌드한 dist/qa.js 를 앱의 정적 폴더에 복사하고, 그 앱 index.html 에 넣을 <script> 태그를 보여 준다.
//   pnpm run build && node scripts/vendor.mjs ../graph-note/public --app graph-note --endpoint https://<QA 서버 도메인>/p/graph-note
// 프로젝트(팀·프로젝트·시작 상태·허용 출처)는 projects.json 에, 그 Linear 키는 Vercel 환경변수 QA_KEY_<프로젝트 이름> 에 먼저 넣는다.
import { copyFileSync, existsSync } from "node:fs"
import { join, resolve } from "node:path"

const [dest, ...rest] = process.argv.slice(2)
const opt = (name) => rest[rest.indexOf(`--${name}`) + 1]
if (!dest || !existsSync(dest)) throw new Error("사용법: node scripts/vendor.mjs <앱 정적 폴더> --app <이름> --endpoint <QA 서버 프로젝트 주소>")
copyFileSync("dist/qa.js", join(dest, "qa.js"))
console.log(`복사: ${resolve(dest, "qa.js")}`)
console.log(`<script src="/qa.js" defer data-endpoint="${opt("endpoint") ?? "<QA 서버 프로젝트 주소>"}" data-app="${opt("app") ?? "<앱 이름>"}"></script>`)
