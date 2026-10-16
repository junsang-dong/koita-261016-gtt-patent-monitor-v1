import { getRun } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/export/report/[runId]">) {
  const { runId } = await ctx.params;
  const id = Number(runId);
  const data = Number.isInteger(id) ? await getRun(id) : null;
  if (!data?.run.reportMd) return new Response("Not found", { status: 404 });
  const date = (data.run.startedAt ?? new Date()).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  return new Response(data.run.reportMd, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="gtt_kr_new_${date}.md"`,
    },
  });
}
