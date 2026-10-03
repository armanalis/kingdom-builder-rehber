"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LanguageSwitch, useI18n } from "./i18n";
import { leaveGroup, useGroupId, useGroupLabel } from "./session";

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
      <GroupSwitch />
    </div>
  );
}

/** Shows who is playing on this device; tapping it goes back to the player picker. */
function GroupSwitch() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const groupId = useGroupId();
  const label = useGroupLabel();
  if (!groupId) return null;
  return (
    <button
      type="button"
      className="group-switch"
      title={t.nav.changePlayers}
      onClick={() => {
        leaveGroup();
        if (pathname !== "/skor") router.push("/skor");
      }}
    >
      <span aria-hidden="true">👥</span>
      <span className="group-switch-names">{label}</span>
      <span className="group-switch-action">{t.nav.change}</span>
    </button>
  );
}
