import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;

function url(): string {
  const u = process.env.DATABASE_URL;
  if (!u) throw new Error("DATABASE_URL이 설정되지 않았습니다 (.env.local 확인).");
  return u;
}

let _http: ReturnType<typeof drizzleHttp<typeof schema>> | undefined;
let _pool: Pool | undefined;
let _ws: ReturnType<typeof drizzleWs<typeof schema>> | undefined;

/** 단건 조회용 (트랜잭션 불가) */
export function db() {
  return (_http ??= drizzleHttp(neon(url()), { schema }));
}

/** 트랜잭션이 필요한 배치(upsert·모니터링 기록)용 */
export function dbTx() {
  _pool ??= new Pool({ connectionString: url() });
  return (_ws ??= drizzleWs(_pool, { schema }));
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export { schema };
