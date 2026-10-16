/**
 * GTT 특허 모니터 MCP 서버 (stdio)
 * Claude 프롬프트 창에서 수집된 한국 특허를 검색하고 보고서를 작성할 수 있게 한다.
 * 앱의 lib/ 모듈(DB 조회·보고서 생성·청구항 분해)을 그대로 재사용한다.
 *
 * 주의: stdio 서버이므로 stdout에는 JSON-RPC 외에 아무것도 쓰지 않는다(로그는 stderr).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// .env.local 로드 (Claude가 어느 작업 폴더에서 실행해도 프로젝트 루트 기준)
config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".env.local"), quiet: true });

import { dashboardData, getPatent, getRun, listPatents, listRuns, recentEvents } from "@/lib/db/queries";
import { analyzePatent, NeedManualClaimError } from "@/lib/services/analyze";
import { claimChartReport, summaryReport } from "@/lib/report/markdown";
import {
  DISCLAIMER,
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

const INSTRUCTIONS = `GTT(Gaztransport & Technigaz) 한국 특허 데이터베이스(KIPRIS 수집, LNG 화물창 단열시스템)를 조회·분석하는 도구 모음이다.
- 먼저 gtt_dashboard_summary로 전체 규모를 파악하고, gtt_search_patents로 후보를 좁힌 뒤 gtt_get_patent로 상세를 본다.
- 보고서는 gtt_summary_report / gtt_claim_chart_report가 만든 마크다운을 그대로 쓰거나, 검색 결과를 근거로 직접 작성한다.
- 직접 작성하는 보고서의 규칙: 출원번호를 근거로 명시, 검증 출처(API/웹/미검증)와 '잠정' 위험도를 표시, 도구가 반환하지 않은 번호·청구항·상태를 만들어내지 않는다.
- "침해한다/침해하지 않는다/무효" 같은 법적 결론은 쓰지 않는다. 필요하면 "검토 필요"로 표현하고 다음 고지를 보고서 머리말에 넣는다: ${DISCLAIMER}`;

const server = new McpServer({ name: "gtt-patent-monitor", version: "1.0.0" }, { instructions: INSTRUCTIONS });

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (t: string) => ({ content: [{ type: "text" as const, text: t }], isError: true });
const cell = (v: unknown) => String(v ?? "-").replace(/\|/g, "\\|").replace(/\n/g, " ");

const filterShape = {
  status_group: z.enum(STATUS_GROUPS).optional().describe("법적상태군: valid(유효 권리) / pending(잠재 권리) / inactive(비유효)"),
  family: z.enum(FAMILIES).optional().describe("기술 계열: NO96, MK3, FLEX, SLIM, GST, ETC(기타), UNCLASSIFIED"),
  layer: z.enum(LAYERS).optional().describe("보호 층위: L1 전체 구조, L2 핵심 구조(코너·주름·앵커), L3 부재·충전재·공정, L4 주변 요소"),
  risk: z.enum(RISKS).optional().describe("위험도(규칙 계산): HIGH(상) / MID(중) / LOW(하)"),
  verified: z.enum(VERIFIED).optional().describe("검증 출처: API / WEB / UNVERIFIED"),
  year: z.string().regex(/^\d{4}$/).optional().describe("출원연도 (예: 2021)"),
};

// ---------- 검색 ----------
server.registerTool(
  "gtt_search_patents",
  {
    title: "GTT 특허 검색",
    description:
      "수집된 GTT 한국 특허를 키워드(명칭 부분 일치)와 필터(상태·계열·층위·위험도·검증·출원연도)로 검색한다. 결과는 출원번호·명칭·상태·계열/층위·위험도 표. 상세는 gtt_get_patent로 조회.",
    inputSchema: {
      query: z.string().max(200).optional().describe("명칭 검색어 (한글, 부분 일치)"),
      ...filterShape,
      sort: z.enum(["appDate", "title", "status", "risk", "family"]).default("appDate").describe("정렬 기준"),
      direction: z.enum(["asc", "desc"]).default("desc"),
      limit: z.number().int().min(1).max(50).default(20).describe("최대 반환 건수 (1~50)"),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async (a) => {
    const rows = await listPatents(
      {
        q: a.query,
        statusGroup: a.status_group,
        family: a.family,
        layer: a.layer,
        risk: a.risk,
        verified: a.verified,
        year: a.year,
        sort: a.sort,
        dir: a.direction,
      },
      a.limit,
    );
    if (!rows.length) return text("조건에 맞는 특허가 없습니다. 필터를 줄이거나 검색어를 바꿔 보세요.");
    const head = "| 출원번호 | 출원일 | 명칭 | 상태 | 계열/층위 | 위험도 | 검증 |\n|---|---|---|---|---|---|---|";
    const body = rows
      .map(
        (p) =>
          `| ${p.appNo} | ${p.appDate ?? "-"} | ${cell(p.title)} | ${p.statusGroup ? STATUS_GROUP_LABEL[p.statusGroup] : "-"} | ${p.family ?? "-"}/${p.layer ?? "-"} | ${p.risk ? RISK_LABEL[p.risk] : "-"}${p.riskProvisional ? "(잠정)" : ""} | ${p.verified ? VERIFIED_LABEL[p.verified] : "-"} |`,
      )
      .join("\n");
    return text(`${rows.length}건 (limit ${a.limit})\n\n${head}\n${body}\n\n> ${DISCLAIMER}`);
  },
);

// ---------- 상세 ----------
server.registerTool(
  "gtt_get_patent",
  {
    title: "GTT 특허 상세",
    description: "출원번호로 서지 정보, 분류 결과와 근거 단어, 청구항 분해(있는 경우), 상태 변경 이력을 조회한다.",
    inputSchema: { app_no: z.string().min(5).max(40).describe("출원번호 (예: 1020170046026)") },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ app_no }) => {
    const d = await getPatent(app_no.replace(/[\s-]/g, ""));
    if (!d) return fail(`출원번호 ${app_no}를 찾을 수 없습니다. gtt_search_patents로 먼저 검색하세요.`);
    const { patent: p, classifications, claimCharts, history } = d;
    const cls = classifications[0];
    const chart = claimCharts[0];
    const lines = [
      `# ${p.title}`,
      "",
      `- 출원번호: ${p.appNo} (출원일 ${p.appDate ?? "-"})`,
      `- 출원인: ${p.applicant ?? "-"}`,
      `- 공개: ${p.pubNo ?? "-"} ${p.pubDate ? `(${p.pubDate})` : ""} / 등록: ${p.regNo ?? "-"} ${p.regDate ? `(${p.regDate})` : ""}`,
      `- 법적상태: ${p.status ?? "-"} → ${p.statusGroup ? STATUS_GROUP_LABEL[p.statusGroup] : "-"}`,
      `- IPC: ${(p.ipc ?? []).join(", ") || "-"}`,
      `- 계열/층위: ${p.family ? FAMILY_LABEL[p.family] : "-"} / ${p.layer ? LAYER_LABEL[p.layer] : "-"}`,
      `- 위험도: ${p.risk ? RISK_LABEL[p.risk] : "-"}${p.riskProvisional ? " (잠정: 청구항 미분해)" : ""}`,
      `- 검증: ${p.verified ? VERIFIED_LABEL[p.verified] : "-"}`,
      `- 요약: ${p.abstract ?? "-"}`,
    ];
    if (cls) {
      lines.push(
        "",
        "## 분류 근거",
        `- 출처: ${cls.source === "MANUAL" ? "수동 분류" : `AI (신뢰도 ${cls.confidence})`}`,
        `- 계열 근거 단어: ${cls.evidence?.family.join(", ") || "-"}`,
        `- 층위 근거 단어: ${cls.evidence?.layer.join(", ") || "-"}`,
      );
    }
    if (chart) {
      lines.push("", `## 청구항 분해 (독립항 ${chart.claimNo}항, 구성요소 ${chart.elementCount}개, 핵심 한정 ${chart.keyLimiting ?? "-"})`);
      for (const e of chart.elements) lines.push(`- ${e.label}: ${e.gist} — ${e.meaning} [검토 지점: ${e.avoid_points.join(", ") || "-"}]`);
      lines.push("", `검토 아이디어(변리사 검토 전 초안): ${chart.reviewIdeas ?? "-"}`);
    } else {
      lines.push("", "## 청구항 분해", "아직 분해되지 않았습니다. gtt_analyze_claims로 실행할 수 있습니다.");
    }
    if (history.length) {
      lines.push("", "## 상태 이력");
      for (const h of history) lines.push(`- ${h.detectedAt?.toISOString().slice(0, 10)} ${h.field}: ${h.before ?? "-"} → ${h.after ?? "-"}`);
    }
    lines.push("", `> ${DISCLAIMER}`);
    return text(lines.join("\n"));
  },
);

// ---------- 요약 ----------
server.registerTool(
  "gtt_dashboard_summary",
  {
    title: "GTT 특허 현황 요약",
    description: "전체 건수, 상태·계열·층위 분포, 위험도 '상' 건수, 연도별 출원 추이, 최근 모니터링 이벤트를 한 번에 조회한다.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async () => {
    const d = await dashboardData();
    const dist = (rows: { k: string; n: number }[], label: (k: string) => string) =>
      rows
        .sort((a, b) => b.n - a.n)
        .map((r) => `${label(r.k)} ${r.n}`)
        .join(" · ");
    const t = d.totals;
    return text(
      [
        `총 ${t.total}건 (유효 권리 ${t.valid} · 잠재 권리 ${t.pending}) · 위험도 상 ${t.high}건 · API 미확인 ${t.unverified}건`,
        `상태: ${dist(d.byStatus, (k) => STATUS_GROUP_LABEL[k as keyof typeof STATUS_GROUP_LABEL] ?? k)}`,
        `계열: ${dist(d.byFamily, (k) => k)}`,
        `층위: ${dist(d.byLayer, (k) => k)}`,
        `연도별 출원: ${d.byYear.map((r) => `${r.k}년 ${r.n}`).join(" · ")}`,
        `최근 이벤트: ${d.events.length ? d.events.map((e) => `${e.type} ${e.appNo}`).join(", ") : "없음"}`,
        "",
        `> ${DISCLAIMER}`,
      ].join("\n"),
    );
  },
);

// ---------- 보고서 ----------
server.registerTool(
  "gtt_summary_report",
  {
    title: "GTT 수집 요약 보고서(.md)",
    description:
      "필터에 맞는 특허로 '수집 요약 보고서'(총 건수, 상태·계열·층위 집계, 위험도 상 목록, 최근 3년 추이)를 마크다운으로 생성한다. 필터를 생략하면 전체 대상. 머리말에 고정 고지문이 포함된다.",
    inputSchema: filterShape,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async (a) => {
    const rows = await listPatents(
      { statusGroup: a.status_group, family: a.family, layer: a.layer, risk: a.risk, verified: a.verified, year: a.year },
      10000,
    );
    if (!rows.length) return fail("조건에 맞는 특허가 없어 보고서를 만들 수 없습니다.");
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    return text(summaryReport(rows, today));
  },
);

server.registerTool(
  "gtt_claim_chart_report",
  {
    title: "청구항 분해 보고서(.md)",
    description: "이미 분해된 특허의 청구항 분해 보고서를 마크다운으로 생성한다. 분해 전이면 gtt_analyze_claims를 먼저 실행해야 한다.",
    inputSchema: { app_no: z.string().min(5).max(40) },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ app_no }) => {
    const no = app_no.replace(/[\s-]/g, "");
    const d = await getPatent(no);
    if (!d) return fail(`출원번호 ${app_no}를 찾을 수 없습니다.`);
    const chart = d.claimCharts[0];
    if (!chart) return fail("청구항 분해 결과가 없습니다. 먼저 gtt_analyze_claims를 실행하세요.");
    return text(
      claimChartReport({
        appNo: no,
        title: d.patent.title,
        claimNo: chart.claimNo,
        otherIndependent: chart.otherIndependent,
        elements: chart.elements,
        keyLimiting: chart.keyLimiting,
        reviewIdeas: chart.reviewIdeas,
        claimSource: chart.claimSource,
      }),
    );
  },
);

// ---------- 분석 (쓰기 + 외부 호출) ----------
server.registerTool(
  "gtt_analyze_claims",
  {
    title: "청구항 구성요소 분해 실행",
    description:
      "KIPRIS에서 청구항을 가져와 Claude로 독립항을 구성요소로 분해하고 DB에 저장한 뒤 위험도를 재계산한다. KIPRIS·Claude API를 호출(비용 발생)하며 기존 분해 결과를 덮어쓴다. KIPRIS에 청구항이 없으면 claim_text로 독립항 원문을 직접 넘겨야 한다.",
    inputSchema: {
      app_no: z.string().min(5).max(40),
      claim_text: z.string().max(20000).optional().describe("독립항 원문 (KIPRIS에 청구항이 없을 때만)"),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
  async ({ app_no, claim_text }) => {
    try {
      const no = app_no.replace(/[\s-]/g, "");
      const r = await analyzePatent(no, claim_text);
      const warn = r.forbiddenTerms.length ? `\n⚠️ 금지어 감지: ${r.forbiddenTerms.join(", ")} — 문구를 확인하세요.` : "";
      return text(`분해 완료: 구성요소 ${r.elementCount}개 (청구항 출처: ${r.source}). 위험도가 재계산되었습니다. gtt_get_patent 또는 gtt_claim_chart_report로 확인하세요.${warn}`);
    } catch (e) {
      if (e instanceof NeedManualClaimError) return fail(`${e.message} (claim_text 인자로 독립항을 전달하세요.)`);
      return fail(e instanceof Error ? e.message : "분석 실패");
    }
  },
);

// ---------- 모니터링 ----------
server.registerTool(
  "gtt_monitor_report",
  {
    title: "모니터링 결과 조회",
    description:
      "모니터링 회차 보고서(.md)를 조회한다. run_id를 생략하면 가장 최근 회차. 회차 목록과 최근 이벤트도 함께 보여준다. (모니터링 실행 자체는 웹 앱의 '지금 실행' 또는 주간 Cron이 담당한다.)",
    inputSchema: { run_id: z.number().int().positive().optional() },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ run_id }) => {
    const runs = await listRuns(5);
    if (!runs.length) return text("모니터링 실행 이력이 없습니다.");
    const id = run_id ?? runs[0].id;
    const d = await getRun(id);
    if (!d) return fail(`회차 #${id}를 찾을 수 없습니다.`);
    const list = runs.map((r) => `#${r.id} ${r.trigger} ${r.state} (${r.startedAt?.toISOString().slice(0, 16)})`).join("\n");
    const ev = await recentEvents(5);
    return text(
      `최근 회차:\n${list}\n\n최근 이벤트: ${ev.length ? ev.map((e) => `${e.type} ${e.appNo}`).join(", ") : "없음"}\n\n---\n\n${d.run.reportMd ?? "이 회차에는 보고서가 없습니다."}${d.run.error ? `\n\n오류: ${d.run.error}` : ""}`,
    );
  },
);

async function main() {
  await server.connect(new StdioServerTransport());
  console.error("gtt-patent-monitor MCP server running on stdio");
}
main().catch((e) => {
  console.error("MCP server error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
