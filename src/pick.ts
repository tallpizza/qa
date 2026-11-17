import { describeElement } from "./context"
import { h } from "./dom"
import { HOST_ID, mountHost } from "./ui"

export type Pick = { kind: "element"; el: Element } | { kind: "screen" } | { kind: "cancel" }

// 앱의 클릭·터치가 동작하지 않게 가로채는 이벤트들. 고르는 동안만 막는다. 스크롤은 막지 않는다.
const BLOCKED = ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "touchstart", "touchend", "contextmenu"]

export function pickArea(): Promise<Pick> {
  const { host, layer, unmount } = mountHost()
  return new Promise<Pick>((resolve) => {
    const pressed = new Set<number>() // 고르기가 열린 뒤에 눌리기 시작한 포인터만 선택으로 센다(3손가락을 떼는 동작이 영역을 고르지 않게)
    let sel: Element | null = null
    let down: Element[] = [] // ▲ 로 올라올 때 지나온 요소. ▼ 가 이 길로 되돌아간다
    const hover = h("div", { class: "box hover", hidden: true })
    const selBox = h("div", { class: "box sel", hidden: true })
    const hint = h("span", { class: "label" }, "찍을 영역을 누르세요")
    const upBtn = h("button", { type: "button", "aria-label": "상위 영역", onclick: () => climb(1) }, "▲ 상위")
    const downBtn = h("button", { type: "button", "aria-label": "하위 영역", onclick: () => climb(-1) }, "▼ 하위")
    const shotBtn = h("button", { type: "button", class: "primary", onclick: () => finish({ kind: "element", el: sel! }) }, "촬영")
    const bar = h(
      "div",
      { class: "bar" },
      hint,
      upBtn,
      downBtn,
      shotBtn,
      h("button", { type: "button", onclick: () => finish({ kind: "screen" }) }, "전체 화면"),
      h("button", { type: "button", onclick: () => finish({ kind: "cancel" }) }, "취소"),
    )
    layer.append(hover, selBox, bar)

    const inHost = (e: Event) => e.composedPath().includes(host)
    const elementAt = (x: number, y: number): Element | null => document.elementsFromPoint(x, y).find((el) => el.id !== HOST_ID && !host.contains(el)) ?? null
    const place = (box: HTMLElement, el: Element | null) => {
      if (!el) return void (box.hidden = true)
      const r = el.getBoundingClientRect()
      Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` })
      box.hidden = false
    }
    const refresh = () => {
      place(selBox, sel)
      const has = !!sel
      for (const b of [upBtn, downBtn, shotBtn]) b.hidden = !has
      downBtn.hidden = !has || down.length === 0
      upBtn.hidden = !has || sel === document.body || !sel?.parentElement
      hint.textContent = sel ? describeElement(sel).label : "찍을 영역을 누르세요"
    }
    const select = (el: Element | null) => {
      sel = el
      down = []
      refresh()
    }
    const climb = (dir: 1 | -1) => {
      if (!sel) return
      if (dir === 1 && sel.parentElement && sel !== document.body) {
        down.push(sel)
        sel = sel.parentElement
      } else if (dir === -1 && down.length) sel = down.pop()!
      refresh()
    }

    const onBlocked = (e: Event) => {
      if (inHost(e)) return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (e.type === "pointerdown") pressed.add((e as PointerEvent).pointerId)
      if (e.type === "pointerup") {
        const p = e as PointerEvent
        if (!pressed.delete(p.pointerId) || (p.pointerType === "mouse" && p.button !== 0)) return
        select(elementAt(p.clientX, p.clientY))
      }
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || inHost(e)) return hover.setAttribute("hidden", "")
      place(hover, elementAt(e.clientX, e.clientY))
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish({ kind: "cancel" })
      else if (e.key === "ArrowUp" && sel) climb(1)
      else if (e.key === "ArrowDown" && sel) climb(-1)
      else if (e.key === "Enter" && sel) finish({ kind: "element", el: sel })
      else return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    const onScroll = () => {
      place(selBox, sel)
      hover.hidden = true
    }

    for (const t of BLOCKED) window.addEventListener(t, onBlocked, true)
    window.addEventListener("pointermove", onMove, true)
    window.addEventListener("keydown", onKey, true)
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onScroll)
    refresh()

    function finish(p: Pick) {
      for (const t of BLOCKED) window.removeEventListener(t, onBlocked, true)
      window.removeEventListener("pointermove", onMove, true)
      window.removeEventListener("keydown", onKey, true)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onScroll)
      unmount()
      resolve(p)
    }
  })
}
