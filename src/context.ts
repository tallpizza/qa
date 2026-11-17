// 일감에 같이 담는 재현 정보: 선택한 영역, 화면 크기, 최근 콘솔 오류.
// 운영 빌드는 컴포넌트 이름이 줄여져 있을 수 있어 선택자·글자·위치도 함께 적는다.
const errors: string[] = []
let started = false

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const push = (s: string) => {
  errors.push(clip(s.replace(/\s+/g, " "), 300))
  if (errors.length > 8) errors.shift()
}

export function startErrorCapture() {
  if (started) return
  started = true
  const orig = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    push(args.map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : safeJson(a))).join(" "))
    orig(...args)
  }
  window.addEventListener("error", (e) => push(`${e.message} (${e.filename?.split("/").pop() ?? ""}:${e.lineno})`))
  window.addEventListener("unhandledrejection", (e) => push(`처리 안 된 거부: ${e.reason instanceof Error ? e.reason.message : safeJson(e.reason)}`))
}
function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v) ?? String(v)
  } catch {
    return String(v)
  }
}
export const recentErrors = () => [...errors]

export type ElementInfo = {
  label: string // 막대에 보이는 짧은 이름
  selector: string
  component?: string
  text: string
  rect: { x: number; y: number; w: number; h: number }
}

function reactName(el: Element): string | undefined {
  const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"))
  let f = key ? ((el as unknown as Record<string, unknown>)[key] as { type?: unknown; return?: unknown } | null) : null
  for (let i = 0; f && i < 40; i++, f = f.return as typeof f) {
    const t = f.type as { displayName?: string; name?: string; render?: { displayName?: string; name?: string } } | string | undefined
    if (typeof t === "function") {
      const n = (t as { displayName?: string; name?: string }).displayName || (t as { name?: string }).name
      if (n) return n
    } else if (t && typeof t === "object") {
      const n = t.displayName || t.render?.displayName || t.render?.name
      if (n) return n
    }
  }
  return undefined
}

function cssPath(el: Element): string {
  const parts: string[] = []
  let cur: Element | null = el
  while (cur && cur !== document.documentElement && parts.length < 6) {
    let s = cur.tagName.toLowerCase()
    if (cur.id) {
      parts.unshift(`${s}#${CSS.escape(cur.id)}`)
      break
    }
    const tid = cur.getAttribute("data-testid")
    if (tid) {
      parts.unshift(`${s}[data-testid="${tid}"]`)
      break
    }
    const cls = [...cur.classList].filter((c) => c.length < 30).slice(0, 2)
    if (cls.length) s += `.${cls.map((c) => CSS.escape(c)).join(".")}`
    const parent: Element | null = cur.parentElement
    if (parent) {
      const same = [...parent.children].filter((c) => c.tagName === cur!.tagName)
      if (same.length > 1) s += `:nth-of-type(${same.indexOf(cur) + 1})`
    }
    parts.unshift(s)
    cur = parent
  }
  return parts.join(" > ")
}

export function describeElement(el: Element): ElementInfo {
  const r = el.getBoundingClientRect()
  const component = reactName(el)
  const cls = [...el.classList][0]
  const text = clip((el.textContent ?? "").replace(/\s+/g, " ").trim(), 80)
  return {
    label: `${el.tagName.toLowerCase()}${cls ? `.${cls.slice(0, 24)}` : ""}${component ? ` · ${component}` : ""}`,
    selector: cssPath(el),
    component,
    text,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
  }
}

export type ReportInput = { app: string; note: string; imageUrl?: string; expire: string; target?: ElementInfo }

export function buildReport({ app, note, imageUrl, expire, target }: ReportInput): { title: string; description: string } {
  const firstLine = note.split("\n").map((l) => l.trim()).find(Boolean)
  const title = clip(firstLine ?? `화면 확인 요청: ${location.pathname}`, 60)
  const dpr = window.devicePixelRatio || 1
  const agent = [
    imageUrl ? `- 스크린샷: ${imageUrl} (${expire} 뒤 사라진다. 일감을 읽는 즉시 curl 로 받아 Read 로 본다)` : "- 스크린샷: 올리지 못했다",
    `- 주소: ${location.href}`,
    target
      ? `- 선택한 영역: \`${target.selector}\`${target.component ? ` · 컴포넌트 ${target.component}` : ""} · 위치 ${target.rect.x},${target.rect.y} 크기 ${target.rect.w}×${target.rect.h}${target.text ? ` · 글자 "${target.text}"` : ""}`
      : "- 선택한 영역: 전체 화면",
    `- 화면: ${innerWidth}×${innerHeight} @${dpr}x · ${navigator.userAgent}`,
    `- 최근 콘솔 오류: ${errors.length ? "\n" + errors.map((e) => `  - ${e}`).join("\n") : "없음"}`,
  ].join("\n")
  const description = [
    note.trim() || "(메모 없음)",
    imageUrl ? `![화면](${imageUrl})` : "",
    "---",
    `QA 도구 · ${app} · ${location.pathname} · ${new Date().toISOString()}`,
    `+++ 에이전트 참고\n\n${agent}\n\n+++`,
  ]
    .filter(Boolean)
    .join("\n\n")
  return { title, description }
}
