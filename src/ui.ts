import { h } from "./dom"

export const HOST_ID = "qa-host"

// 화면 기준: 휴대폰에서도 맞게, 호버는 호버되는 기기에서만, 닫는 길은 늘 보이게.
// Tailwind 를 쓰지 않는 이유: Tailwind 4 는 @property 로 변수를 등록하는데 Shadow DOM 안에서는 등록되지 않아 그림자·변형이 깨진다.
const STYLE = `
:host { all: initial }
* { box-sizing: border-box; font-family: system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif }
.layer { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none }
.box { position: fixed; pointer-events: none; border-radius: 4px }
.hover { outline: 2px dashed #5b9cff; background: rgba(91,156,255,.12) }
.sel { outline: 2px solid #ff3b30; background: rgba(255,59,48,.12) }
.bar { position: fixed; left: 50%; bottom: calc(16px + env(safe-area-inset-bottom)); transform: translateX(-50%); pointer-events: auto;
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; max-width: calc(100vw - 24px);
  padding: 10px 12px; background: #1c1c1e; color: #fff; border-radius: 14px; box-shadow: 0 8px 30px rgba(0,0,0,.45); font-size: 14px; line-height: 1.3 }
.bar .label { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ababb0 }
button { font: inherit; color: #fff; background: #2c2c2e; border: 0; border-radius: 10px; min-height: 40px; min-width: 40px; padding: 0 14px; cursor: pointer; touch-action: manipulation }
button[aria-pressed="true"] { background: #ff3b30 }
button.primary { background: #0a84ff }
button:disabled { opacity: .45; cursor: default }
@media (hover: hover) { button:hover:not(:disabled) { background: #3a3a3c } button.primary:hover:not(:disabled) { background: #339dff } button[aria-pressed="true"]:hover { background: #ff5a50 } }
.editor { position: fixed; inset: 0; height: 100dvh; z-index: 2147483647; display: flex; flex-direction: column; background: rgba(0,0,0,.97); color: #fff; pointer-events: auto; overscroll-behavior: contain }
.top { display: flex; gap: 6px; align-items: center; padding: calc(8px + env(safe-area-inset-top)) 10px 8px; overflow-x: auto; flex: none }
.top .grow { flex: 1 }
.top button { flex: none; white-space: nowrap }
@media (max-width: 480px) { .top { gap: 4px; padding-left: 8px; padding-right: 8px } .top button { padding: 0 9px; font-size: 13px } }
.stage { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 4px 10px }
.stage canvas { max-width: 100%; max-height: 100%; touch-action: none; cursor: crosshair; background: #000; border-radius: 6px }
.foot { flex: none; display: flex; flex-direction: column; gap: 6px; padding: 8px 10px calc(10px + env(safe-area-inset-bottom)) }
.row { display: flex; gap: 8px; align-items: flex-end }
textarea, input { flex: 1; min-width: 0; font-size: 16px; color: #fff; background: #2c2c2e; border: 1px solid #48484a; border-radius: 10px; padding: 10px 12px; outline: none }
textarea { resize: none; min-height: 44px; max-height: 30vh }
textarea:focus, input:focus { border-color: #0a84ff }
.status { font-size: 13px; color: #ababb0; min-height: 1.2em }
.status.err { color: #ff6b61 }
.panel { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(420px, calc(100vw - 24px)); pointer-events: auto;
  display: flex; flex-direction: column; gap: 10px; padding: 16px; background: #1c1c1e; color: #fff; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,.55); font-size: 14px; line-height: 1.5 }
.panel h2 { margin: 0; font-size: 16px }
.panel p { margin: 0; color: #ababb0 }
.toast { position: fixed; left: 50%; bottom: calc(24px + env(safe-area-inset-bottom)); transform: translateX(-50%); max-width: calc(100vw - 24px); padding: 10px 16px;
  background: #1c1c1e; color: #fff; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,.45); font-size: 14px; pointer-events: none }
.toast.err { background: #5c1d19 }
`

export type Host = { root: ShadowRoot; host: HTMLElement; layer: HTMLElement; unmount: () => void }

// 평소에는 화면에 아무것도 없다. 쓸 때만 맨 위에 붙이고 끝나면 지운다.
export function mountHost(): Host {
  document.getElementById(HOST_ID)?.remove()
  const host = h("div", { id: HOST_ID, "data-capture": "exclude" })
  const root = host.attachShadow({ mode: "open" })
  const layer = h("div", { class: "layer" })
  root.append(h("style", {}, STYLE), layer)
  // 안에서 누른 키가 앱의 단축키로 새지 않게 한다
  for (const t of ["keydown", "keyup", "keypress"]) host.addEventListener(t, (e) => e.stopPropagation())
  document.body.append(host)
  return { root, host, layer, unmount: () => host.remove() }
}

let toastTimer = 0
export function toast(message: string, opts: { error?: boolean; keep?: boolean } = {}) {
  let host = document.getElementById(HOST_ID)
  let layer: HTMLElement
  if (host?.shadowRoot) layer = host.shadowRoot.querySelector<HTMLElement>(".layer")!
  else {
    const m = mountHost()
    host = m.host
    layer = m.layer
  }
  layer.querySelector(".toast")?.remove()
  const el = h("div", { class: `toast${opts.error ? " err" : ""}`, role: "status" }, message)
  layer.append(el)
  clearTimeout(toastTimer)
  if (!opts.keep) {
    toastTimer = window.setTimeout(() => {
      el.remove()
      if (host && !host.shadowRoot?.querySelector(".layer > :not(.toast)")) host.remove()
    }, opts.error ? 5000 : 3000)
  }
}
export function clearToast() {
  const host = document.getElementById(HOST_ID)
  host?.shadowRoot?.querySelector(".toast")?.remove()
  if (host && !host.shadowRoot?.querySelector(".layer > :not(.toast)")) host.remove()
}
