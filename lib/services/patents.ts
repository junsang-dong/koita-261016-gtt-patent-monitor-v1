import { eq, inArray, sql, desc } from "drizzle-orm";
import { db, dbTx, schema } from "@/lib/db";
import { computeRisk } from "@/lib/domain/risk";
import { getSettings } from "@/lib/db/queries";
import type { NormalizedPatent } from "@/lib/kipris/normalize";

const { patents, claimCharts } = schema;

type Tx = Parameters<Parameters<ReturnType<typeof dbTx>["transaction"]>[0]>[0];

/** 서지 필드만 갱신한다. family/layer/risk는 건드리지 않는다. verified는 API로 승격. */
export async function upsertPatents(tx: Tx, items: NormalizedPatent[]) {
  for (const p of items) {
    const values = {
      appNo: p.appNo,
      appDate: p.appDate,
      title: p.title,
      applicant: p.applicant,
      ipc: p.ipc,
      pubNo: p.pubNo,
      pubDate: p.pubDate,
      regNo: p.regNo,
      regDate: p.regDate,
      status: p.status,
      statusGroup: p.statusGroup,
      abstract: p.abstract,
      verified: "API" as const,
      lastChecked: new Date(),
      raw: p.raw as never,
    };
    const { appNo: _k, ...set } = values;
    void _k;
    await tx.insert(patents).values(values).onConflictDoUpdate({ target: patents.appNo, set });
  }
}

/** "KR102202778B1" → "102202778" (종별코드 B1 등은 제외). KIPRIS 등록번호 "1022027780000"의 접두와 대조한다. */
export function seedRegDigits(regNo: string | null | undefined): string {
  return /^KR(\d+)[A-Z]\d?$/i.exec((regNo ?? "").trim())?.[1] ?? "";
}

/** 시드(WEB) 임시키 레코드를 KIPRIS 등록번호로 대조해 API 레코드로 대체한다. */
export async function reconcileSeedPlaceholders(tx: Tx, items: NormalizedPatent[]) {
  const placeholders = await tx.select().from(patents).where(sql`${patents.appNo} like 'REG-%'`);
  for (const ph of placeholders) {
    const digits = seedRegDigits(ph.regNo);
    if (!digits) continue;
    const hit = items.find((i) => i.regNo && i.regNo.replace(/\D/g, "").startsWith(digits));
    if (hit) await tx.delete(patents).where(eq(patents.appNo, ph.appNo));
  }
}

/** 위험도는 결정적 규칙 함수로만 계산한다. 대상 미지정이면 전체 재계산. */
export async function recomputeRisk(appNos?: string[]) {
  const settings = await getSettings();
  const rows = await db()
    .select({
      appNo: patents.appNo,
      statusGroup: patents.statusGroup,
      layer: patents.layer,
    })
    .from(patents)
    .where(appNos?.length ? inArray(patents.appNo, appNos) : undefined);
  if (!rows.length) return;

  const charts = await db()
    .select({ appNo: claimCharts.appNo, n: claimCharts.elementCount })
    .from(claimCharts)
    .orderBy(desc(claimCharts.id));
  const latest = new Map<string, number>();
  for (const c of charts) if (!latest.has(c.appNo)) latest.set(c.appNo, c.n);

  const groups = new Map<string, { risk: "HIGH" | "MID" | "LOW"; provisional: boolean; ids: string[] }>();
  for (const r of rows) {
    const res = computeRisk(
      { statusGroup: r.statusGroup ?? "pending", layer: r.layer ?? "UNCLASSIFIED", elementCount: latest.get(r.appNo) },
      settings.highMaxElements,
    );
    const key = `${res.risk}:${res.provisional}`;
    const g = groups.get(key) ?? { ...res, ids: [] };
    g.ids.push(r.appNo);
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    for (let i = 0; i < g.ids.length; i += 500) {
      await db()
        .update(patents)
        .set({ risk: g.risk, riskProvisional: g.provisional })
        .where(inArray(patents.appNo, g.ids.slice(i, i + 500)));
    }
  }
}
