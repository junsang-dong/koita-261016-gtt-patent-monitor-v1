import {
  FAMILY_SHORT,
  RISK_LABEL,
  STATUS_GROUP_LABEL,
  VERIFIED_LABEL,
  type Family,
  type Layer,
  type Risk,
  type StatusGroup,
  type Verified,
} from "@/lib/domain/taxonomy";

export function RiskBadge({ risk, provisional }: { risk: Risk | null; provisional?: boolean | null }) {
  if (!risk) return <span className="badge b-gray">-</span>;
  const cls = risk === "HIGH" ? "b-red" : risk === "MID" ? "b-amber" : "b-green";
  const dot = risk === "HIGH" ? "🔴" : risk === "MID" ? "🟡" : "🟢";
  return (
    <span className={`badge ${cls} ${provisional ? "b-prov" : ""}`} title={provisional ? "청구항 미분해로 인한 잠정 등급" : undefined}>
      {dot} {RISK_LABEL[risk]}
      {provisional ? " (잠정)" : ""}
    </span>
  );
}

export function StatusBadge({ group, raw }: { group: StatusGroup | null; raw?: string | null }) {
  const cls = group === "valid" ? "b-blue" : group === "pending" ? "b-amber" : "b-gray";
  return (
    <span className={`badge ${cls}`} title={raw ?? undefined}>
      {group ? STATUS_GROUP_LABEL[group] : "-"}
    </span>
  );
}

export function VerifiedBadge({ v }: { v: Verified | null }) {
  const x = v ?? "UNVERIFIED";
  return <span className={`badge ${x === "API" ? "b-green" : "b-gray"}`}>{VERIFIED_LABEL[x]}</span>;
}

export function FamilyLayer({ family, layer }: { family: Family | null; layer: Layer | null }) {
  const f = family ?? "UNCLASSIFIED";
  const l = layer ?? "UNCLASSIFIED";
  return (
    <span className="flex flex-wrap gap-1">
      <span className={`badge ${f === "UNCLASSIFIED" ? "b-gray" : "b-blue"}`}>{FAMILY_SHORT[f]}</span>
      <span className={`badge ${l === "UNCLASSIFIED" ? "b-gray" : "b-blue"}`}>{l === "UNCLASSIFIED" ? "분류 필요" : l}</span>
    </span>
  );
}

export const EVENT_LABEL: Record<string, string> = {
  NEW: "신규",
  STATUS_CHANGED: "상태 변경",
  REG_NO_ASSIGNED: "등록번호 부여",
};

export function EventBadge({ type }: { type: string }) {
  const cls = type === "NEW" ? "b-green" : type === "STATUS_CHANGED" ? "b-amber" : "b-blue";
  return <span className={`badge ${cls}`}>{EVENT_LABEL[type] ?? type}</span>;
}

export function PageHead({ crumb, title, children }: { crumb: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <div className="crumb">{crumb}</div>
        <h1>{title}</h1>
      </div>
      <div className="flex gap-2 items-center flex-wrap justify-end">{children}</div>
    </div>
  );
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
