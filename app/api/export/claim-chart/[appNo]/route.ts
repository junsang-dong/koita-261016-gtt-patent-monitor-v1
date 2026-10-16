import { getPatent } from "@/lib/db/queries";
import { claimChartReport } from "@/lib/report/markdown";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/export/claim-chart/[appNo]">) {
  const { appNo } = await ctx.params;
  const data = await getPatent(appNo);
  const chart = data?.claimCharts[0];
  if (!data || !chart) return new Response("Not found", { status: 404 });
  const md = claimChartReport({
    appNo,
    title: data.patent.title,
    claimNo: chart.claimNo,
    otherIndependent: chart.otherIndependent,
    elements: chart.elements,
    keyLimiting: chart.keyLimiting,
    reviewIdeas: chart.reviewIdeas,
    claimSource: chart.claimSource,
  });
  return new Response(md, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="claim_chart_${appNo}.md"`,
    },
  });
}
