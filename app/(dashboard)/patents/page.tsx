import Link from "next/link";
import { filterYears, listPatents, type PatentFilter } from "@/lib/db/queries";
import {
  FAMILIES,
  FAMILY_LABEL,
  LAYERS,
  LAYER_LABEL,
  RISKS,
  RISK_LABEL,
  STATUS_GROUPS,
  STATUS_GROUP_LABEL,
  VERIFIED,
  VERIFIED_LABEL,
} from "@/lib/domain/taxonomy";
import { FamilyLayer, PageHead, RiskBadge, StatusBadge, VerifiedBadge } from "@/components/ui";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function PatentsPage({ searchParams }: PageProps<"/patents">) {
  const sp = await searchParams;
  const f: PatentFilter = {
    statusGroup: one(sp.statusGroup),
    family: one(sp.family),
    layer: one(sp.layer),
    risk: one(sp.risk),
    verified: one(sp.verified),
    year: one(sp.year),
    q: one(sp.q),
    sort: one(sp.sort) ?? "appDate",
    dir: one(sp.dir) === "asc" ? "asc" : "desc",
  };
  const [rows, years] = await Promise.all([listPatents(f), filterYears()]);

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...over })) if (v) p.set(k, String(v));
    return p.toString();
  };
  const sortLink = (key: string, text: string) => (
    <Link href={`/patents?${qs({ sort: key, dir: f.sort === key && f.dir === "desc" ? "asc" : "desc" })}`}>
      {text}
      {f.sort === key ? (f.dir === "asc" ? " ▲" : " ▼") : ""}
    </Link>
  );

  const select = (name: string, label: string, opts: readonly string[], labels: Record<string, string>, val?: string) => (
    <select name={name} className="field" defaultValue={val ?? ""} aria-label={label}>
      <option value="">{label}: 전체</option>
      {opts.map((o) => (
        <option key={o} value={o}>
          {labels[o] ?? o}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <PageHead crumb="HOME › 특허 목록" title="특허 목록">
        <a className="btn ghost" href={`/api/export/patents.csv?${qs({})}`}>
          CSV 다운로드
        </a>
      </PageHead>

      <form className="filters" method="GET">
        {select("statusGroup", "상태군", STATUS_GROUPS, STATUS_GROUP_LABEL, f.statusGroup)}
        {select("family", "계열", FAMILIES, FAMILY_LABEL, f.family)}
        {select("layer", "층위", LAYERS, LAYER_LABEL, f.layer)}
        {select("risk", "위험도", RISKS, RISK_LABEL, f.risk)}
        {select("verified", "검증", VERIFIED, VERIFIED_LABEL, f.verified)}
        <select name="year" className="field" defaultValue={f.year ?? ""} aria-label="출원연도">
          <option value="">출원연도: 전체</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <input name="q" className="field" placeholder="명칭 검색" defaultValue={f.q ?? ""} style={{ width: 200 }} />
        <button className="btn" type="submit">
          조회
        </button>
        <Link className="btn ghost" href="/patents">
          초기화
        </Link>
        <span className="muted" style={{ marginLeft: "auto" }}>
          {rows.length}건
        </span>
      </form>

      <table className="tbl">
        <thead>
          <tr>
            <th>{sortLink("appDate", "출원일")}</th>
            <th>출원번호</th>
            <th>{sortLink("title", "명칭")}</th>
            <th>{sortLink("status", "상태")}</th>
            <th>{sortLink("family", "계열·층위")}</th>
            <th>{sortLink("risk", "위험도")}</th>
            <th>검증</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 28 }}>
                조건에 맞는 특허가 없습니다.
              </td>
            </tr>
          )}
          {rows.map((p) => (
            <tr key={p.appNo}>
              <td className="mono" style={{ whiteSpace: "nowrap" }}>
                {p.appDate ?? "-"}
              </td>
              <td className="mono">{p.appNo}</td>
              <td>
                <Link href={`/patents/${encodeURIComponent(p.appNo)}`}>{p.title}</Link>
                {p.regNo && <div className="muted mono">{p.regNo}</div>}
              </td>
              <td>
                <StatusBadge group={p.statusGroup} raw={p.status} />
              </td>
              <td>
                <FamilyLayer family={p.family} layer={p.layer} />
              </td>
              <td>
                <RiskBadge risk={p.risk} provisional={p.riskProvisional} />
              </td>
              <td>
                <VerifiedBadge v={p.verified} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
