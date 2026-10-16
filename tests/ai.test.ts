import { describe, expect, it } from "vitest";
import { applyConfidenceFloor, classifyResultSchema } from "@/lib/ai/classify";
import { claimChartSchema } from "@/lib/ai/claim-chart";
import { findForbiddenTerms } from "@/lib/domain/taxonomy";
import { claimChartReport } from "@/lib/report/markdown";

describe("AI 출력 검증", () => {
  it("신뢰도 0.6 미만은 UNCLASSIFIED로 내린다", () => {
    expect(applyConfidenceFloor({ family: "MK3", layer: "L2", confidence: 0.59 })).toMatchObject({ family: "UNCLASSIFIED", layer: "UNCLASSIFIED" });
    expect(applyConfidenceFloor({ family: "MK3", layer: "L2", confidence: 0.6 })).toMatchObject({ family: "MK3", layer: "L2" });
  });
  it("스키마 위반(잘못된 enum)을 거부한다", () => {
    const bad = { results: [{ appNo: "1", family: "XX", layer: "L2", evidence: { family: [], layer: [] }, confidence: 0.9 }] };
    expect(classifyResultSchema.safeParse(bad).success).toBe(false);
    expect(claimChartSchema.safeParse({ claimNo: 1, otherIndependent: [], elements: [], keyLimiting: "A", reviewIdeas: "" }).success).toBe(false);
  });
  it("금지어를 검출하고 보고서에 경고를 넣는다", () => {
    expect(findForbiddenTerms("이 설계는 침해하지 않는다")).toEqual(["침해하지 않는다"]);
    const md = claimChartReport({
      appNo: "1", title: "t", claimNo: 1, otherIndependent: [], claimSource: "API", keyLimiting: "A",
      reviewIdeas: "이 특허는 무효이다",
      elements: [{ label: "A", gist: "g", meaning: "m", avoid_points: [] }],
    });
    expect(md).toContain("경고");
    expect(md).toContain("변리사 검토 대상");
  });
});
