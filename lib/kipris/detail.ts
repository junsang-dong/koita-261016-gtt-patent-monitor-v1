/* eslint-disable @typescript-eslint/no-explicit-any -- KIPRIS XML 응답은 비정형 */
import { kiprisCall, type KiprisCallStats } from "./client";

const asArray = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

export type ClaimDetail = {
  claims: { no: number; text: string }[];
  /** 서지상세에 청구항 필드가 비어 있으면 false → 수동 입력 유도 */
  hasClaims: boolean;
};

/** 서지상세·청구항 조회 (getBibliographyDetailInfoSearch) */
export async function fetchClaims(appNo: string, stats?: KiprisCallStats): Promise<ClaimDetail> {
  const json = await kiprisCall("getBibliographyDetailInfoSearch", { applicationNumber: appNo }, stats);
  const body = json?.response?.body;
  const infos = asArray<any>(body?.item?.claimInfoArray?.claimInfo ?? body?.claimInfoArray?.claimInfo);
  const claims = infos
    .map((c, i) => ({ no: i + 1, text: String(c?.claim ?? "").trim() }))
    .filter((c) => c.text.length > 0);
  return { claims, hasClaims: claims.length > 0 };
}

/** 청구항 배열에서 독립항 후보만 추린다 (다른 청구항을 인용하지 않는 항). */
export function pickIndependentClaims(claims: { no: number; text: string }[]) {
  const dependent = /(제\s*\d+\s*항|청구항\s*\d+|of claim\s*\d+|according to claim)/i;
  return claims.filter((c) => !dependent.test(c.text.slice(0, 200)));
}
