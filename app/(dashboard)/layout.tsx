import { TopNav, SideNav } from "@/components/Nav";
import { hasDatabase } from "@/lib/db";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 수집·모니터링 Server Action 시간 한도

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="gnb">
        <div className="gnb-inner">
          <span className="brand">
            GTT PATENT MONITOR<small>한국 특허 분석·모니터링</small>
          </span>
          <nav style={{ display: "flex", gap: 22, flex: 1 }}>
            <TopNav />
          </nav>
          <form action={logoutAction}>
            <button className="btn sm ghost" type="submit">
              로그아웃
            </button>
          </form>
        </div>
      </header>
      <div className="shell">
        <SideNav />
        <main className="content">
          {!hasDatabase() && (
            <div className="notice err">
              DATABASE_URL이 비어 있습니다. <span className="mono">.env.local</span>에 Neon 연결 문자열을 넣고{" "}
              <span className="mono">npm run db:migrate && npm run db:seed</span>를 실행하세요.
            </div>
          )}
          {hasDatabase() && children}
        </main>
      </div>
    </>
  );
}
