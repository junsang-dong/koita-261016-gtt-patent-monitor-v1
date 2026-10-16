import Link from "next/link";
import { dashboardData } from "@/lib/db/queries";
import { FAMILY_SHORT, LAYER_LABEL, STATUS_GROUP_LABEL, type Family, type Layer, type StatusGroup } from "@/lib/domain/taxonomy";
import { BarsChart, DonutChart } from "@/components/Charts";
import ActionButton from "@/components/ActionButton";
import { EventBadge, PageHead } from "@/components/ui";
import { collectAction } from "./actions";

export default async function DashboardPage() {
  const d = await dashboardData();
  const t = d.totals;
  const toData = (rows: { k: string; n: number }[], fn: (k: string) => string) =>
    rows.map((r) => ({ name: fn(r.k), value: r.n })).sort((a, b) => b.value - a.value);

  return (
    <>
      <PageHead crumb="HOME" title="대시보드">
        <a className="btn ghost" href="/api/export/summary">
          요약 보고서(.md)
        </a>
        <ActionButton action={collectAction.bind(null, false)} label="전체 수집 실행" busyLabel="KIPRIS 수집 중…" />
      </PageHead>

      {t.total === 0 && (
        <div className="notice">
          아직 수집된 특허가 없습니다. 설정에서 KIPRIS 연결 테스트를 한 뒤 <b>전체 수집 실행</b>을 눌러 주세요.
        </div>
      )}
      {t.unverified > 0 && t.total > 0 && (
        <div className="notice warn">API로 확인되지 않은 레코드가 {t.unverified}건 있습니다. 목록에서 회색 배지로 구분되며 KIPRIS 수집 후 대체됩니다.</div>
      )}

      <div className="kpis">
        <div className="kpi">
          <div className="l">총 건수</div>
          <div className="v">{t.total}</div>
        </div>
        <div className="kpi">
          <div className="l">유효 권리</div>
          <div className="v">{t.valid}</div>
        </div>
        <div className="kpi sky">
          <div className="l">잠재 권리</div>
          <div className="v">{t.pending}</div>
        </div>
        <div className="kpi red">
          <div className="l">위험도 상</div>
          <div className="v">{t.high}</div>
        </div>
      </div>

      <div className="grid3">
        <div className="card">
          <div className="card-head">
            <span>상태 분포</span>
          </div>
          <div className="card-body">
            <DonutChart data={toData(d.byStatus, (k) => STATUS_GROUP_LABEL[k as StatusGroup] ?? k)} />
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <span>기술 계열 분포</span>
          </div>
          <div className="card-body">
            <DonutChart data={toData(d.byFamily, (k) => FAMILY_SHORT[k as Family] ?? "미분류")} />
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <span>보호 층위 분포</span>
          </div>
          <div className="card-body">
            <BarsChart data={toData(d.byLayer, (k) => (LAYER_LABEL[k as Layer] ?? k).split(" ")[0])} color="#0EA5E9" />
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-head">
            <span>연도별 출원 추이</span>
          </div>
          <div className="card-body">
            <BarsChart data={d.byYear.map((r) => ({ name: r.k, value: r.n }))} />
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <span>최근 모니터링 이벤트</span>
            <Link href="/monitor" style={{ fontSize: 12 }}>
              전체 보기
            </Link>
          </div>
          <table className="tbl">
            <tbody>
              {d.events.length === 0 && (
                <tr>
                  <td className="muted">이벤트가 없습니다.</td>
                </tr>
              )}
              {d.events.map((e) => (
                <tr key={e.id}>
                  <td style={{ width: 96 }}>
                    <EventBadge type={e.type} />
                  </td>
                  <td>
                    <Link href={`/patents/${e.appNo}`}>{e.title}</Link>
                    <div className="muted mono">{e.appNo}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
