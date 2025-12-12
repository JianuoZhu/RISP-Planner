export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDateHuman(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", weekday: "short" });
}
