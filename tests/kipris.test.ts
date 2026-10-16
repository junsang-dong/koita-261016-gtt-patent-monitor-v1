import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";
import { describe, expect, it } from "vitest";
import { dedupeByAppNo, normalizeAppNo, normalizeDate, parseSearchResponse } from "@/lib/kipris/normalize";
import { normalizeKey } from "@/lib/kipris/client";
import { mapStatus } from "@/lib/domain/status";

const xml = readFileSync("tests/fixtures/kipris/search-page1.xml", "utf8");
const json = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true }).parse(xml);

describe("kipris normalize", () => {
  it("출원번호·날짜를 정규화한다", () => {
    expect(normalizeAppNo("10-2020-0012345")).toBe("1020200012345");
    expect(normalizeDate("20200205")).toBe("2020-02-05");
    expect(normalizeDate("2021.04.28")).toBe("2021-04-28");
    expect(normalizeDate("")).toBeNull();
  });
  it("출원인 표기 변형으로 중복된 건을 제거한다", () => {
    const { items, totalCount } = parseSearchResponse(json);
    expect(items).toHaveLength(3);
    expect(totalCount).toBe(554); // response.count.totalCount (실제 응답 구조)
    const unique = dedupeByAppNo(items);
    expect(unique.map((u) => u.appNo)).toEqual(["1020200012345", "1020210054321"]);
    expect(unique[0].ipc).toEqual(["F17C 3/04", "B63B 25/16"]);
    expect(unique[0].statusGroup).toBe("valid");
    expect(unique[1].statusGroup).toBe("pending");
  });
  it("인코딩된 서비스 키를 디코드한다", () => {
    expect(normalizeKey("abc%2Bdef%3D")).toBe("abc+def=");
    expect(normalizeKey("plain+key=")).toBe("plain+key=");
  });
});

describe("mapStatus", () => {
  it("매핑 표", () => {
    expect(mapStatus("등록").group).toBe("valid");
    expect(mapStatus("공개").group).toBe("pending");
    expect(mapStatus("심사중").group).toBe("pending");
    for (const s of ["소멸", "거절", "취하", "포기"]) expect(mapStatus(s).group).toBe("inactive");
  });
  it("그 외·빈 값은 pending + 경고", () => {
    expect(mapStatus("")).toEqual({ group: "pending", warn: true });
    expect(mapStatus("알수없음")).toEqual({ group: "pending", warn: true });
  });
});

describe("seedRegDigits", () => {
  it("종별코드를 제외하고 KIPRIS 등록번호 접두와 맞는다", async () => {
    const { seedRegDigits } = await import("@/lib/services/patents");
    expect(seedRegDigits("KR102202778B1")).toBe("102202778");
    expect("1022027780000".startsWith(seedRegDigits("KR102202778B1"))).toBe(true);
    expect(seedRegDigits("garbage")).toBe("");
  });
});
