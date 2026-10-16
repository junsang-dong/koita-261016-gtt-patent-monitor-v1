import { z } from "zod";
import { callStructured, MODEL } from "./client";
import { CLAIM_CHART_SYSTEM, PROMPT_VERSION } from "./prompts";
import { findForbiddenTerms } from "@/lib/domain/taxonomy";

export const claimChartSchema = z.object({
  claimNo: z.number().int().positive(),
  otherIndependent: z.array(z.number().int()),
  elements: z
    .array(
      z.object({
        label: z.string(),
        gist: z.string(),
        meaning: z.string(),
        avoid_points: z.array(z.string()),
      }),
    )
    .min(1),
  keyLimiting: z.string(),
  reviewIdeas: z.string(),
});

export type ClaimChartResult = z.infer<typeof claimChartSchema> & {
  model: string;
  promptVersion: string;
  forbiddenTerms: string[];
};

const JSON_SCHEMA = {
  properties: {
    claimNo: { type: "integer" },
    otherIndependent: { type: "array", items: { type: "integer" } },
    elements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          gist: { type: "string" },
          meaning: { type: "string" },
          avoid_points: { type: "array", items: { type: "string" } },
        },
        required: ["label", "gist", "meaning", "avoid_points"],
      },
    },
    keyLimiting: { type: "string" },
    reviewIdeas: { type: "string" },
  },
  required: ["claimNo", "otherIndependent", "elements", "keyLimiting", "reviewIdeas"],
};

/** 독립항 원문 → 구성요소 분해. 검증 실패 시 null. */
export async function analyzeClaim(input: {
  appNo: string;
  title: string;
  claimText: string;
  claimNo?: number;
}): Promise<ClaimChartResult | null> {
  const res = await callStructured({
    system: CLAIM_CHART_SYSTEM,
    user: `출원번호: ${input.appNo}\n명칭: ${input.title}\n독립항 번호: ${input.claimNo ?? "(원문에서 판단)"}\n\n[독립항 원문]\n${input.claimText.slice(0, 8000)}`,
    toolName: "record_claim_chart",
    toolDescription: "독립항 구성요소 분해 결과를 기록한다",
    jsonSchema: JSON_SCHEMA,
    zod: claimChartSchema,
  });
  if (!res) return null;
  const text = [res.reviewIdeas, ...res.elements.map((e) => `${e.gist} ${e.meaning} ${e.avoid_points.join(" ")}`)].join(" ");
  return { ...res, model: MODEL(), promptVersion: PROMPT_VERSION, forbiddenTerms: findForbiddenTerms(text) };
}
