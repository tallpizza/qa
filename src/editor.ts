import { h } from "./dom"
import { mountHost } from "./ui"

type Tool = "pen" | "arrow" | "rect" | "block"
type Pt = [number, number]
type Shape = { tool: "pen"; pts: Pt[] } | { tool: "arrow" | "rect" | "block"; a: Pt; b: Pt }

const TOOLS: { tool: Tool; name: string }[] = [
  { tool: "pen", name: "펜" },
  { tool: "arrow", name: "화살표" },
  { tool: "rect", name: "사각형" },
  { tool: "block", name: "가리기" },
]

// 찍은 그림 위에 마우스·터치로 표시하고 메모를 쓴다. 좌표는 그림 픽셀 기준이라 화면 크기와 무관하다.
// send 는 이미지와 메모를 받아 성공 문구를 돌려준다. 던지면 편집기를 닫지 않고 오류를 보여 주므로 표시한 것을 잃지 않는다.
export function openEditor(base: HTMLCanvasElement, send: (blob: Blob, note: string, progress: (m: string) => void) => Promise<string>): Promise<string | null> {
  const { layer, unmount } = mountHost()
  return new Promise((resolve) => {
    const canvas = h("canvas", { width: base.width, height: base.height })
    const ctx = canvas.getContext("2d")!
    const shapes: Shape[] = []
    let live: Shape | null = null
    let tool: Tool = "pen"
    let busy = false
    const lw = Math.max(3, base.width / 350)

    const redraw = () => {
      ctx.drawImage(base, 0, 0)
      for (const s of live ? [...shapes, live] : shapes) draw(ctx, s, lw)
    }

    const toolBtns = TOOLS.map(({ tool: t, name }) => h("button", { type: "button", "aria-pressed": String(t === tool), onclick: () => setTool(t) }, name))
    const setTool = (t: Tool) => {
      tool = t
      TOOLS.forEach((x, i) => toolBtns[i]!.setAttribute("aria-pressed", String(x.tool === t)))
    }
    const undoBtn = h("button", { type: "button", onclick: () => { shapes.pop(); live = null; redraw(); sync() } }, "되돌리기")
    const closeBtn = h("button", { type: "button", "aria-label": "닫기", onclick: () => close(null) }, "닫기")
    const note = h("textarea", { rows: "2", placeholder: "무엇이 문제인가요? (비워도 됩니다)", "aria-label": "메모" })
    const status = h("div", { class: "status", role: "status" })
    const sendBtn = h("button", { type: "button", class: "primary", onclick: () => void submit() }, "보내기")
    const sync = () => (undoBtn.disabled = shapes.length === 0 || busy)

    layer.append(
      h(
        "div",
        { class: "editor", role: "dialog", "aria-label": "화면 표시와 메모" },
        h("div", { class: "top" }, ...toolBtns, undoBtn, h("span", { class: "grow" }), closeBtn),
        h("div", { class: "stage" }, canvas),
        h("div", { class: "foot" }, status, h("div", { class: "row" }, note, sendBtn)),
      ),
    )
    sync()
    redraw()

    // 포인터(마우스·터치·펜)로 그린다
    const at = (e: PointerEvent): Pt => {
      const r = canvas.getBoundingClientRect()
      return [((e.clientX - r.left) * canvas.width) / r.width, ((e.clientY - r.top) * canvas.height) / r.height]
    }
    canvas.addEventListener("pointerdown", (e) => {
      if (busy || (e.pointerType === "mouse" && e.button !== 0)) return
      canvas.setPointerCapture(e.pointerId)
      const p = at(e)
      live = tool === "pen" ? { tool, pts: [p] } : { tool, a: p, b: p }
      redraw()
    })
    canvas.addEventListener("pointermove", (e) => {
      if (!live) return
      const p = at(e)
      if (live.tool === "pen") live.pts.push(p)
      else live.b = p
      redraw()
    })
    const end = () => {
      if (!live) return
      const s = live
      live = null
      const tiny = s.tool === "pen" ? s.pts.length < 2 : Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) < lw * 2
      if (!tiny) shapes.push(s)
      redraw()
      sync()
    }
    canvas.addEventListener("pointerup", end)
    canvas.addEventListener("pointercancel", end)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) close(null)
    }
    window.addEventListener("keydown", onKey, true)

    function close(v: string | null) {
      window.removeEventListener("keydown", onKey, true)
      unmount()
      resolve(v)
    }

    async function submit() {
      if (busy) return
      busy = true
      for (const b of [sendBtn, closeBtn, ...toolBtns]) (b as HTMLButtonElement).disabled = true
      sync()
      status.className = "status"
      sendBtn.textContent = "보내는 중…"
      try {
        const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("이미지를 만들지 못했습니다."))), "image/png"))
        const done = await send(blob, note.value, (m) => (status.textContent = m))
        close(done)
      } catch (err) {
        busy = false
        for (const b of [sendBtn, closeBtn, ...toolBtns]) (b as HTMLButtonElement).disabled = false
        sync()
        sendBtn.textContent = "다시 보내기"
        status.className = "status err"
        status.textContent = err instanceof Error ? err.message : String(err)
      }
    }
  })
}

function draw(ctx: CanvasRenderingContext2D, s: Shape, lw: number) {
  ctx.save()
  ctx.lineCap = ctx.lineJoin = "round"
  ctx.lineWidth = lw
  ctx.strokeStyle = ctx.fillStyle = "#ff3b30"
  if (s.tool === "pen") {
    ctx.beginPath()
    s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.stroke()
  } else if (s.tool === "rect") {
    ctx.strokeRect(s.a[0], s.a[1], s.b[0] - s.a[0], s.b[1] - s.a[1])
  } else if (s.tool === "block") {
    ctx.fillStyle = "#000"
    ctx.fillRect(s.a[0], s.a[1], s.b[0] - s.a[0], s.b[1] - s.a[1])
  } else {
    const [x1, y1] = s.a
    const [x2, y2] = s.b
    const ang = Math.atan2(y2 - y1, x2 - x1)
    const head = lw * 5
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 7), y2 - head * Math.sin(ang - Math.PI / 7))
    ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 7), y2 - head * Math.sin(ang + Math.PI / 7))
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}
