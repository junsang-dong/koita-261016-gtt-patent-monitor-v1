import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, dbTx, schema } from "@/lib/db";
import { getAliases, getSettings } from "@/lib/db/queries";
import { searchByApplicants } from "@/lib/kipris/search";
import { dedupeByAppNo } from "@/lib/kipris/normalize";
import { KiprisError } from "@/lib/kipris/client";
import { diffPatents } from "@/lib/domain/diff";
import { monitorReport } from "@/lib/report/markdown";
import { notifyRun } from "@/lib/notify";
import { recomputeRisk, upsertPatents } from "./patents";
import { classifyPending } from "./classify";
import { analyzePatent } from "./analyze";

const { monitorRuns, monitorEvents, patentStatusHistory, patents } = schema;

const MAX_AUTO_ANALYZE = 3;

export type RunStats = { fetched: number; added: number; changed: number; high: number };

/** 같은 날(KST) 이미 DONE인 CRON 회차가 있으면 건너뛴다. 진행 중(PARTIAL)이면 cursor부터 재개. */
export async function startOrResumeRun(trigger: "CRON" | "MANUAL") {
  if (trigger === "CRON") {
    const [done] = await db()
      .select({ id: monitorRuns.id })
      .from(monitorRuns)
      .where(
        and(
          eq(monitorRuns.state, "DONE"),
          eq(monitorRuns.trigger, "CRON"),
          sql`(${monitorRuns.finishedAt} at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date`,
        ),
      )
      .limit(1);
    if (done) return { skipped: true as const, runId: done.id };
  }
  const [partial] = await db()
    .select()
    .from(monitorRuns)
    .where(eq(monitorRuns.state, "PARTIAL"))
    .orderBy(desc(monitorRuns.id))
    .limit(1);
  if (partial) {
    await db().update(monitorRuns).set({ state: "RUNNING" }).where(eq(monitorRuns.id, partial.id));
    return { skipped: false as const, run: { ...partial, state: "RUNNING" as const } };
  }
  const [run] = await db().insert(monitorRuns).values({ trigger, state: "RUNNING" }).returning();
  return { skipped: false as const, run };
}

type Run = typeof monitorRuns.$inferSelect;

/**
 * 모니터링 1회차. deadlineMs(경과 한도) 30초 전에 PARTIAL로 종료하고 cursor를 저장한다.
 * "이벤트 기록 + 상태 이력 + patents 갱신"은 Pool 트랜잭션으로 묶는다.
 */
