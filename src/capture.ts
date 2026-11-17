import { snapdom } from "@zumer/snapdom"
import { HOST_ID } from "./ui"

const MAX_PIXELS = 16e6

function pageBackground(): string {
  for (const el of [document.body, document.documentElement]) {
    const c = getComputedStyle(el).backgroundColor
    if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") return c
  }
  return "#ffffff"
}

// target 이 없으면 지금 보이는 화면(viewport)만 찍는다. 있으면 그 요소만 찍는다.
// 안쪽 스크롤 위치·Tailwind 4 색·SVG 그래프가 실제 화면과 같게 나오는 것을 graph-note 에서 확인했다(modern-screenshot 은 안쪽 스크롤을 무시해 쓰지 않는다).
export async function capture(target: Element | null): Promise<HTMLCanvasElement> {
  const w = target ? target.getBoundingClientRect().width : innerWidth
  const h = target ? target.getBoundingClientRect().height : innerHeight
  // snapdom 은 scale 을 화면 배율(DPR)에 곱한다. 결과 배율이 최대 2배가 되도록 DPR 기준으로 맞춘다.
  const dpr = window.devicePixelRatio || 1
  let scale = Math.min(dpr, 2) / dpr
  const pixels = w * h * (dpr * scale) ** 2
  if (pixels > MAX_PIXELS) scale *= Math.sqrt(MAX_PIXELS / pixels)
  const result = await snapdom(target ?? document.documentElement, {
    scale,
    backgroundColor: pageBackground(),
    exclude: [`#${HOST_ID}`],
    excludeMode: "remove",
    ...(target ? {} : { clip: "viewport" as const }),
  })
  return result.toCanvas()
}
