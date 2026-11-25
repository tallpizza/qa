// Vercel 함수. 모든 주소를 여기로 보낸다(vercel.json rewrites). 실제 처리는 server/handler.mjs
import { handle } from "../server/handler.mjs"

export default { fetch: handle }
