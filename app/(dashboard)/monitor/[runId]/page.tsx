import Link from "next/link";
import { notFound } from "next/navigation";
import { getRun } from "@/lib/db/queries";
import { PageHead } from "@/components/ui";

export default async function RunReportPage({ params }: PageProps<"/monitor/[runId]">) {
  const id = Number((await params).runId);
  const data = Number.isInteger(id) ? await getRun(id) : null;
  if (!data) notFound();
  const { run } = data;

  return (
    <>
      <PageHead crumb={`HOME › 모니터링 › 회차 #${run.id}`} title={`회차 #${run.id} 보고서`}>
        <Link className="btn ghost" href="/monitor">
          목록
        </Link>
        {run.reportMd && (
          <a className="btn" href={`/api/export/report/${run.id}`}>
            .md 다운로드
          </a>
        )}
      </PageHead>
      {run.error && <div className="notice err">{run.error}</div>}
      {run.reportMd ? <pre className="md">{run.reportMd}</pre> : <div className="notice">아직 생성된 보고서가 없습니다.</div>}
    </>
  );
}
