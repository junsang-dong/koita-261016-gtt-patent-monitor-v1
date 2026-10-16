import {
  DISCLAIMER,
  FAMILY_LABEL,
  LAYER_LABEL,
  STATUS_GROUP_LABEL,
  VERIFIED_LABEL,
  findForbiddenTerms,
  type Family,
  type Layer,
  type Risk,
  type StatusGroup,
  type Verified,
} from "@/lib/domain/taxonomy";

const head = (title: string) => `# ${title}\n\n> ${DISCLAIMER}\n\n`;
const cell = (v: unknown) => String(v ?? "-").replace(/\|/g, "\\|").replace(/\n/g, " ");

export type ReportPatent = {
  appNo: string;
  title: string;
  appDate: string | null;
  regNo: string | null;
  status: string | null;
  statusGroup: StatusGroup | null;
  family: Family | null;
  layer: Layer | null;
  risk: Risk | null;
  riskProvisional: boolean | null;
  verified: Verified | null;
};

export function summaryReport(patents: ReportPatent[], today: string): string {
  const count = <K extends keyof ReportPatent>(k: K) => {
    const m = new Map<string, number>();
    for (const p of patents) m.set(String(p[k] ?? "NONE"), (m.get(String(p[k] ?? "NONE")) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const table = (rows: [string, number][], label: (k: string) => string) =>
    `| 구분 | 건수 |\n|---|---|\n${rows.map(([k, n]) => `| ${label(k)} | ${n} |`).join("\n")}\n`;

  const nonApi = patents.filter((p) => p.verified !== "API").length;
  const high = patents.filter((p) => p.risk === "HIGH" && p.statusGroup !== "inactive");
  const years = new Map<string, number>();
  for (const p of patents) if (p.appDate) years.set(p.appDate.slice(0, 4), (years.get(p.appDate.slice(0, 4)) ?? 0) + 1);
  const recent = [...years.entries()].sort().slice(-3).map(([y, n]) => `${y}년 ${n}건`).join(" · ");

  const md =
    head(`GTT 한국 특허 수집 요약 (${today})`) +
    `- 총 건수: **${patents.length}건** (API 미확인 ${nonApi}건 — 별도 표기)\n- 최근 3년 출원 추이: ${recent || "자료 없음"}\n\n` +
    `## 상태별\n${table(count("statusGroup"), (k) => STATUS_GROUP_LABEL[k as StatusGroup] ?? k)}\n` +
    `## 계열별\n${table(count("family"), (k) => FAMILY_LABEL[k as Family] ?? k)}\n` +
    `## 층위별\n${table(count("layer"), (k) => LAYER_LABEL[k as Layer] ?? k)}\n` +
    `## 위험도 '상' 목록 (${high.length}건)\n\n` +
    (high.length
      ? `| 출원번호 | 명칭 | 상태 | 계열 | 층위 | 비고 |\n|---|---|---|---|---|---|\n${high
          .map(
            (p) =>
              `| ${p.appNo} | ${cell(p.title)} | ${cell(p.status)} | ${p.family ?? "-"} | ${p.layer ?? "-"} | ${p.riskProvisional ? "잠정" : "확정"}${p.verified !== "API" ? ` · ${VERIFIED_LABEL[p.verified ?? "UNVERIFIED"]}` : ""} |`,
          )
          .join("\n")}\n`
      : "해당 없음\n");
  return guard(md);
}

export type ChartForReport = {
  appNo: string;
  title: string;
  claimNo: number;
  otherIndependent: number[] | null;
  elements: { label: string; gist: string; meaning: string; avoid_points: string[] }[];
  keyLimiting: string | null;
  reviewIdeas: string | null;
  claimSource: "API" | "MANUAL_INPUT";
};

export function claimChartReport(c: ChartForReport): string {
  const md =
    head(`청구항 분해 — ${c.appNo}`) +
    `- 명칭: ${c.title}\n- 분해 대상: 독립항 ${c.claimNo}항${c.otherIndependent?.length ? ` (그 외 독립항: ${c.otherIndependent.join(", ")}항)` : ""}\n- 청구항 출처: ${c.claimSource === "API" ? "KIPRIS API" : "연구원 직접 입력"}\n- 구성요소 수: ${c.elements.length}\n- 핵심 한정 요소: **${c.keyLimiting ?? "-"}**\n\n` +
    `| 요소 | 요지 | 의미 | 검토 지점 |\n|---|---|---|---|\n${c.elements
      .map((e) => `| ${e.label} | ${cell(e.gist)} | ${cell(e.meaning)} | ${cell(e.avoid_points.join(", "))} |`)
      .join("\n")}\n\n` +
    `## 검토 아이디어 (변리사 검토 전 초안)\n\n${c.reviewIdeas ?? "-"}\n`;
  return guard(md);
}

export type MonitorReportInput = {
  runId: number;
  trigger: string;
  startedAt: Date;
  previousCheckedAt: Date | null;
  scope: string;
  stats: { fetched: number; added: number; changed: number; high: number };
  state: string;
  events: { type: string; appNo: string; title: string; before: string | null; after: string | null }[];
};

const EVENT_LABEL: Record<string, string> = {
  NEW: "신규",
  STATUS_CHANGED: "상태 변경",
  REG_NO_ASSIGNED: "등록번호 부여",
};

export function monitorReport(r: MonitorReportInput): string {
  const kst = (d: Date | null) =>
    d ? d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false }) : "없음 (최초 점검)";
  let md =
    head(`GTT 한국 특허 모니터링 — ${r.startedAt.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })}`) +
    `- 점검 범위: ${r.scope}\n- 실제 실행 시각: ${kst(r.startedAt)} (${r.trigger})\n- 직전 점검일: ${kst(r.previousCheckedAt)}\n- 회차 상태: ${r.state}\n- 수집 ${r.stats.fetched}건 · 신규 ${r.stats.added}건 · 변경 ${r.stats.changed}건 · 위험도 상 ${r.stats.high}건\n\n`;
  if (r.events.length === 0) {
    md += "신규·변경 없음\n";
  } else {
    md += `| 구분 | 출원번호 | 명칭 | 이전 | 이후 |\n|---|---|---|---|---|\n${r.events
      .map((e) => `| ${EVENT_LABEL[e.type] ?? e.type} | ${e.appNo} | ${cell(e.title)} | ${cell(e.before)} | ${cell(e.after)} |`)
      .join("\n")}\n`;
  }
  return guard(md);
}

/** 금지어가 있으면 저장 전에 경고 블록을 머리말 아래에 삽입한다. */
function guard(md: string): string {
  // 고정 고지문에는 '침해'가 있으나 금지어(침해한다/침해하지 않는다/무효)는 포함하지 않는다.
  const found = findForbiddenTerms(md);
  if (!found.length) return md;
  console.warn(`[report] 금지어 감지: ${found.join(", ")}`);
  return md.replace(/\n\n/, `\n\n> ⚠️ 경고: 법적 표현 금지어(${found.join(", ")})가 감지되었습니다. 변리사 검토 전 문구를 확인하세요.\n\n`);
}
