import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

export const MODEL = () => process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

let _client: Anthropic | undefined;
export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
  return (_client ??= new Anthropic());
}

/**
 * 결과 스키마를 하나의 tool로 정의해 JSON만 받는다. 최신 모델은 tool_choice 강제(any/tool)가
 * 400이므로 auto + 프롬프트 지시로 호출시키고, 호출 누락·Zod 검증 실패는 1회 재요청한다.
 * 다시 실패하면 null을 반환한다(호출부가 UNCLASSIFIED 폴백).
 */
export async function callStructured<T>(opts: {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  jsonSchema: Record<string, unknown>;
  zod: z.ZodType<T>;
  maxTokens?: number;
}): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await anthropic().messages.create({
      model: MODEL(),
      max_tokens: opts.maxTokens ?? 16000,
      output_config: { effort: "medium" },
      system: opts.system,
      tools: [
        {
          name: opts.toolName,
          description: opts.toolDescription,
          input_schema: { type: "object", ...opts.jsonSchema } as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content:
            `${opts.user}\n\n반드시 \`${opts.toolName}\` 도구를 호출해 결과를 제출하세요. 도구 호출 외의 텍스트 답변은 쓰지 마세요.` +
            (attempt === 0 ? "" : "\n(이전 응답이 도구 호출 누락 또는 스키마 검증 실패였습니다. 스키마를 정확히 지켜 다시 제출하세요.)"),
        },
      ],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") continue;
    const parsed = opts.zod.safeParse(block.input);
    if (parsed.success) return parsed.data;
  }
  return null;
}
