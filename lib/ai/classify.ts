import { z } from "zod";
import { callStructured, MODEL } from "./client";
import { CLASSIFY_SYSTEM, PROMPT_VERSION } from "./prompts";
import { FAMILIES, LAYERS, type Family, type Layer } from "@/lib/domain/taxonomy";

export const CONFIDENCE_MIN = 0.6;
const BATCH = 10;

export const classifyResultSchema = z.object({
  results: z.array(
    z.object({
      appNo: z.string(),
      family: z.enum(FAMILIES),
      layer: z.enum(LAYERS),
      evidence: z.object({ family: z.array(z.string()), layer: z.array(z.string()) }),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

export type ClassifyInput = { appNo: string; title: string; abstract?: string | null; ipc?: string[] | null; claimText?: string };
export type ClassifyOutput = {
  appNo: string;
  family: Family;
  layer: Layer;
  evidence: { family: string[]; layer: string[] };
  confidence: number;
  model: string;
  promptVersion: string;
};

const JSON_SCHEMA = {
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          appNo: { type: "string" },
          family: { type: "string", enum: [...FAMILIES] },
          layer: { type: "string", enum: [...LAYERS] },
          evidence: {
            type: "object",
            properties: {
              family: { type: "array", items: { type: "string" } },
              layer: { type: "array", items: { type: "string" } },
            },
            required: ["family", "layer"],
          },
          confidence: { type: "number" },
        },
        required: ["appNo", "family", "layer", "evidence", "confidence"],
      },
    },
  },
  required: ["results"],
};

/** 신뢰도 0.6 미만이면 UNCLASSIFIED로 저장한다. */
export function applyConfidenceFloor<T extends { family: Family; layer: Layer; confidence: number }>(r: T): T {
  return r.confidence < CONFIDENCE_MIN ? { ...r, family: "UNCLASSIFIED", layer: "UNCLASSIFIED" } : r;
}

function unclassified(appNo: string): ClassifyOutput {
  return {
    appNo,
    family: "UNCLASSIFIED",
    layer: "UNCLASSIFIED",
    evidence: { family: [], layer: [] },
    confidence: 0,
    model: MODEL(),
    promptVersion: PROMPT_VERSION,
  };
}

/** 10건씩 배치 분류. 검증 실패 건은 UNCLASSIFIED로 폴백. */
export async function classifyPatents(inputs: ClassifyInput[]): Promise<ClassifyOutput[]> {
  const out: ClassifyOutput[] = [];
  for (let i = 0; i < inputs.length; i += BATCH) {
    const chunk = inputs.slice(i, i + BATCH);
    const user = chunk
      .map(
        (p) =>
          `### ${p.appNo}\n명칭: ${p.title}\nIPC: ${(p.ipc ?? []).join(", ") || "-"}\n요약: ${p.abstract ?? "-"}${
            p.claimText ? `\n청구항: ${p.claimText.slice(0, 1500)}` : ""
          }`,
      )
      .join("\n\n");
    const res = await callStructured({
      system: CLASSIFY_SYSTEM,
      user: `다음 ${chunk.length}건을 분류하세요. 입력에 없는 출원번호를 만들지 마세요.\n\n${user}`,
      toolName: "record_classifications",
      toolDescription: "특허별 계열·층위 분류 결과를 기록한다",
      jsonSchema: JSON_SCHEMA,
      zod: classifyResultSchema,
    });
    const byNo = new Map((res?.results ?? []).map((r) => [r.appNo, r]));
    for (const p of chunk) {
      const r = byNo.get(p.appNo);
      out.push(
        r
          ? { ...applyConfidenceFloor(r), model: MODEL(), promptVersion: PROMPT_VERSION }
          : unclassified(p.appNo),
      );
    }
  }
  return out;
}
