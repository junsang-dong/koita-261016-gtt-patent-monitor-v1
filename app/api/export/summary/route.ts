import { listPatents } from "@/lib/db/queries";
import { summaryReport } from "@/lib/report/markdown";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await listPatents({}, 10000);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  return new Response(summaryReport(rows, today), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": 'attachment; filename="gtt_kr_summary.md"',
    },
  });
}
