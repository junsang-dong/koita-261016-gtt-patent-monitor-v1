import { runMonitorOnce } from "@/lib/services/monitor";

export const maxDuration = 300; // 플랜별 상한은 배포 전 확인
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await runMonitorOnce("CRON", { baseUrl: new URL(req.url).origin });
  return Response.json(result);
}
