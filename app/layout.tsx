import type { Metadata } from "next";
import { DISCLAIMER } from "@/lib/domain/taxonomy";
import "./globals.css";

export const metadata: Metadata = {
  title: "GTT 특허 모니터",
  description: "GTT 한국 특허 분석·모니터링 (1차 기술 검토용 데모)",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <div className="flex flex-col flex-1">{children}</div>
        <footer className="footer-note">{DISCLAIMER}</footer>
      </body>
    </html>
  );
}
