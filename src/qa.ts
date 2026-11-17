// QA 도구 진입점. 평소에는 화면에 아무것도 없고, 단축키(PC)·손가락 3개 길게 누르기(휴대폰)로만 나타난다.
// 흐름: 영역 고르기 → 촬영 → 표시·메모 → 이미지 올리기(Litterbox) → Linear 일감(팀·프로젝트 붙임, 시작 상태는 data-state).
import { capture } from "./capture"
import { readConfig, type Config } from "./config"
import { buildReport, describeElement, startErrorCapture, type ElementInfo } from "./context"
import { openEditor } from "./editor"
import { createIssue } from "./linear"
import { pickArea } from "./pick"
import { openSetup } from "./setup"
import { getKey } from "./store"
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
      const key = getKey()
      if (!key) throw new Error("키가 없습니다. 주소 끝에 ?qa=setup 을 붙여 넣어 주세요.")
      progress("이미지를 올리는 중…")
      let imageUrl: string | undefined
      try {
        imageUrl = await uploadImage(c, blob)
      } catch (e) {
        throw new Error(`${e instanceof Error ? e.message : "이미지를 올리지 못했습니다."} 다시 보내 보세요.`)
      }
      progress("일감을 만드는 중…")
      const { title, description } = buildReport({ app: c.app, note, imageUrl, expire: c.expire.replace("h", "시간"), target: info })
      const made = await createIssue(c, key, title, description)
      return made.identifier ? `${made.identifier} 일감으로 보냈습니다` : "일감으로 보냈습니다"
    })
    if (done) toast(done)
  } finally {
    running = false
  }
}

// 키가 없으면 단축키·길게 누르기가 촬영 대신 키 입력창을 연다(아무 반응이 없으면 안 되는 것과 안 켜진 것을 구분할 수 없다).
async function setup(c: Config) {
  void c
  if (running) return
  running = true
  try {
    const r = await openSetup()
    if (r === "saved") {
      startErrorCapture()
      toast("저장했습니다. 이제 같은 단축키(맥은 Option+Shift+Q)나 손가락 3개 길게 누르기로 쓸 수 있습니다.")
    } else if (r === "cleared") toast("키를 지웠습니다.")
  } finally {
    running = false
  }
}

async function init(c: Config) {
  installTriggers(() => void (getKey() ? run(c) : setup(c)))
  if (getKey()) startErrorCapture()
  const url = new URL(location.href)
  if (url.searchParams.get("qa") === "setup") {
    await setup(c)
    url.searchParams.delete("qa")
    history.replaceState(history.state, "", url)
  }
}

// 같은 페이지에 태그가 두 번 들어가도 한 번만 켠다(단축키가 두 번 반응하지 않게)
const flag = window as unknown as { __qa?: boolean }
if (cfg && !flag.__qa) {
  flag.__qa = true
  if (document.body) void init(cfg)
  else document.addEventListener("DOMContentLoaded", () => void init(cfg), { once: true })
}