export async function runMonitor(run: Run, opts: { budgetMs?: number; baseUrl?: string } = {}) {
  const t0 = Date.now();
  const budget = opts.budgetMs ?? 270_000; // maxDuration 300초 − 30초
  const stats = { calls: run.apiCalls ?? 0 };
  const acc: RunStats = run.stats ?? { fetched: 0, added: 0, changed: 0, high: 0 };

  try {
    const [aliases, settings] = await Promise.all([getAliases(), getSettings()]);
    const active = aliases.filter((a) => a.active);
    const [prev] = await db()
      .select({ at: sql<Date | null>`max(${patents.lastChecked})` })
      .from(patents);
    const previousCheckedAt = prev?.at ? new Date(prev.at) : null;

    const baseline = await db()
      .select({ appNo: patents.appNo, status: patents.status, regNo: patents.regNo })
      .from(patents);

    const search = await searchByApplicants({
      aliases: active.map((a) => a.alias),
      rows: settings.rows,
      maxPages: settings.maxPages,
      cursor: run.cursor ?? null,
      shouldStop: () => Date.now() - t0 > budget,
      stats,
    });
    const fetched = dedupeByAppNo(search.items);
    const events = diffPatents(baseline, fetched);
    const byNo = new Map(fetched.map((f) => [f.appNo, f]));
    const touched = [...new Set(events.map((e) => e.appNo))];

    await dbTx().transaction(async (tx) => {
      await upsertPatents(tx, fetched);
      if (events.length) {
        await tx.insert(monitorEvents).values(
          events.map((e) => ({ runId: run.id, appNo: e.appNo, type: e.type, before: e.before, after: e.after })),
        );
        const hist = events
          .filter((e) => e.type !== "NEW")
          .map((e) => ({
            appNo: e.appNo,
            runId: run.id,
            field: e.type === "STATUS_CHANGED" ? "status" : "reg_no",
            before: e.before,
            after: e.after,
          }));
        if (hist.length) await tx.insert(patentStatusHistory).values(hist);
      }
    });

    await recomputeRisk(fetched.map((f) => f.appNo));
    if (touched.length && process.env.ANTHROPIC_API_KEY) await classifyPending(touched.length, touched);
    await recomputeRisk(touched);

    // 위험도 '상' 신규 건은 analyze 자동 실행 (시간·비용 한도 내에서)
    let high = 0;
    if (touched.length) {
      const hs = await db()
        .select({ appNo: patents.appNo })
        .from(patents)
        .where(and(inArray(patents.appNo, touched), eq(patents.risk, "HIGH")));
      high = hs.length;
      if (process.env.ANTHROPIC_API_KEY) {
        for (const h of hs.slice(0, MAX_AUTO_ANALYZE)) {
          if (Date.now() - t0 > budget) break;
          try {
            await analyzePatent(h.appNo);
          } catch {
            // 청구항 미확보 등은 상세 화면의 수동 입력으로 넘긴다
          }
        }
      }
    }

    acc.fetched += fetched.length;
    acc.added += events.filter((e) => e.type === "NEW").length;
    acc.changed += events.filter((e) => e.type !== "NEW").length;
    acc.high += high;

    const state = search.cursor ? "PARTIAL" : "DONE";
    const allEvents = await db()
      .select({
        type: monitorEvents.type,
        appNo: monitorEvents.appNo,
        title: patents.title,
        before: monitorEvents.before,
        after: monitorEvents.after,
      })
      .from(monitorEvents)
      .innerJoin(patents, eq(patents.appNo, monitorEvents.appNo))
      .where(eq(monitorEvents.runId, run.id));
    const report = monitorReport({
      runId: run.id,
      trigger: run.trigger,
      startedAt: run.startedAt ?? new Date(),
      previousCheckedAt,
      scope: `출원인 별칭 ${active.length}종 · 특허/실용신안 · 페이지당 ${settings.rows}건`,
      stats: acc,
      state,
      events: allEvents,
    });
    void byNo;

    await db()
      .update(monitorRuns)
      .set({
        state,
        finishedAt: state === "DONE" ? new Date() : null,
        cursor: search.cursor,
        stats: acc,
        apiCalls: stats.calls,
        reportMd: report,
        error: null,
      })
      .where(eq(monitorRuns.id, run.id));
    await notifyRun({ runId: run.id, state, stats: acc, baseUrl: opts.baseUrl });
    return { runId: run.id, state, stats: acc };
  } catch (e) {
    // KIPRIS 에러 코드·메시지는 원문 그대로 남긴다 (요청 URL/키는 KiprisError에 담기지 않는다)
    const msg = e instanceof KiprisError ? `${e.code}: ${e.msg}` : e instanceof Error ? e.message : String(e);
    await db()
      .update(monitorRuns)
      .set({ state: "FAILED", finishedAt: new Date(), error: msg, apiCalls: stats.calls, stats: acc })
      .where(eq(monitorRuns.id, run.id));
    await notifyRun({ runId: run.id, state: "FAILED", stats: acc, error: msg, baseUrl: opts.baseUrl });
    return { runId: run.id, state: "FAILED" as const, stats: acc, error: msg };
  }
}

export async function runMonitorOnce(trigger: "CRON" | "MANUAL", opts: { budgetMs?: number; baseUrl?: string } = {}) {
  const started = await startOrResumeRun(trigger);
  if (started.skipped) return { skipped: true as const, runId: started.runId };
  return { skipped: false as const, ...(await runMonitor(started.run, opts)) };
}
