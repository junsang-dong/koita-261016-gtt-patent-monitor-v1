import { kiprisCall, KiprisError } from "./client";
import { parseSearchResponse } from "./normalize";

export type ConnectionTest = {
  ok: boolean;
  message: string;
  sample?: { appNo: string; title: string; status: string | null };
  totalCount?: number;
};

/** 연결 테스트: 출원인 검색 1건으로 키·엔드포인트·응답 태그 매핑을 한 번에 확인한다. */
export async function kiprisConnectionTest(): Promise<ConnectionTest> {
  if (!process.env.KIPRIS_PLUS_API_KEY) {
    return { ok: false, message: "KIPRIS_PLUS_API_KEY가 설정되지 않았습니다 (.env.local)." };
  }
  try {
    const json = await kiprisCall("getAdvancedSearch", {
      applicant: "GAZTRANSPORT ET TECHNIGAZ",
      patent: "true",
      utility: "true",
      numOfRows: 1,
      pageNo: 1,
    });
    const { items, totalCount } = parseSearchResponse(json);
    if (!items.length) {
      return {
        ok: false,
        totalCount,
        message: "응답은 정상이나 정규화된 결과가 0건입니다. 파라미터명·응답 태그(FIELD_MAP)를 포털 명세와 대조하세요.",
      };
    }
    const s = items[0];
    return { ok: true, totalCount, message: "연결 성공", sample: { appNo: s.appNo, title: s.title, status: s.status } };
  } catch (e) {
    if (e instanceof KiprisError) return { ok: false, message: `${e.code}: ${e.msg}` };
    return { ok: false, message: e instanceof Error ? e.message : "알 수 없는 오류" };
  }
}
