"use client";

import { useSyncExternalStore } from "react";
import type { Player } from "@/lib/scoreboard";

// Which player group this device plays with (each phone chooses its own).
const ID_KEY = "kb-group";
const LABEL_KEY = "kb-group-label";

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const notify = () => listeners.forEach((l) => l());

/** Selected group id; `null` = none chosen yet, `undefined` = not known yet (server render). */
export function useGroupId(): string | null | undefined {
  return useSyncExternalStore(subscribe, () => localStorage.getItem(ID_KEY), () => undefined);
}

/** Player names of the selected group, e.g. "Ayşe · Mehmet". */
export function useGroupLabel(): string {
  return useSyncExternalStore(subscribe, () => localStorage.getItem(LABEL_KEY) ?? "", () => "");
}

export function selectGroup(group: { id: string; players: Player[] }) {
  localStorage.setItem(ID_KEY, group.id);
  localStorage.setItem(LABEL_KEY, group.players.map((p) => p.name).join(" · "));
  notify();
}

/** Picked on the player picker: select and start at the top of the page. */
export function chooseGroup(group: { id: string; players: Player[] }) {
  selectGroup(group);
  window.scrollTo(0, 0);
}

/** Back to the player picker. */
export function leaveGroup() {
  localStorage.removeItem(ID_KEY);
  localStorage.removeItem(LABEL_KEY);
  notify();
  window.scrollTo(0, 0);
}
