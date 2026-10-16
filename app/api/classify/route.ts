import { classifyPending } from "@/lib/services/classify";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 200);
  try {
    return Response.json(await classifyPending(limit));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "분류 실패" }, { status: 502 });
  }
}
