export function isDueSoon(due: string, now = new Date(), days = 7): boolean {
  const dueDate = new Date(due);

  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }

  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = Date.UTC(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate(),
  );

  return Math.round((dueDay - today) / 86_400_000) <= days;
}
