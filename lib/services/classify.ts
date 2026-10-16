import { and, eq, isNull, sql, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { classifyPatents } from "@/lib/ai/classify";
import { recomputeRisk } from "./patents";
import type { Family, Layer } from "@/lib/domain/taxonomy";

const { patents, classifications } = schema;

/** 분류 이력이 한 번도 없는 건만 대상으로 한다 (결과가 있는 건은 재호출하지 않는다). */
export async function classifyPending(limit = 50, only?: string[]) {
  const rows = await db()
    .select({ appNo: patents.appNo, title: patents.title, abstract: patents.abstract, ipc: patents.ipc })
    .from(patents)
    .leftJoin(classifications, eq(classifications.appNo, patents.appNo))
    .where(and(isNull(classifications.id), only?.length ? inArray(patents.appNo, only) : undefined))
    .limit(limit);
  if (!rows.length) return { classified: 0, unclassified: 0 };

  const results = await classifyPatents(rows);
  let unclassified = 0;
  for (const r of results) {
    if (r.family === "UNCLASSIFIED" || r.layer === "UNCLASSIFIED") unclassified++;
    await db().insert(classifications).values({
      appNo: r.appNo,
      family: r.family,
      layer: r.layer,
      evidence: r.evidence,
      confidence: r.confidence.toFixed(3),
      model: r.model,
      promptVersion: r.promptVersion,
      source: "AI",
    });
    await db().update(patents).set({ family: r.family, layer: r.layer }).where(eq(patents.appNo, r.appNo));
  }
  await recomputeRisk(results.map((r) => r.appNo));
  return { classified: results.length, unclassified };
}

/** 연구원 수동 수정 — MANUAL이 우선한다(AI 재분류 대상에서 빠진다). */
export async function setManualClassification(appNo: string, family: Family, layer: Layer, note?: string) {
  await db().insert(classifications).values({
    appNo,
    family,
    layer,
    evidence: { family: note ? [note] : [], layer: [] },
    confidence: "1.000",
    source: "MANUAL",
  });
  await db().update(patents).set({ family, layer }).where(eq(patents.appNo, appNo));
  await recomputeRisk([appNo]);
}

export async function unclassifiedCount(): Promise<number> {
  const [r] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(patents)
    .leftJoin(classifications, eq(classifications.appNo, patents.appNo))
    .where(isNull(classifications.id));
  return r?.n ?? 0;
}
