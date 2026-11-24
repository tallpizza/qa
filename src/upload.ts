import type { Config } from "./config"

// 이미지는 이미지 올리는 서버(server/upload.mjs)를 거쳐 Linear 에 공개 이미지로 올린다.
// 브라우저는 Linear 저장소에 직접 올리지 못한다(그 저장소는 linear.app 에서 온 요청만 받는다). 키는 요청마다 넘기고 서버는 저장하지 않는다.
export async function uploadImage(cfg: Config, auth: string, blob: Blob): Promise<string> {
  let res: Response
  try {
    res = await fetch(cfg.uploadUrl, { method: "POST", headers: { Authorization: auth, "Content-Type": blob.type || "image/png" }, body: blob })
  } catch {
    throw new Error(`이미지 올리는 서버(${new URL(cfg.uploadUrl, location.href).host})에 닿지 못했습니다. 다시 보내 보세요.`)
  }
  const out = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
  if (res.ok && out?.url && /^https?:\/\/\S+$/.test(out.url)) return out.url
  throw new Error(out?.error ?? `이미지 올리는 서버가 이미지를 받지 않았습니다(상태 ${res.status}). 다시 보내 보세요.`)
}
