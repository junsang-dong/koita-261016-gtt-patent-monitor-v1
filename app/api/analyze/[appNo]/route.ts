import { analyzePatent, NeedManualClaimError } from "@/lib/services/analyze";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: RouteContext<"/api/analyze/[appNo]">) {
  const { appNo } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    return Response.json(await analyzePatent(appNo, typeof body?.claimText === "string" ? body.claimText : undefined));
  } catch (e) {
    const status = e instanceof NeedManualClaimError ? 422 : 502;
    return Response.json({ error: e instanceof Error ? e.message : "분석 실패" }, { status });
  }
}
