import { collectAll } from "@/lib/services/collect";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    return Response.json(await collectAll({ dryRun: Boolean(body?.dryRun) }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "수집 실패" }, { status: 502 });
  }
}
