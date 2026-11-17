import { h } from "./dom"
import { clearKey, getKey, setKey } from "./store"
import { mountHost } from "./ui"

// 키를 이 브라우저에 한 번 넣는 화면. 주소 끝에 ?qa=setup 을 붙여 연다(키가 없으면 도구는 아무 반응도 하지 않는다).
export function openSetup(): Promise<"saved" | "cleared" | "closed"> {
  const { layer, unmount } = mountHost()
  return new Promise((resolve) => {
    const has = !!getKey()
    const input = h("input", { type: "password", autocomplete: "off", spellcheck: "false", placeholder: "lin_api_…", "aria-label": "Linear 키" })
    const status = h("div", { class: "status err", role: "status" })
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish("closed")
    window.addEventListener("keydown", onKey, true)
    const finish = (v: "saved" | "cleared" | "closed") => {
      window.removeEventListener("keydown", onKey, true)
      unmount()
      resolve(v)
    }
    const save = () => {
      const v = input.value.trim()
      if (!/^lin_(api|oauth)_\S{10,}$/.test(v)) return void (status.textContent = "Linear 키 모양이 아닙니다. lin_api_ 로 시작하는 키를 붙여 넣어 주세요.")
      if (!setKey(v)) return void (status.textContent = "이 브라우저는 저장소를 막아 두었습니다.")
      finish("saved")
    }
    input.addEventListener("keydown", (e) => e.key === "Enter" && save())
    layer.append(
      h(
        "div",
        { class: "panel", role: "dialog", "aria-label": "QA 도구 키 설정" },
        h("h2", {}, "QA 도구 설정"),
        h("p", {}, "Linear 키(일감 만들기 권한)를 이 브라우저에만 저장합니다. 앱 코드나 서버에는 남지 않고, 주소(출처)마다 한 번씩 넣습니다."),
        h("p", {}, has ? "저장된 키가 있습니다. 바꾸려면 새 키를 넣으세요." : "아직 키가 없습니다."),
        input,
        status,
        h(
          "div",
          { class: "row" },
          h("button", { type: "button", class: "primary", onclick: save }, "저장"),
          has && h("button", { type: "button", onclick: () => (clearKey(), finish("cleared")) }, "키 지우기"),
          h("button", { type: "button", onclick: () => finish("closed") }, "닫기"),
        ),
      ),
    )
    input.focus()
  })
}
