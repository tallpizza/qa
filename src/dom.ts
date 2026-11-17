type Kid = Node | string | null | undefined | false

// 작은 DOM 만들기 도우미. onXxx 는 이벤트, class 는 className, 나머지는 속성이다.
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v as EventListener)
    else if (k === "class") el.className = String(v)
    else el.setAttribute(k, v === true ? "" : String(v))
  }
  for (const kid of kids) if (kid) el.append(kid)
  return el
}
