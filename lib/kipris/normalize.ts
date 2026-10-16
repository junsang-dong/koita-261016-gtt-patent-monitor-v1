/* eslint-disable @typescript-eslint/no-explicit-any -- KIPRIS XML 응답은 비정형 */
import { mapStatus } from "@/lib/domain/status";
import type { StatusGroup } from "@/lib/domain/taxonomy";

// 응답 태그 → 스키마 필드 (KIPRIS Plus 포털 명세와 대조 필요)
export const FIELD_MAP = {
  applicationNumber: "appNo",
  applicationDate: "appDate",
  inventionTitle: "title",
  applicantName: "applicant",
  ipcNumber: "ipc",
  openNumber: "pubNo",
  openDate: "pubDate",
  registerNumber: "regNo",
  registerDate: "regDate",
  registerStatus: "status",
  astrtCont: "abstract",
} as const;

export type NormalizedPatent = {
  appNo: string;
  appDate: string | null;
  title: string;
  applicant: string | null;
  ipc: string[];
  pubNo: string | null;
  pubDate: string | null;
  regNo: string | null;
  regDate: string | null;
  status: string | null;
  statusGroup: StatusGroup;
  abstract: string | null;
  raw: Record<string, unknown>;
};

const asArray = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** 출원번호: 하이픈·공백 제거 (10-2020-0012345 → 1020200012345) */
export function normalizeAppNo(v: unknown): string {
  return String(v ?? "").replace(/[\s-]/g, "");
}

/** YYYYMMDD / YYYY.MM.DD / YYYY-MM-DD → YYYY-MM-DD, 해석 불가면 null */
export function normalizeDate(v: unknown): string | null {
  const s = String(v ?? "").replace(/[.\s/]/g, "-").replace(/-+/g, "-");
  const digits = s.replace(/-/g, "");
  if (/^\d{8}$/.test(digits)) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  return null;
}

const blank = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};

export function normalizeItem(item: Record<string, any>): NormalizedPatent | null {
  const appNo = normalizeAppNo(item.applicationNumber);
  const title = blank(item.inventionTitle);
  if (!appNo || !title) return null;
  const ipc = String(item.ipcNumber ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const status = blank(item.registerStatus);
  return {
    appNo,
    appDate: normalizeDate(item.applicationDate),
    title,
    applicant: blank(item.applicantName),
    ipc,
    pubNo: blank(item.openNumber),
    pubDate: normalizeDate(item.openDate),
    regNo: blank(item.registerNumber),
    regDate: normalizeDate(item.registerDate),
    status,
    statusGroup: mapStatus(status).group,
    abstract: blank(item.astrtCont),
    raw: item,
  };
}

/** getAdvancedSearch 응답 → 정규화된 특허 배열 + 총 건수 */
export function parseSearchResponse(json: any): { items: NormalizedPatent[]; totalCount: number } {
  const body = json?.response?.body;
  const rawItems = asArray<Record<string, any>>(body?.items?.item);
  const items = rawItems.map(normalizeItem).filter((x): x is NormalizedPatent => x !== null);
  // 실제 응답: response.count.totalCount (body와 형제). 다른 위치도 방어적으로 확인한다.
  const totalCount =
    Number(json?.response?.count?.totalCount ?? body?.count?.totalCount ?? body?.totalCount ?? items.length) || 0;
  return { items, totalCount };
}

/** 같은 출원번호 중복 제거 (출원인 표기 변형으로 같은 건이 여러 번 나온다) */
export function dedupeByAppNo(items: NormalizedPatent[]): NormalizedPatent[] {
  const map = new Map<string, NormalizedPatent>();
  for (const it of items) if (!map.has(it.appNo)) map.set(it.appNo, it);
  return [...map.values()];
}
