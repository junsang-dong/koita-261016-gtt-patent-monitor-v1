export type EventType = "NEW" | "STATUS_CHANGED" | "REG_NO_ASSIGNED";

export type BaselineRow = { appNo: string; status: string | null; regNo: string | null };
export type FetchedRow = { appNo: string; status: string | null; regNo: string | null };

export type DiffEvent = {
  type: EventType;
  appNo: string;
  before: string | null;
  after: string | null;
};

/** 기준(DB)과 이번 수집 결과를 app_no로 비교하는 순수 함수. */
export function diffPatents(baseline: BaselineRow[], fetched: FetchedRow[]): DiffEvent[] {
  const base = new Map(baseline.map((r) => [r.appNo, r]));
  const events: DiffEvent[] = [];
  const seen = new Set<string>();

  for (const row of fetched) {
    if (seen.has(row.appNo)) continue;
    seen.add(row.appNo);
    const prev = base.get(row.appNo);
    if (!prev) {
      events.push({ type: "NEW", appNo: row.appNo, before: null, after: row.status });
      continue;
    }
    if (norm(prev.status) !== norm(row.status) && norm(row.status) !== "") {
      events.push({
        type: "STATUS_CHANGED",
        appNo: row.appNo,
        before: prev.status,
        after: row.status,
      });
    }
    if (!norm(prev.regNo) && norm(row.regNo)) {
      events.push({ type: "REG_NO_ASSIGNED", appNo: row.appNo, before: null, after: row.regNo });
    }
  }
  return events;
}

function norm(v: string | null | undefined): string {
  return (v ?? "").trim();
}
