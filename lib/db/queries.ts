import { and, asc, desc, eq, gte, ilike, inArray, lte, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db, schema } from "./index";

const { patents, classifications, claimCharts, monitorRuns, monitorEvents, patentStatusHistory, applicantAliases, settings } =
  schema;

export const DEFAULT_ALIASES = [
  "가즈트랑스포르 에 떼끄니가즈",
  "가즈트랑스포르에떼끄니가즈",
  "GAZTRANSPORT ET TECHNIGAZ",
  "GAZTRANSPORT & TECHNIGAZ",
];

export type AppSettings = {
  ipcSupplementary: { code: string; tentative: boolean }[];
  highMaxElements: number;
  rows: number;
  maxPages: number;
};

export const DEFAULT_SETTINGS: AppSettings = {
  ipcSupplementary: [
    { code: "F17C 3/02", tentative: true },
    { code: "F17C 3/04", tentative: true },
    { code: "B63B 25/16", tentative: true },
    { code: "F17C 13/00", tentative: true },
  ],
  highMaxElements: 4,
  rows: 100,
  maxPages: 10,
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db().select().from(settings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    ipcSupplementary: (map.ipc_supplementary as AppSettings["ipcSupplementary"]) ?? DEFAULT_SETTINGS.ipcSupplementary,
    highMaxElements: Number(map.high_max_elements ?? DEFAULT_SETTINGS.highMaxElements),
    rows: Number(map.rows ?? DEFAULT_SETTINGS.rows),
    maxPages: Number(map.max_pages ?? DEFAULT_SETTINGS.maxPages),
  };
}

export async function saveSetting(key: string, value: unknown) {
  await db()
    .insert(settings)
    .values({ key, value: value as never })
    .onConflictDoUpdate({ target: settings.key, set: { value: value as never } });
}

export async function getAliases() {
  const rows = await db().select().from(applicantAliases).orderBy(asc(applicantAliases.id));
  if (rows.length === 0) {
    await db()
      .insert(applicantAliases)
      .values(DEFAULT_ALIASES.map((alias) => ({ alias })))
      .onConflictDoNothing();
    return db().select().from(applicantAliases).orderBy(asc(applicantAliases.id));
  }
  return rows;
}

export type PatentFilter = {
  statusGroup?: string;
  family?: string;
  layer?: string;
  risk?: string;
  verified?: string;
  year?: string;
  q?: string;
  sort?: string;
  dir?: "asc" | "desc";
};

function whereFor(f: PatentFilter): SQL | undefined {
  const c: SQL[] = [];
  if (f.statusGroup) c.push(eq(patents.statusGroup, f.statusGroup as never));
  if (f.family) c.push(eq(patents.family, f.family as never));
  if (f.layer) c.push(eq(patents.layer, f.layer as never));
  if (f.risk) c.push(eq(patents.risk, f.risk as never));
  if (f.verified) c.push(eq(patents.verified, f.verified as never));
  if (f.year && /^\d{4}$/.test(f.year)) {
    c.push(gte(patents.appDate, `${f.year}-01-01`), lte(patents.appDate, `${f.year}-12-31`));
  }
  if (f.q?.trim()) c.push(ilike(patents.title, `%${f.q.trim().replace(/[%_]/g, "\\$&")}%`));
  return c.length ? and(...c) : undefined;
}

const SORTABLE = {
  appDate: patents.appDate,
  title: patents.title,
  status: patents.statusGroup,
  risk: patents.risk,
  family: patents.family,
} as const;

export async function listPatents(f: PatentFilter, limit = 500) {
  const col = SORTABLE[(f.sort as keyof typeof SORTABLE) ?? "appDate"] ?? patents.appDate;
  const order = f.dir === "asc" ? asc(col) : desc(col);
  return db().select().from(patents).where(whereFor(f)).orderBy(order, asc(patents.appNo)).limit(limit);
}

export async function getPatent(appNo: string) {
  const [p] = await db().select().from(patents).where(eq(patents.appNo, appNo)).limit(1);
  if (!p) return null;
  const [cls, charts, history] = await Promise.all([
    db().select().from(classifications).where(eq(classifications.appNo, appNo)).orderBy(desc(classifications.id)),
    db().select().from(claimCharts).where(eq(claimCharts.appNo, appNo)).orderBy(desc(claimCharts.id)),
    db().select().from(patentStatusHistory).where(eq(patentStatusHistory.appNo, appNo)).orderBy(desc(patentStatusHistory.detectedAt)),
  ]);
  return { patent: p, classifications: cls, claimCharts: charts, history };
}

