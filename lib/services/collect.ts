import { eq } from "drizzle-orm";
import { db, dbTx, schema } from "@/lib/db";
import { getAliases, getSettings } from "@/lib/db/queries";
import { searchByApplicants } from "@/lib/kipris/search";
import { dedupeByAppNo } from "@/lib/kipris/normalize";
import { reconcileSeedPlaceholders, recomputeRisk, upsertPatents } from "./patents";
import { classifyPending } from "./classify";

export type CollectResult = {
  fetched: number;
  unique: number;
  apiCalls: number;
  perAlias: { alias: string; count: number }[];
  classified?: { classified: number; unclassified: number };
  dryRun: boolean;
  warning?: string;
};

/** 전체 수집: 출원인 변형별 검색 → 정규화·중복 제거 → upsert → 분류 → 위험도 */
export async function collectAll(opts: { dryRun?: boolean; classify?: boolean } = {}): Promise<CollectResult> {
  const [aliases, settings] = await Promise.all([getAliases(), getSettings()]);
  const active = aliases.filter((a) => a.active);
  const stats = { calls: 0 };
  const perAlias: { alias: string; count: number }[] = [];

  const { items } = await searchByApplicants({
    aliases: active.map((a) => a.alias),
    rows: settings.rows,
    maxPages: settings.maxPages,
    stats,
    onAliasHit: (alias, count) => perAlias.push({ alias, count }),
  });
  const unique = dedupeByAppNo(items);

  const result: CollectResult = {
    fetched: items.length,
    unique: unique.length,
    apiCalls: stats.calls,
    perAlias,
    dryRun: Boolean(opts.dryRun),
  };
  if (unique.length === 0) {
    result.warning = "수집 0건입니다. 출원인 별칭 표기와 KIPRIS 파라미터명(설정 → 연결 테스트)을 확인하세요.";
  }
  if (opts.dryRun || unique.length === 0) return result;

  await dbTx().transaction(async (tx) => {
    await reconcileSeedPlaceholders(tx, unique);
    await upsertPatents(tx, unique);
  });

  for (const h of perAlias) {
    const row = active.find((a) => a.alias === h.alias);
    if (row) await db().update(schema.applicantAliases).set({ lastHitCount: h.count }).where(eq(schema.applicantAliases.id, row.id));
  }

  await recomputeRisk(unique.map((u) => u.appNo));
  if (opts.classify !== false && process.env.ANTHROPIC_API_KEY) {
    result.classified = await classifyPending(50);
  }
  return result;
}
