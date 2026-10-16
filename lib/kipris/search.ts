import { kiprisCall, type KiprisCallStats } from "./client";
import { parseSearchResponse, type NormalizedPatent } from "./normalize";

export type SearchCursor = { aliasIndex: number; page: number };

export type SearchOptions = {
  aliases: string[];
  rows: number;
  maxPages: number;
  cursor?: SearchCursor | null;
  /** 시간 제한 대비: true를 반환하면 현재 위치를 cursor로 돌려주고 중단한다 */
  shouldStop?: () => boolean;
  stats: KiprisCallStats;
  onAliasHit?: (alias: string, totalCount: number) => void;
};

export type SearchResult = {
  items: NormalizedPatent[];
  /** 중단됐으면 재개 지점, 끝까지 돌았으면 null */
  cursor: SearchCursor | null;
};

/** 출원인 변형별로 페이지를 돌며 수집한다. 특허·실용신안 모두 포함. */
export async function searchByApplicants(opts: SearchOptions): Promise<SearchResult> {
  const out: NormalizedPatent[] = [];
  const startAlias = opts.cursor?.aliasIndex ?? 0;
  for (let a = startAlias; a < opts.aliases.length; a++) {
    const alias = opts.aliases[a];
    const startPage = a === startAlias ? (opts.cursor?.page ?? 1) : 1;
    let aliasTotal = 0;
    for (let page = startPage; page <= opts.maxPages; page++) {
      if (opts.shouldStop?.()) return { items: out, cursor: { aliasIndex: a, page } };
      const json = await kiprisCall(
        "getAdvancedSearch",
        { applicant: alias, patent: "true", utility: "true", numOfRows: opts.rows, pageNo: page },
        opts.stats,
      );
      const { items, totalCount } = parseSearchResponse(json);
      aliasTotal = totalCount;
      out.push(...items);
      if (items.length < opts.rows || page * opts.rows >= totalCount) break;
    }
    opts.onAliasHit?.(alias, aliasTotal);
  }
  return { items: out, cursor: null };
}
