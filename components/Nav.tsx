"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const MENU = [
  { href: "/", label: "대시보드" },
  { href: "/patents", label: "특허 목록" },
  { href: "/monitor", label: "모니터링" },
  { href: "/settings", label: "설정" },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

export function TopNav() {
  const path = usePathname();
  return (
    <>
      {MENU.map((m) => (
        <Link key={m.href} href={m.href} className="gnb-link" data-active={isActive(path, m.href)}>
          {m.label}
        </Link>
      ))}
    </>
  );
}

export function SideNav() {
  const path = usePathname();
  return (
    <nav className="lnb" aria-label="업무 메뉴">
      <div className="lnb-title">LNG 화물창 특허 분석</div>
      {MENU.map((m) => (
        <Link key={m.href} href={m.href} data-active={isActive(path, m.href)}>
          {m.label}
        </Link>
      ))}
    </nav>
  );
}
