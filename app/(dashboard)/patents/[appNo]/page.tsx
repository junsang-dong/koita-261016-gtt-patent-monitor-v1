import Link from "next/link";
import { notFound } from "next/navigation";
import { getPatent } from "@/lib/db/queries";
import { FAMILIES, FAMILY_LABEL, LAYERS, LAYER_LABEL } from "@/lib/domain/taxonomy";
import ActionButton from "@/components/ActionButton";
import { FamilyLayer, PageHead, RiskBadge, StatusBadge, VerifiedBadge, fmtDate } from "@/components/ui";
import { analyzeAction, manualClaimAction, manualClassifyAction } from "../../actions";

export default async function PatentDetailPage({ params }: PageProps<"/patents/[appNo]">) {
  const appNo = decodeURIComponent((await params).appNo);
  const data = await getPatent(appNo);
  if (!data) notFound();
  const { patent: p, classifications, claimCharts, history } = data;
  const cls = classifications[0];
  const chart = claimCharts[0];

  return (
    <>
      <PageHead crumb="HOME › 특허 목록 › 상세" title={p.title}>
        <Link className="btn ghost" href="/patents">
          목록
        </Link>
        {chart && (
          <a className="btn ghost" href={`/api/export/claim-chart/${encodeURIComponent(appNo)}`}>
            청구항 분해(.md)
          </a>
        )}
        <ActionButton action={analyzeAction.bind(null, appNo, undefined)} label="청구항 분해 실행" busyLabel="분석 중…" />
      </PageHead>

      {p.verified !== "API" && (
        <div className="notice warn">이 레코드는 KIPRIS API로 확인되지 않았습니다({p.verified === "WEB" ? "웹 확인" : "미검증"}). 위험도는 잠정입니다.</div>
      )}

      <div className="grid2">
        <div className="card">
          <div className="card-head">
            <span>서지 정보</span>
          </div>
          <div className="kv">
            <div>출원번호</div>
            <div className="mono">{p.appNo}</div>
            <div>출원일</div>
            <div>{p.appDate ?? "-"}</div>
            <div>출원인</div>
            <div>{p.applicant ?? "-"}</div>
            <div>공개번호/일</div>
            <div>
              {p.pubNo ?? "-"} {p.pubDate ? `(${p.pubDate})` : ""}
            </div>
            <div>등록번호/일</div>
            <div>
              {p.regNo ?? "-"} {p.regDate ? `(${p.regDate})` : ""}
            </div>
            <div>법적상태</div>
            <div>
              <StatusBadge group={p.statusGroup} raw={p.status} /> <span className="muted">{p.status ?? ""}</span>
            </div>
            <div>IPC</div>
            <div className="mono">{(p.ipc ?? []).join(", ") || "-"}</div>
            <div>위험도</div>
            <div>
              <RiskBadge risk={p.risk} provisional={p.riskProvisional} />
            </div>
            <div>검증</div>
            <div>
              <VerifiedBadge v={p.verified} /> <span className="muted">마지막 확인 {fmtDate(p.lastChecked)}</span>
            </div>
            <div>요약</div>
            <div>{p.abstract ?? "-"}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span>분류 결과와 근거</span>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: 10 }}>
              <FamilyLayer family={p.family} layer={p.layer} />
              {cls && (
                <span className="muted" style={{ marginLeft: 8 }}>
                  {cls.source === "MANUAL" ? "수동 분류" : `AI · 신뢰도 ${cls.confidence}`}
                </span>
              )}
            </div>
            {(p.layer === "UNCLASSIFIED" || p.family === "UNCLASSIFIED") && (
              <div className="notice warn">분류 필요 — 아래에서 수동으로 지정해 주세요.</div>
            )}
            {cls?.evidence && (
              <div style={{ marginBottom: 12 }}>
                <div>
                  <b>계열 근거:</b> {cls.evidence.family.join(", ") || "-"}
                </div>
                <div>
                  <b>층위 근거:</b> {cls.evidence.layer.join(", ") || "-"}
                </div>
              </div>
            )}
            <form action={manualClassifyAction.bind(null, appNo)} className="flex flex-wrap gap-2 items-center">
              <select name="family" className="field" defaultValue={p.family ?? "UNCLASSIFIED"}>
                {FAMILIES.map((f) => (
                  <option key={f} value={f}>
                    {FAMILY_LABEL[f]}
                  </option>
                ))}
              </select>
              <select name="layer" className="field" defaultValue={p.layer ?? "UNCLASSIFIED"}>
                {LAYERS.map((l) => (
                  <option key={l} value={l}>
                    {LAYER_LABEL[l]}
                  </option>
                ))}
              </select>
              <input name="note" className="field" placeholder="근거 메모(선택)" style={{ width: 160 }} />
              <button className="btn ghost" type="submit">
                수동 분류 저장
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head">
          <span>청구항 분해 {chart ? `— 독립항 ${chart.claimNo}항 · 구성요소 ${chart.elementCount}개` : ""}</span>
          {chart && <span className="muted">{chart.claimSource === "API" ? "KIPRIS API" : "직접 입력"}</span>}
        </div>
        {chart ? (
          <>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 56 }}>요소</th>
                  <th>요지</th>
                  <th>의미</th>
                  <th>검토 지점</th>
                </tr>
              </thead>
              <tbody>
                {chart.elements.map((e) => (
                  <tr key={e.label} style={e.label === chart.keyLimiting ? { background: "#fff8e6" } : undefined}>
                    <td>
                      <b>{e.label}</b>
                      {e.label === chart.keyLimiting && <div className="badge b-amber" style={{ marginTop: 4 }}>핵심 한정</div>}
                    </td>
                    <td>{e.gist}</td>
                    <td>{e.meaning}</td>
                    <td>{e.avoid_points.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="card-body">
              <b>검토 아이디어 (변리사 검토 전 초안)</b>
              <p style={{ marginTop: 6 }}>{chart.reviewIdeas}</p>
            </div>
          </>
        ) : (
          <div className="card-body muted">아직 분해되지 않았습니다. 위 버튼을 누르거나 아래에 독립항을 붙여넣어 주세요.</div>
        )}
        <div className="card-body" style={{ borderTop: "1px solid var(--line-soft)" }}>
          <form action={manualClaimAction.bind(null, appNo)} className="flex flex-col gap-2">
            <label htmlFor="claimText" style={{ fontWeight: 700 }}>
              독립항 직접 입력 (서지상세에 청구항이 없을 때)
            </label>
            <textarea id="claimText" name="claimText" className="field" rows={4} placeholder="청구항 1: …" />
            <div>
              <button className="btn ghost" type="submit">
                입력한 청구항으로 분해
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span>상태 이력</span>
        </div>
        <div className="card-body">
          {history.length === 0 ? (
            <span className="muted">기록된 변경 이력이 없습니다.</span>
          ) : (
            <div className="timeline">
              {history.map((h) => (
                <div key={h.id}>
                  <div className="muted">{fmtDate(h.detectedAt)}</div>
                  <div>
                    <b>{h.field === "status" ? "상태" : "등록번호"}</b>: {h.before ?? "-"} → {h.after ?? "-"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
