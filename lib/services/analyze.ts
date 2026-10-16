import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { analyzeClaim } from "@/lib/ai/claim-chart";
import { fetchClaims, pickIndependentClaims } from "@/lib/kipris/detail";
import { recomputeRisk } from "./patents";

const { patents, claimCharts } = schema;

export class NeedManualClaimError extends Error {
  constructor() {
    super("서지상세에 청구항이 없습니다. 상세 화면에서 독립항을 직접 붙여넣어 주세요.");
    this.name = "NeedManualClaimError";
  }
}

/** 청구항 확보 → 구성요소 분해 → claim_charts 저장 → 위험도 재계산 */
export async function analyzePatent(appNo: string, claimText?: string) {
  const [p] = await db().select().from(patents).where(eq(patents.appNo, appNo)).limit(1);
  if (!p) throw new Error("해당 출원번호가 없습니다.");

  let text = claimText?.trim() || "";
  let claimNo: number | undefined;
  let source: "API" | "MANUAL_INPUT" = "MANUAL_INPUT";
  let others: number[] = [];

  if (!text) {
    const detail = await fetchClaims(appNo);
    const independents = pickIndependentClaims(detail.claims);
    if (!independents.length) throw new NeedManualClaimError();
    text = independents[0].text;
    claimNo = independents[0].no;
    others = independents.slice(1).map((c) => c.no);
    source = "API";
  }

  const res = await analyzeClaim({ appNo, title: p.title, claimText: text, claimNo });
  if (!res) throw new Error("청구항 분해 결과가 스키마 검증을 통과하지 못했습니다. 다시 시도해 주세요.");

  await db().delete(claimCharts).where(eq(claimCharts.appNo, appNo));
  await db().insert(claimCharts).values({
    appNo,
    claimNo: claimNo ?? res.claimNo,
    otherIndependent: others.length ? others : res.otherIndependent,
    elements: res.elements,
    elementCount: res.elements.length,
    keyLimiting: res.keyLimiting,
    reviewIdeas: res.reviewIdeas,
    claimSource: source,
    model: res.model,
    promptVersion: res.promptVersion,
  });
  await recomputeRisk([appNo]);
  return { elementCount: res.elements.length, forbiddenTerms: res.forbiddenTerms, source };
}
