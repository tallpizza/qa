// 빌드한 dist/qa.js 를 앱의 정적 폴더에 복사하고, 그 앱 index.html 에 넣을 <script> 태그를 보여 준다.
//   pnpm run build && node scripts/vendor.mjs ../graph-note/public --app graph-note --team <팀 id> --project <프로젝트 id> --state <상태 id> --upload <이미지 올리는 서버 /upload 주소>
import { copyFileSync, existsSync } from "node:fs"
import { join, resolve } from "node:path"

const [dest, ...rest] = process.argv.slice(2)
const opt = (name) => rest[rest.indexOf(`--${name}`) + 1]
if (!dest || !existsSync(dest)) throw new Error("사용법: node scripts/vendor.mjs <앱 정적 폴더> --app <이름> --team <팀 id> --project <프로젝트 id> --state <상태 id> --upload <이미지 올리는 서버 /upload 주소>")
copyFileSync("dist/qa.js", join(dest, "qa.js"))
console.log(`복사: ${resolve(dest, "qa.js")}`)
console.log(`<script src="/qa.js" defer data-team="${opt("team") ?? "<팀 id>"}" data-project="${opt("project") ?? "<프로젝트 id>"}" data-state="${opt("state") ?? "<상태 id>"}" data-app="${opt("app") ?? "<앱 이름>"}" data-upload-url="${opt("upload") ?? "<이미지 올리는 서버 /upload 주소>"}"></script>`)
