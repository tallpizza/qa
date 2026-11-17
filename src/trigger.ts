// 켜는 방법. PC: Alt+Shift+Q(맥은 Option+Shift+Q). 휴대폰: 손가락 3개로 0.7초 길게 누르기. 키가 없으면 열리는 것이 촬영이 아니라 키 입력창이다(qa.ts).
const HOLD_MS = 700
const MOVE_PX = 24

export function installTriggers(open: () => void): () => void {
  const onKey = (e: KeyboardEvent) => {
    // e.code 로 비교한다: 글자(key)는 맥 Option 조합에서 "Œ", 한글 입력기에서 "Process" 로 바뀌지만 물리 키(code)는 그대로다
    if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.repeat && e.code === "KeyQ") {
      e.preventDefault()
      open()
    }
  }
  let timer = 0
  let start: { x: number; y: number }[] = []
  const cancel = () => {
    clearTimeout(timer)
    timer = 0
  }
  const onTouchStart = (e: TouchEvent) => {
    cancel()
    if (e.touches.length !== 3) return
    start = [...e.touches].map((t) => ({ x: t.clientX, y: t.clientY }))
    timer = window.setTimeout(() => {
      timer = 0
      navigator.vibrate?.(30)
      open()
    }, HOLD_MS)
  }
  const onTouchMove = (e: TouchEvent) => {
    if (!timer) return
    const moved = [...e.touches].some((t, i) => Math.hypot(t.clientX - (start[i]?.x ?? t.clientX), t.clientY - (start[i]?.y ?? t.clientY)) > MOVE_PX)
    if (moved || e.touches.length !== 3) cancel()
  }
  window.addEventListener("keydown", onKey)
  window.addEventListener("touchstart", onTouchStart, { passive: true })
  window.addEventListener("touchmove", onTouchMove, { passive: true })
  window.addEventListener("touchend", cancel, { passive: true })
  window.addEventListener("touchcancel", cancel, { passive: true })
  return () => {
    cancel()
    window.removeEventListener("keydown", onKey)
    window.removeEventListener("touchstart", onTouchStart)
    window.removeEventListener("touchmove", onTouchMove)
    window.removeEventListener("touchend", cancel)
    window.removeEventListener("touchcancel", cancel)
  }
}
