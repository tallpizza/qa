import type { Config } from "./config"
import { post } from "./upload"

export type Created = { identifier?: string; url?: string }

// 팀·프로젝트·시작 상태와 Linear 키는 QA 서버가 프로젝트별로 붙인다
export const createIssue = (cfg: Config, title: string, description: string) =>
  post<Created>(cfg, "issue", { "Content-Type": "application/json" }, JSON.stringify({ title, description }))
