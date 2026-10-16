import { listPatents } from "@/lib/db/queries";
import { FAMILY_LABEL, LAYER_LABEL, RISK_LABEL, STATUS_GROUP_LABEL, VERIFIED_LABEL, DISCLAIMER } from "@/lib/domain/taxonomy";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const rows = await listPatents(
    {
      statusGroup: sp.get("statusGroup") || undefined,
      family: sp.get("family") || undefined,
      layer: sp.get("layer") || undefined,
      risk: sp.get("risk") || undefined,
      verified: sp.get("verified") || undefined,
      year: sp.get("year") || undefined,
      q: sp.get("q") || undefined,
      sort: sp.get("sort") || undefined,
      dir: sp.get("dir") === "asc" ? "asc" : "desc",
    },
    5000,
  );
  const header = ["출원번호", "출원일", "명칭", "출원인", "상태(원문)", "상태군", "등록번호", "계열", "층위", "위험도", "잠정", "검증", "IPC"];
  const lines = rows.map((p) =>
    [
      p.appNo,
      p.appDate,
      p.title,
      p.applicant,
      p.status,
      p.statusGroup ? STATUS_GROUP_LABEL[p.statusGroup] : "",
      p.regNo,
      p.family ? FAMILY_LABEL[p.family] : "",
      p.layer ? LAYER_LABEL[p.layer] : "",
      p.risk ? RISK_LABEL[p.risk] : "",
      p.riskProvisional ? "잠정" : "",
      p.verified ? VERIFIED_LABEL[p.verified] : "",
      (p.ipc ?? []).join("; "),
    ]
      .map(esc)
      .join(","),
  );
  // UTF-8 BOM: 엑셀 한글 깨짐 방지
  const body = "﻿" + [header.join(","), ...lines, "", esc(DISCLAIMER)].join("\r\n");
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="gtt_kr_patents_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
