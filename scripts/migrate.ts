import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL(.env.local)이 비어 있습니다.");
  const sql = neon(url);
  await sql`CREATE SCHEMA IF NOT EXISTS gtt`;
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle", migrationsSchema: "gtt", migrationsTable: "__drizzle_migrations" });
  console.log("migrated");
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