export async function filterYears(): Promise<string[]> {
  const rows = await db()
    .selectDistinct({ y: sql<string>`to_char(${patents.appDate}, 'YYYY')` })
    .from(patents)
    .where(sql`${patents.appDate} is not null`)
    .orderBy(desc(sql`1`));
  return rows.map((r) => r.y);
}

export async function dashboardData() {
  const [totals] = await db()
    .select({
      total: sql<number>`count(*)::int`,
      valid: sql<number>`count(*) filter (where ${patents.statusGroup} = 'valid')::int`,
      pending: sql<number>`count(*) filter (where ${patents.statusGroup} = 'pending')::int`,
      high: sql<number>`count(*) filter (where ${patents.risk} = 'HIGH' and ${patents.statusGroup} <> 'inactive')::int`,
      unverified: sql<number>`count(*) filter (where ${patents.verified} <> 'API')::int`,
    })
    .from(patents);
  const group = async (col: AnyPgColumn) =>
    db()
      .select({ k: sql<string>`coalesce(${col}::text, 'NONE')`, n: sql<number>`count(*)::int` })
      .from(patents)
      .groupBy(col);
  const [byStatus, byFamily, byLayer, byYear, events] = await Promise.all([
    group(patents.statusGroup),
    group(patents.family),
    group(patents.layer),
    db()
      .select({ k: sql<string>`to_char(${patents.appDate}, 'YYYY')`, n: sql<number>`count(*)::int` })
      .from(patents)
      .where(sql`${patents.appDate} is not null`)
      .groupBy(sql`1`)
      .orderBy(asc(sql`1`)),
    recentEvents(5),
  ]);
  return { totals, byStatus, byFamily, byLayer, byYear, events };
}

export async function recentEvents(limit = 5) {
  return db()
    .select({
      id: monitorEvents.id,
      runId: monitorEvents.runId,
      appNo: monitorEvents.appNo,
      type: monitorEvents.type,
      before: monitorEvents.before,
      after: monitorEvents.after,
      acknowledged: monitorEvents.acknowledged,
      title: patents.title,
    })
    .from(monitorEvents)
    .innerJoin(patents, eq(patents.appNo, monitorEvents.appNo))
    .orderBy(desc(monitorEvents.id))
    .limit(limit);
}

export async function listRuns(limit = 30) {
  return db()
    .select({
      id: monitorRuns.id,
      trigger: monitorRuns.trigger,
      startedAt: monitorRuns.startedAt,
      finishedAt: monitorRuns.finishedAt,
      state: monitorRuns.state,
      stats: monitorRuns.stats,
      apiCalls: monitorRuns.apiCalls,
      error: monitorRuns.error,
    })
    .from(monitorRuns)
    .orderBy(desc(monitorRuns.id))
    .limit(limit);
}

export async function getRun(id: number) {
  const [run] = await db().select().from(monitorRuns).where(eq(monitorRuns.id, id)).limit(1);
  if (!run) return null;
  const events = await db()
    .select({
      id: monitorEvents.id,
      appNo: monitorEvents.appNo,
      type: monitorEvents.type,
      before: monitorEvents.before,
      after: monitorEvents.after,
      acknowledged: monitorEvents.acknowledged,
      title: patents.title,
    })
    .from(monitorEvents)
    .innerJoin(patents, eq(patents.appNo, monitorEvents.appNo))
    .where(eq(monitorEvents.runId, id))
    .orderBy(asc(monitorEvents.id));
  return { run, events };
}

export async function unacknowledgedEvents(limit = 100) {
  return db()
    .select({
      id: monitorEvents.id,
      runId: monitorEvents.runId,
      appNo: monitorEvents.appNo,
      type: monitorEvents.type,
      before: monitorEvents.before,
      after: monitorEvents.after,
      title: patents.title,
    })
    .from(monitorEvents)
    .innerJoin(patents, eq(patents.appNo, monitorEvents.appNo))
    .where(eq(monitorEvents.acknowledged, false))
    .orderBy(desc(monitorEvents.id))
    .limit(limit);
}

export async function acknowledgeEvents(ids: number[]) {
  if (!ids.length) return;
  await db().update(monitorEvents).set({ acknowledged: true }).where(inArray(monitorEvents.id, ids));
}
