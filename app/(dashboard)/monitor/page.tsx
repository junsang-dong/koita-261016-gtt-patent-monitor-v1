import Link from "next/link";
import { listRuns, unacknowledgedEvents } from "@/lib/db/queries";
import ActionButton from "@/components/ActionButton";
import { EventBadge, PageHead, fmtDate } from "@/components/ui";
import { ackAction, demoDeleteOneAction, monitorAction } from "../actions";

const STATE_CLS: Record<string, string> = { DONE: "b-green", RUNNING: "b-blue", PARTIAL: "b-amber", FAILED: "b-red" };

export default async function MonitorPage() {
  const [runs, events] = await Promise.all([listRuns(), unacknowledgedEvents()]);
  const hasPartial = runs.some((r) => r.state === "PARTIAL");

  return (
    <>
      <PageHead crumb="HOME › 모니터링" title="모니터링">
        <ActionButton action={demoDeleteOneAction} label="시연: 기준에서 1건 삭제" variant="ghost" confirmText="가장 최근 수집된 1건을 DB에서 삭제합니다. 다음 모니터링에서 신규로 다시 감지됩니다. 진행할까요?" />
        <ActionButton action={monitorAction} label={hasPartial ? "이어서 실행" : "지금 실행"} busyLabel="모니터링 중…" />
      </PageHead>

      <div className="notice">
        매주 월요일 07:00(KST) 자동 점검됩니다 (Vercel Cron은 실행 시각이 ±59분 흔들릴 수 있어 보고서에는 실제 실행 시각을 기록합니다).
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head">
          <span>미확인 이벤트 ({events.length})</span>
          {events.length > 0 && <ActionButton action={ackAction.bind(null, events.map((e) => e.id))} label="모두 확인 처리" variant="ghost" size="sm" />}
        </div>
        <table className="tbl">
          <tbody>
            {events.length === 0 && (
              <tr>
                <td className="muted">확인할 이벤트가 없습니다.</td>
              </tr>
            )}
            {events.map((e) => (
              <tr key={e.id}>
                <td style={{ width: 110 }}>
                  <EventBadge type={e.type} />
                </td>
                <td>
                  <Link href={`/patents/${encodeURIComponent(e.appNo)}`}>{e.title}</Link>
                  <div className="muted mono">{e.appNo}</div>
                </td>
                <td className="muted">
                  {e.before ?? "-"} → {e.after ?? "-"}
                </td>
                <td style={{ width: 90 }}>
                  <Link href={`/monitor/${e.runId}`}>회차 #{e.runId}</Link>
                </td>
                <td style={{ width: 90 }}>
                  <ActionButton action={ackAction.bind(null, [e.id])} label="확인" variant="ghost" size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-head">
          <span>실행 이력</span>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>회차</th>
              <th>트리거</th>
              <th>시작</th>
              <th>상태</th>
              <th>수집/신규/변경/상</th>
              <th>KIPRIS 호출</th>
              <th>오류</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr>
                <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 24 }}>
                  실행 이력이 없습니다.
                </td>
              </tr>
            )}
            {runs.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/monitor/${r.id}`}>#{r.id}</Link>
                </td>
                <td>{r.trigger === "CRON" ? "자동" : "수동"}</td>
                <td>{fmtDate(r.startedAt)}</td>
                <td>
                  <span className={`badge ${STATE_CLS[r.state] ?? "b-gray"}`}>{r.state}</span>
                </td>
                <td className="mono">
                  {r.stats ? `${r.stats.fetched} / ${r.stats.added} / ${r.stats.changed} / ${r.stats.high}` : "-"}
                </td>
                <td>{r.apiCalls}</td>
                <td style={{ color: "var(--red)", maxWidth: 360 }}>{r.error ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
