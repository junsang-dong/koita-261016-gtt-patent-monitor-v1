import { config } from "dotenv";
config({ path: ".env.local" });

// 부록 B 시드: 웹(Google Patents) 확인 5건. 출원번호를 알 수 없어 임시키(REG-…)를 쓰며,
// KIPRIS 수집 시 등록번호가 대조되면 API 레코드로 대체된다. 위험도는 모두 '잠정'.
const SEEDS = [
  { reg: "KR102202778B1", title: "코너에서 주름이 연속되는 주름형 밀봉 멤브레인 탱크", family: "MK3", layer: "L2" },
  { reg: "KR102525751B1", title: "앵글 브래킷·앵커 로드 코너 구조", family: "MK3", layer: "L2" },
  { reg: "KR101645155B1", title: "주름 아래 보강재로 슬로싱 동압 대응", family: "MK3", layer: "L2" },
  { reg: "KR102561638B1", title: "1차 단열 패널 틈 대류 방지 충전판", family: "FLEX", layer: "L3" },
  { reg: "KR102120988B1", title: "2차 단열 패널 사이 브리징 요소", family: "ETC", layer: "L2" },
] as const;

async function main() {
  const { db, schema } = await import("../lib/db");
  const { getAliases, saveSetting, DEFAULT_SETTINGS } = await import("../lib/db/queries");
  const { recomputeRisk } = await import("../lib/services/patents");

  await getAliases(); // 별칭 기본값 시드
  await saveSetting("ipc_supplementary", DEFAULT_SETTINGS.ipcSupplementary);
  await saveSetting("high_max_elements", DEFAULT_SETTINGS.highMaxElements);
  await saveSetting("rows", DEFAULT_SETTINGS.rows);
  await saveSetting("max_pages", DEFAULT_SETTINGS.maxPages);

  for (const s of SEEDS) {
    await db()
      .insert(schema.patents)
      .values({
        appNo: `REG-${s.reg}`,
        title: s.title,
        applicant: "GAZTRANSPORT ET TECHNIGAZ",
        regNo: s.reg,
        status: "등록",
        statusGroup: "valid",
        family: s.family,
        layer: s.layer,
        verified: "WEB",
        lastChecked: new Date(),
      })
      .onConflictDoNothing();
  }
  await recomputeRisk(SEEDS.map((s) => `REG-${s.reg}`));
  console.log("seeded");
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
