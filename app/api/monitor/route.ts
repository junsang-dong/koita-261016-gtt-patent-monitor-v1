import { runMonitorOnce } from "@/lib/services/monitor";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return Response.json(await runMonitorOnce("MANUAL", { baseUrl: new URL(req.url).origin }));
}
