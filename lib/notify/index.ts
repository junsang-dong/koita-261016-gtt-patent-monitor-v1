/** 알림(선택): 신규·변경이 1건 이상이거나 실패했을 때만 Slack Webhook으로 요약을 보낸다. */
export async function notifyRun(summary: {
  runId: number;
  state: string;
  stats: { fetched: number; added: number; changed: number; high: number };
  error?: string | null;
  baseUrl?: string;
}) {
  const hook = process.env.NOTIFY_SLACK_WEBHOOK;
  if (!hook) return;
  const failed = summary.state === "FAILED";
  if (!failed && summary.stats.added + summary.stats.changed === 0) return;

  const link = summary.baseUrl ? `${summary.baseUrl}/monitor/${summary.runId}` : "";
  const text = failed
    ? `⚠️ GTT 특허 모니터링 #${summary.runId} 실패: ${summary.error ?? "원인 미상"}`
    : `GTT 특허 모니터링 #${summary.runId} (${summary.state}) — 신규 ${summary.stats.added} · 변경 ${summary.stats.changed} · 위험도 상 ${summary.stats.high}${link ? `\n${link}` : ""}`;
  try {
    await fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
  } catch {
    // 알림 실패가 회차 결과를 바꾸지 않는다
  }
}
