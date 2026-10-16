import { describe, expect, it } from "vitest";
import { diffPatents } from "@/lib/domain/diff";

describe("diffPatents", () => {
  const baseline = [
    { appNo: "A", status: "공개", regNo: null },
    { appNo: "B", status: "등록", regNo: "R1" },
    { appNo: "C", status: "등록", regNo: "R2" },
  ];
  it("신규·상태변경·등록번호 부여 3종을 감지한다", () => {
    const fetched = [
      { appNo: "A", status: "등록", regNo: "R9" }, // 상태 변경 + 등록번호 부여
      { appNo: "B", status: "등록", regNo: "R1" }, // 변화 없음
      { appNo: "D", status: "공개", regNo: null }, // 신규 (C는 수집에서 빠져도 이벤트 없음)
    ];
    const ev = diffPatents(baseline, fetched);
    expect(ev.map((e) => `${e.type}:${e.appNo}`).sort()).toEqual(
      ["NEW:D", "REG_NO_ASSIGNED:A", "STATUS_CHANGED:A"].sort(),
    );
  });
  it("같은 출원번호 중복 수집은 한 번만 비교한다", () => {
    const ev = diffPatents([], [
      { appNo: "X", status: "공개", regNo: null },
      { appNo: "X", status: "공개", regNo: null },
    ]);
    expect(ev).toHaveLength(1);
  });
  it("빈 상태값으로는 상태 변경을 만들지 않는다", () => {
    expect(diffPatents(baseline, [{ appNo: "B", status: "", regNo: "R1" }])).toEqual([]);
  });
  it("1건 삭제 시 신규로 다시 감지된다", () => {
    const ev = diffPatents(baseline.slice(0, 2), baseline);
    expect(ev).toEqual([{ type: "NEW", appNo: "C", before: null, after: "등록" }]);
  });
});
