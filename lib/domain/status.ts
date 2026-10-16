import type { StatusGroup } from "./taxonomy";

const INACTIVE = ["소멸", "거절", "취하", "포기", "무효", "취소"];
const PENDING = ["공개", "심사중", "심사 중", "출원", "공고"];

export type StatusMapping = { group: StatusGroup; warn: boolean };

/** KIPRIS 법적상태 원문 → 유효/잠재/비유효. 매핑 불가는 pending + warn. */
export function mapStatus(raw: string | null | undefined): StatusMapping {
  const s = (raw ?? "").trim();
  if (!s) return { group: "pending", warn: true };
  if (INACTIVE.some((k) => s.includes(k))) return { group: "inactive", warn: false };
  if (s.includes("등록")) return { group: "valid", warn: false };
  if (PENDING.some((k) => s.includes(k))) return { group: "pending", warn: false };
  return { group: "pending", warn: true };
}
