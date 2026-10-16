import {
  pgSchema,
  text,
  date,
  timestamp,
  boolean,
  jsonb,
  integer,
  serial,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// 다른 앱과 공유하는 DB이므로 전용 스키마(gtt)에만 만든다. public은 건드리지 않는다.
export const gtt = pgSchema("gtt");

export const family = gtt.enum("family", ["NO96", "MK3", "FLEX", "SLIM", "GST", "ETC", "UNCLASSIFIED"]);
export const layer = gtt.enum("layer", ["L1", "L2", "L3", "L4", "UNCLASSIFIED"]);
export const risk = gtt.enum("risk", ["HIGH", "MID", "LOW"]);
export const statusGroup = gtt.enum("status_group", ["valid", "pending", "inactive"]);
export const verified = gtt.enum("verified", ["API", "WEB", "UNVERIFIED"]);
export const classSource = gtt.enum("class_source", ["AI", "MANUAL"]);
export const claimSource = gtt.enum("claim_source", ["API", "MANUAL_INPUT"]);
export const runTrigger = gtt.enum("run_trigger", ["CRON", "MANUAL"]);
export const runState = gtt.enum("run_state", ["RUNNING", "DONE", "FAILED", "PARTIAL"]);
export const eventType = gtt.enum("event_type", ["NEW", "STATUS_CHANGED", "REG_NO_ASSIGNED"]);

export const patents = gtt.table(
  "patents",
  {
    appNo: text("app_no").primaryKey(),
    appDate: date("app_date"),
    title: text("title").notNull(),
    applicant: text("applicant"),
    ipc: text("ipc").array(),
    pubNo: text("pub_no"),
    pubDate: date("pub_date"),
    regNo: text("reg_no"),
    regDate: date("reg_date"),
    status: text("status"),
    statusGroup: statusGroup("status_group"),
    abstract: text("abstract"),
    family: family("family").default("UNCLASSIFIED"),
    layer: layer("layer").default("UNCLASSIFIED"),
    risk: risk("risk"),
    riskProvisional: boolean("risk_provisional").default(true),
    verified: verified("verified").default("UNVERIFIED"),
    firstSeen: timestamp("first_seen", { withTimezone: true }).defaultNow(),
    lastChecked: timestamp("last_checked", { withTimezone: true }),
    raw: jsonb("raw"),
  },
  (t) => [
    index("patents_status_risk_idx").on(t.statusGroup, t.risk),
    index("patents_family_layer_idx").on(t.family, t.layer),
    index("patents_app_date_idx").on(t.appDate.desc()),
    index("patents_title_trgm_idx").using("gin", sql`${t.title} gin_trgm_ops`),
  ],
);

export const classifications = gtt.table("classifications", {
  id: serial("id").primaryKey(),
  appNo: text("app_no")
    .notNull()
    .references(() => patents.appNo, { onDelete: "cascade" }),
  family: family("family").notNull(),
  layer: layer("layer").notNull(),
  evidence: jsonb("evidence").$type<{ family: string[]; layer: string[] }>(),
  confidence: numeric("confidence", { precision: 4, scale: 3 }),
  model: text("model"),
  promptVersion: text("prompt_version"),
  source: classSource("source").notNull().default("AI"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type ClaimElement = {
  label: string;
  gist: string;
  meaning: string;
  avoid_points: string[];
};

export const claimCharts = gtt.table("claim_charts", {
  id: serial("id").primaryKey(),
  appNo: text("app_no")
    .notNull()
    .references(() => patents.appNo, { onDelete: "cascade" }),
  claimNo: integer("claim_no").notNull(),
  otherIndependent: integer("other_independent").array(),
  elements: jsonb("elements").$type<ClaimElement[]>().notNull(),
  elementCount: integer("element_count").notNull(),
  keyLimiting: text("key_limiting"),
  reviewIdeas: text("review_ideas"),
  claimSource: claimSource("claim_source").notNull(),
  model: text("model"),
  promptVersion: text("prompt_version"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const monitorRuns = gtt.table("monitor_runs", {
  id: serial("id").primaryKey(),
  trigger: runTrigger("trigger").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  state: runState("state").notNull().default("RUNNING"),
  cursor: jsonb("cursor").$type<{ aliasIndex: number; page: number } | null>(),
  stats: jsonb("stats").$type<{ fetched: number; added: number; changed: number; high: number }>(),
  apiCalls: integer("api_calls").notNull().default(0),
  error: text("error"),
  reportMd: text("report_md"),
});

export const patentStatusHistory = gtt.table("patent_status_history", {
  id: serial("id").primaryKey(),
  appNo: text("app_no")
    .notNull()
    .references(() => patents.appNo, { onDelete: "cascade" }),
  runId: integer("run_id").references(() => monitorRuns.id, { onDelete: "set null" }),
  field: text("field").notNull(), // status | reg_no
  before: text("before"),
  after: text("after"),
  detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow(),
});

export const monitorEvents = gtt.table("monitor_events", {
  id: serial("id").primaryKey(),
  runId: integer("run_id")
    .notNull()
    .references(() => monitorRuns.id, { onDelete: "cascade" }),
  appNo: text("app_no")
    .notNull()
    .references(() => patents.appNo, { onDelete: "cascade" }),
  type: eventType("type").notNull(),
  before: text("before"),
  after: text("after"),
  acknowledged: boolean("acknowledged").notNull().default(false),
});

export const applicantAliases = gtt.table("applicant_aliases", {
  id: serial("id").primaryKey(),
  alias: text("alias").notNull().unique(),
  active: boolean("active").notNull().default(true),
  lastHitCount: integer("last_hit_count"),
});

export const settings = gtt.table("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});
