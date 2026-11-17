import type { Config } from "./config"

// Litterbox: 가입 없이 올리고 주소를 받는다. 지정한 시간(기본 72시간) 뒤 지워진다.
// 사전 요청(preflight)을 받지 않으므로 사용자 헤더 없이 FormData 만 보낸다.
export async function uploadImage(cfg: Config, blob: Blob): Promise<string> {
  const form = new FormData()
  form.append("reqtype", "fileupload")
  form.append("time", cfg.expire)
  form.append("fileToUpload", blob, "qa.png")
  let res: Response
  try {
    res = await fetch(cfg.uploadUrl, { method: "POST", body: form })
  } catch {
    throw new Error("이미지 올리는 곳에 닿지 못했습니다.")
  }
  const text = (await res.text()).trim()
  if (!res.ok || !/^https?:\/\/\S+$/.test(text)) throw new Error(`이미지를 올리지 못했습니다. ${text.slice(0, 80)}`)
  return text
}
