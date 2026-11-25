import type { Config } from "./config"

// 이미지는 QA 서버를 거쳐 Linear 에 공개 이미지로 올린다.
// 브라우저는 Linear 저장소에 직접 올리지 못한다(그 저장소는 linear.app 에서 온 요청만 받는다).
export async function uploadImage(cfg: Config, blob: Blob): Promise<string> {
  const out = await post<{ url?: string }>(cfg, "upload", { "Content-Type": blob.type || "image/png" }, blob)
  if (out.url && /^https?:\/\/\S+$/.test(out.url)) return out.url
  throw new Error("QA 서버가 이미지 주소를 돌려주지 않았습니다. 다시 보내 보세요.")
}

export async function post<T>(cfg: Config, what: "upload" | "issue", headers: Record<string, string>, body: BodyInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${cfg.endpoint}/${what}`, { method: "POST", headers, body })
  } catch {
    throw new Error(`QA 서버(${new URL(cfg.endpoint, location.href).host})에 닿지 못했습니다. 다시 보내 보세요.`)
  }
  const out = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  if (res.ok && out) return out
  throw new Error(out?.error ?? `QA 서버가 받지 않았습니다(상태 ${res.status}). 다시 보내 보세요.`)
}
