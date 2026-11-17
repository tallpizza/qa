// 키는 이 브라우저(이 주소)의 localStorage 에만 둔다. 앱 코드·서버에는 없다.
const KEY = "qa:key"

export function getKey(): string {
  try {
    return localStorage.getItem(KEY) ?? ""
  } catch {
    return ""
  }
}
export function setKey(v: string): boolean {
  try {
    localStorage.setItem(KEY, v)
    return true
  } catch {
    return false
  }
}
export function clearKey() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 저장소를 못 쓰는 환경 */
  }
}
