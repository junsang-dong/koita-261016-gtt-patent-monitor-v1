import { kiprisConnectionTest } from "@/lib/kipris/health";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await kiprisConnectionTest());
}
