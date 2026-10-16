/* eslint-disable @typescript-eslint/no-explicit-any -- KIPRIS XML 응답은 비정형 */
import { XMLParser } from "fast-xml-parser";

const BASE = "https://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/"; // 'Sevice'는 공식 경로 철자

export class KiprisError extends Error {
  constructor(
    public code: string,
    public msg: string,
  ) {
    super(`KIPRIS ${code}: ${msg}`);
    this.name = "KiprisError";
  }
}

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false, // 번호가 숫자로 변환되며 앞자리 0이 사라지는 것을 방지
  trimValues: true,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 포털 키가 URL 인코딩돼 있을 수 있으므로 한 번 디코드한 뒤 URLSearchParams가 다시 인코딩한다. */
export function normalizeKey(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export type KiprisCallStats = { calls: number };

let lastCallAt = 0;

/** 오퍼레이션 1회 호출. 에러 메시지·로그에 요청 URL(ServiceKey 포함)을 남기지 않는다. */
export async function kiprisCall(
  operation: string,
  params: Record<string, string | number>,
  stats?: KiprisCallStats,
): Promise<any> {
  const key = process.env.KIPRIS_PLUS_API_KEY;
  if (!key) throw new KiprisError("NO_KEY", "KIPRIS_PLUS_API_KEY가 설정되지 않았습니다.");

  const qs = new URLSearchParams({ ...stringify(params), ServiceKey: normalizeKey(key) });
  const target = `${BASE}${operation}?${qs.toString()}`;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= 2; attempt++) {
    const wait = 300 - (Date.now() - lastCallAt);
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
    if (stats) stats.calls += 1;
    try {
      const res = await fetch(target, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const json = parser.parse(xml);
      assertOk(json);
      return json;
    } catch (e) {
      if (e instanceof KiprisError) throw e; // API 오류는 재시도하지 않는다
      lastErr = e;
      if (attempt < 2) await sleep(500 * 2 ** attempt);
    }
  }
  const reason = lastErr instanceof Error ? lastErr.message : "unknown";
  throw new KiprisError("NETWORK", `요청 실패 (${reason})`);
}

function stringify(p: Record<string, string | number>): Record<string, string> {
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)]));
}

function assertOk(json: any) {
  // 정상: response.header.resultCode = "00" 또는 "0" / 일부 서비스는 최상위 <response><header>
  const header = json?.response?.header ?? json?.header;
  const code = header?.resultCode;
  if (code !== undefined && code !== "00" && code !== "0" && code !== "") {
    throw new KiprisError(String(code), String(header?.resultMsg ?? ""));
  }
  // 인증 실패 등은 <OpenAPI_ServiceResponse><cmmMsgHeader> 형태로 오기도 한다
  const cmm = json?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (cmm) {
    throw new KiprisError(
      String(cmm.returnReasonCode ?? "ERR"),
      String(cmm.returnAuthMsg ?? cmm.errMsg ?? ""),
    );
  }
}
