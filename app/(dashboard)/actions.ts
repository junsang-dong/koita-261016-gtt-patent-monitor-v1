"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { acknowledgeEvents, saveSetting } from "@/lib/db/queries";
import { collectAll } from "@/lib/services/collect";
import { classifyPending, setManualClassification } from "@/lib/services/classify";
import { analyzePatent } from "@/lib/services/analyze";
import { runMonitorOnce } from "@/lib/services/monitor";
import { kiprisConnectionTest } from "@/lib/kipris/health";
import { FAMILIES, LAYERS, type Family, type Layer } from "@/lib/domain/taxonomy";
import { SESSION_COOKIE } from "@/lib/auth";
import type { ActionResult } from "@/components/ActionButton";

const fail = (e: unknown): ActionResult => ({ ok: false, message: e instanceof Error ? e.message : "실행 실패" });
const refresh = () => revalidatePath("/", "layout");

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function collectAction(dryRun: boolean): Promise<ActionResult> {
  try {
    const r = await collectAll({ dryRun });
    refresh();
    const alias = r.perAlias.map((a) => `${a.alias} ${a.count}건`).join(" · ");
    const cls = r.classified ? ` · 분류 ${r.classified.classified}건` : "";
    return {
      ok: !r.warning,
      message: `${dryRun ? "[미리보기] " : ""}수집 ${r.fetched}건 → 중복 제거 ${r.unique}건 · KIPRIS 호출 ${r.apiCalls}회${cls}. ${alias}${r.warning ? ` ⚠ ${r.warning}` : ""}`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function classifyAction(): Promise<ActionResult> {
  try {
    const r = await classifyPending(50);
    refresh();
    return { ok: true, message: `분류 ${r.classified}건 (분류 필요 ${r.unclassified}건)` };
  } catch (e) {
    return fail(e);
  }
}

export async function analyzeAction(appNo: string, claimText?: string): Promise<ActionResult> {
  try {
    const r = await analyzePatent(appNo, claimText);
    refresh();
    const warn = r.forbiddenTerms.length ? ` ⚠ 금지어 감지: ${r.forbiddenTerms.join(", ")}` : "";
    return { ok: true, message: `구성요소 ${r.elementCount}개로 분해했습니다.${warn}` };
  } catch (e) {
    return fail(e);
  }
}

export async function monitorAction(): Promise<ActionResult> {
  try {
    const r = await runMonitorOnce("MANUAL");
    refresh();
    if (r.skipped) return { ok: true, message: "이미 오늘 완료된 회차가 있습니다." };
    if (r.state === "FAILED") return { ok: false, message: `실패: ${"error" in r ? r.error : ""}` };
    return {
      ok: true,
      message: `${r.state === "PARTIAL" ? "일부 완료(이어서 실행 가능) · " : ""}신규 ${r.stats.added}건 · 변경 ${r.stats.changed}건 · 위험도 상 ${r.stats.high}건`,
    };
  } catch (e) {
    return fail(e);
  }
}

/** 시연용: 기준 DB에서 가장 최근 API 수집 1건을 삭제 → 다음 모니터링에서 '신규 1건' 감지. */
export async function demoDeleteOneAction(): Promise<ActionResult> {
  try {
    const [row] = await db()
      .select({ appNo: schema.patents.appNo, title: schema.patents.title })
      .from(schema.patents)
      .where(eq(schema.patents.verified, "API"))
      .orderBy(desc(schema.patents.firstSeen))
      .limit(1);
    if (!row) return { ok: false, message: "삭제할 API 수집 건이 없습니다. 먼저 전체 수집을 실행하세요." };
    await db().delete(schema.patents).where(eq(schema.patents.appNo, row.appNo));
    refresh();
    return { ok: true, message: `기준에서 삭제: ${row.appNo} (${row.title}). 이제 '지금 실행'을 눌러 보세요.` };
  } catch (e) {
    return fail(e);
  }
}

export async function ackAction(ids: number[]): Promise<ActionResult> {
  await acknowledgeEvents(ids);
  refresh();
  return { ok: true, message: `${ids.length}건 확인 처리` };
}

export async function manualClassifyAction(appNo: string, formData: FormData) {
  const family = String(formData.get("family"));
  const layer = String(formData.get("layer"));
  const note = String(formData.get("note") ?? "").trim() || undefined;
  if (!(FAMILIES as readonly string[]).includes(family) || !(LAYERS as readonly string[]).includes(layer)) return;
  await setManualClassification(appNo, family as Family, layer as Layer, note);
  refresh();
}

export async function manualClaimAction(appNo: string, formData: FormData) {
  const claimText = String(formData.get("claimText") ?? "").trim();
  if (!claimText) return;
  await analyzePatent(appNo, claimText);
  refresh();
}

export async function addAliasAction(formData: FormData) {
  const alias = String(formData.get("alias") ?? "").trim();
  if (!alias) return;
  await db().insert(schema.applicantAliases).values({ alias }).onConflictDoNothing();
  refresh();
}

export async function toggleAliasAction(id: number, active: boolean) {
  await db().update(schema.applicantAliases).set({ active }).where(eq(schema.applicantAliases.id, id));
  refresh();
}

export async function deleteAliasAction(id: number) {
  await db().delete(schema.applicantAliases).where(eq(schema.applicantAliases.id, id));
  refresh();
}

export async function saveThresholdsAction(formData: FormData) {
  const n = (k: string, min: number, max: number, d: number) => {
    const v = Number(formData.get(k));
    return Number.isFinite(v) ? Math.min(Math.max(Math.round(v), min), max) : d;
  };
  await saveSetting("high_max_elements", n("highMaxElements", 1, 20, 4));
  await saveSetting("rows", n("rows", 10, 100, 100));
  await saveSetting("max_pages", n("maxPages", 1, 50, 10));
  const codes = String(formData.get("ipc") ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const tentative = formData.get("tentative") === "on";
  await saveSetting("ipc_supplementary", codes.map((code) => ({ code, tentative })));
  const { recomputeRisk } = await import("@/lib/services/patents");
  await recomputeRisk();
  refresh();
}

export async function testKiprisAction(): Promise<ActionResult> {
  const r = await kiprisConnectionTest();
  return {
    ok: r.ok,
    message: r.ok ? `연결 성공 · 총 ${r.totalCount}건 · 예: ${r.sample?.appNo} ${r.sample?.title}` : r.message,
  };
}
