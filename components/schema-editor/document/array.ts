export function mapPreserve<T>(
  items: T[],
  fn: (item: T, index: number) => T,
): T[] {
  let changed = false;
  const next = items.map((item, index) => {
    const result = fn(item, index);
    if (result !== item) changed = true;
    return result;
  });
  return changed ? next : items;
}
