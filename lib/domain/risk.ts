import type { Layer, Risk, StatusGroup } from "./taxonomy";

export function computeRisk(
  p: {
    statusGroup: StatusGroup;
    layer: Layer;
    elementCount?: number; // 청구항 분해 전이면 undefined
  },
  highMaxElements = 4,
): { risk: Risk; provisional: boolean } {
  const structural = p.layer === "L1" || p.layer === "L2";
  if (p.statusGroup === "inactive") return { risk: "LOW", provisional: false };
  if (p.statusGroup === "valid" && structural) {
    if (p.elementCount === undefined) return { risk: "HIGH", provisional: true }; // 잠정 '상'
    return p.elementCount <= highMaxElements
      ? { risk: "HIGH", provisional: false }
      : { risk: "MID", provisional: false }; // 요소가 많아 권리 범위가 좁은 편
  }
  if (p.statusGroup === "valid") return { risk: "MID", provisional: false }; // L3·L4
  if (structural) return { risk: "MID", provisional: false }; // 공개 + L1·L2
  return { risk: "LOW", provisional: false }; // 공개 + L3·L4
}
