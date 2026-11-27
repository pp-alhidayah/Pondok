/** Utilitas murni untuk pilihan massal di tabel (tanpa state React / DOM). */

export function toggleSelected(selected: string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
}

export function toggleSelectAll(selected: string[], allIds: string[]): string[] {
  if (allIds.length === 0) return [];
  const semuaTerpilih = allIds.every((id) => selected.includes(id));
  if (semuaTerpilih) return [];
  return Array.from(new Set([...selected, ...allIds]));
}

export function selectedItems<T extends { id: string }>(items: T[], selected: string[]): T[] {
  const idSet = new Set(selected);
  return items.filter((item) => idSet.has(item.id));
}
