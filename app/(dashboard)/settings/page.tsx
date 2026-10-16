import { getAliases, getSettings } from "@/lib/db/queries";
import { CONFIDENTIAL_NOTICE } from "@/lib/domain/taxonomy";
import ActionButton from "@/components/ActionButton";
import { PageHead } from "@/components/ui";
import { addAliasAction, classifyAction, deleteAliasAction, saveThresholdsAction, testKiprisAction, toggleAliasAction } from "../actions";

export default async function SettingsPage() {
  const [aliases, s] = await Promise.all([getAliases(), getSettings()]);
  const tentative = s.ipcSupplementary.some((i) => i.tentative);

  return (
    <>
      <PageHead crumb="HOME › 설정" title="설정">
        <ActionButton action={testKiprisAction} label="KIPRIS 연결 테스트" busyLabel="확인 중…" variant="ghost" />
        <ActionButton action={classifyAction} label="미분류 건 일괄 분류" busyLabel="분류 중…" variant="ghost" />
      </PageHead>

      <div className="notice warn">{CONFIDENTIAL_NOTICE}</div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head">
          <span>출원인 별칭 (검색식)</span>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>별칭</th>
              <th>직전 수집 건수</th>
              <th>사용</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {aliases.map((a) => (
              <tr key={a.id}>
                <td>{a.alias}</td>
                <td>{a.lastHitCount ?? "-"}</td>
                <td>
                  <form action={toggleAliasAction.bind(null, a.id, !a.active)}>
                    <button className={`btn sm ${a.active ? "" : "ghost"}`} type="submit">
                      {a.active ? "사용 중" : "중지됨"}
                    </button>
                  </form>
                </td>
                <td>
                  <form action={deleteAliasAction.bind(null, a.id)}>
                    <button className="btn sm danger" type="submit">
                      삭제
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={addAliasAction} className="card-body flex gap-2">
          <input name="alias" className="field" placeholder="새 별칭(출원인 표기 변형)" style={{ width: 320 }} />
          <button className="btn ghost" type="submit">
            추가
          </button>
        </form>
        <div className="card-body muted" style={{ paddingTop: 0 }}>
          표기 변형마다 검색 결과 건수가 달라집니다. 별칭별 건수 차이를 보며 검색식을 설계하세요.
        </div>
      </div>

      <form action={saveThresholdsAction} className="card">
        <div className="card-head">
          <span>보조 IPC · 위험도 임계값 · 수집 한도</span>
        </div>
        <div className="card-body flex flex-col gap-3" style={{ maxWidth: 560 }}>
          <label>
            <b>보조 IPC 목록</b> {tentative && <span className="badge b-amber">tentative(미확정)</span>}
            <textarea name="ipc" className="field" rows={4} defaultValue={s.ipcSupplementary.map((i) => i.code).join("\n")} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="tentative" defaultChecked={tentative} /> 확정 전(tentative)으로 표시
          </label>
          <div className="flex gap-4 flex-wrap">
            <label>
              <b>위험도 &apos;상&apos; 최대 구성요소 수</b>
              <br />
              <input name="highMaxElements" type="number" className="field" defaultValue={s.highMaxElements} min={1} max={20} />
            </label>
            <label>
              <b>ROWS</b>
              <br />
              <input name="rows" type="number" className="field" defaultValue={s.rows} min={10} max={100} />
            </label>
            <label>
              <b>MAX_PAGES</b>
              <br />
              <input name="maxPages" type="number" className="field" defaultValue={s.maxPages} min={1} max={50} />
            </label>
          </div>
          <div>
            <button className="btn" type="submit">
              저장 (위험도 재계산)
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
