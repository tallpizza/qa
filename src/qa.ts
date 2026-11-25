// QA 도구 진입점. 평소에는 화면에 아무것도 없고, 단축키(PC)·손가락 3개 길게 누르기(휴대폰)로만 나타난다.
// 흐름: 영역 고르기 → 촬영 → 표시·메모 → 이미지 올리기(QA 서버 → Linear 공개 이미지) → Linear 일감(QA 서버가 프로젝트별 키·팀·프로젝트·시작 상태를 붙인다).
import { capture } from "./capture"
import { readConfig, type Config } from "./config"
import { buildReport, describeElement, startErrorCapture, type ElementInfo } from "./context"
import { openEditor } from "./editor"
import { createIssue } from "./linear"
import { pickArea } from "./pick"
import { clearToast, toast } from "./ui"
import { installTriggers } from "./trigger"
import { uploadImage } from "./upload"

const cfg = readConfig()
let running = false

async function run(c: Config) {
  if (running) return
  running = true
  try {
    const picked = await pickArea()
    if (picked.kind === "cancel") return
    let info: ElementInfo | undefined
    if (picked.kind === "element") info = describeElement(picked.el)
    toast("화면을 찍는 중…", { keep: true })
    let canvas: HTMLCanvasElement
    try {
      canvas = await capture(picked.kind === "element" ? picked.el : null)
    } catch (e) {
      toast(`화면을 찍지 못했습니다. ${e instanceof Error ? e.message : ""}`, { error: true })
      return
    }
    clearToast()
    const done = await openEditor(canvas, async (blob, note, progress) => {
      progress("이미지를 올리는 중…")
      const imageUrl = await uploadImage(c, blob)
      progress("일감을 만드는 중…")
      const { title, description } = buildReport({ app: c.app, note, imageUrl, target: info })
      const made = await createIssue(c, title, description)
      return made.identifier ? `${made.identifier} 일감으로 보냈습니다` : "일감으로 보냈습니다"
    })
    if (done) toast(done)
  } finally {
    running = false
  }
}

function init(c: Config) {
  installTriggers(() => void run(c))
  startErrorCapture()
}

// 같은 페이지에 태그가 두 번 들어가도 한 번만 켠다(단축키가 두 번 반응하지 않게)
const flag = window as unknown as { __qa?: boolean }
if (cfg && !flag.__qa) {
  flag.__qa = true
  if (document.body) init(cfg)
  else document.addEventListener("DOMContentLoaded", () => init(cfg), { once: true })
}
