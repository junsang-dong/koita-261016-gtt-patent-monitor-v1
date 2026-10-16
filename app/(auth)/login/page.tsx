import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, checkPassword, createSessionToken, sessionCookieOptions } from "@/lib/auth";

async function login(formData: FormData) {
  "use server";
  const pw = String(formData.get("password") ?? "");
  if (!checkPassword(pw)) redirect("/login?error=1");
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions);
  redirect("/");
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  return (
    <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card" style={{ width: 380, borderTop: "4px solid var(--navy)" }}>
        <div className="card-body">
          <div className="brand" style={{ color: "var(--navy)", marginBottom: 4 }}>
            GTT PATENT MONITOR
          </div>
          <p className="muted" style={{ marginBottom: 18 }}>
            LNG 화물창 단열시스템 한국 특허 분석·모니터링 (시연용)
          </p>
          {sp.error && <div className="notice err">비밀번호가 올바르지 않습니다.</div>}
          <form action={login} className="flex flex-col gap-3">
            <label className="muted" htmlFor="password" style={{ fontSize: 12, fontWeight: 700 }}>
              접속 비밀번호
            </label>
            <input id="password" name="password" type="password" className="field" autoFocus required />
            <button className="btn" type="submit" style={{ justifyContent: "center", height: 38 }}>
              로그인
            </button>
          </form>
          <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>
            이 앱은 공개 특허 정보만 다룹니다. 자사 설계 자료는 회사 승인 환경에서만 다루세요.
          </p>
        </div>
      </div>
    </div>
  );
}
