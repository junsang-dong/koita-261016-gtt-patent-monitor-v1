"use client";

import { useState, useTransition } from "react";

export type ActionResult = { ok: boolean; message: string };

/** 서버 액션을 버튼 하나로 실행하고 결과 메시지를 바로 보여준다 (비개발자 시연용). */
export default function ActionButton({
  action,
  label,
  busyLabel = "실행 중…",
  variant = "primary",
  size = "md",
  confirmText,
}: {
  action: () => Promise<ActionResult>;
  label: string;
  busyLabel?: string;
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
  confirmText?: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        className={`btn ${variant === "primary" ? "" : variant} ${size === "sm" ? "sm" : ""}`}
        disabled={pending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          setResult(null);
          start(async () => {
            try {
              setResult(await action());
            } catch (e) {
              setResult({ ok: false, message: e instanceof Error ? e.message : "실행 중 오류가 발생했습니다." });
            }
          });
        }}
      >
        {pending ? busyLabel : label}
      </button>
      {result && (
        <span style={{ fontSize: 12, color: result.ok ? "var(--green)" : "var(--red)", maxWidth: 420 }}>{result.message}</span>
      )}
    </span>
  );
}
