"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSwitch, useI18n } from "./i18n";

export function SiteNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const links = [
    { href: "/", label: t.nav.rules },
    { href: "/skor", label: t.nav.scores },
  ];
  return (
    <div className="topbar">
      <nav className="site-nav" aria-label="Kingdom Builder">
        {links.map((l) => (
          <Link key={l.href} href={l.href} aria-current={pathname === l.href ? "page" : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>
      <LanguageSwitch />
    </div>
  );
}
