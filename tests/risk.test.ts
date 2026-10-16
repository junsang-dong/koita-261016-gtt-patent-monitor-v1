import { describe, expect, it } from "vitest";
import { computeRisk } from "@/lib/domain/risk";

describe("computeRisk", () => {
  it("비유효는 항상 하", () => {
    expect(computeRisk({ statusGroup: "inactive", layer: "L1" })).toEqual({ risk: "LOW", provisional: false });
  });
  it("유효 + 구조(L1/L2) + 미분해 → 잠정 상", () => {
    for (const layer of ["L1", "L2"] as const)
      expect(computeRisk({ statusGroup: "valid", layer })).toEqual({ risk: "HIGH", provisional: true });
  });
  it("유효 + 구조 + 요소 수 ≤ 4 → 상, 초과 → 중", () => {
    expect(computeRisk({ statusGroup: "valid", layer: "L2", elementCount: 4 })).toEqual({ risk: "HIGH", provisional: false });
    expect(computeRisk({ statusGroup: "valid", layer: "L2", elementCount: 5 })).toEqual({ risk: "MID", provisional: false });
  });
  it("임계값을 바꿀 수 있다", () => {
    expect(computeRisk({ statusGroup: "valid", layer: "L1", elementCount: 6 }, 6).risk).toBe("HIGH");
  });
  it("유효 + L3/L4/UNCLASSIFIED → 중", () => {
    for (const layer of ["L3", "L4", "UNCLASSIFIED"] as const)
      expect(computeRisk({ statusGroup: "valid", layer }).risk).toBe("MID");
  });
  it("공개 + 구조 → 중, 공개 + 그 외 → 하", () => {
    expect(computeRisk({ statusGroup: "pending", layer: "L2" }).risk).toBe("MID");
    expect(computeRisk({ statusGroup: "pending", layer: "L3" }).risk).toBe("LOW");
    expect(computeRisk({ statusGroup: "pending", layer: "UNCLASSIFIED" }).risk).toBe("LOW");
  });
});
