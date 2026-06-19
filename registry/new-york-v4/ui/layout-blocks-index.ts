import type {
  LayoutItem,
  LayoutLevel,
  LayoutPage,
} from "./layout-blocks-types";

export type LayoutItemIndex = {
  itemsById: Map<string, LayoutItem>;
  itemsByPage: Map<number, LayoutItem[]>;
  itemsByLevel: Map<LayoutLevel, LayoutItem[]>;
  pagesByNumber: Map<number, LayoutPage>;
};

export function createLayoutItemIndex({
  items,
  pages,
}: {
  items: LayoutItem[];
  pages: LayoutPage[];
}): LayoutItemIndex {
  const itemsById = new Map<string, LayoutItem>();
  const itemsByPage = new Map<number, LayoutItem[]>();
  const itemsByLevel = new Map<LayoutLevel, LayoutItem[]>();
  const pagesByNumber = new Map<number, LayoutPage>();

  for (const page of pages) {
    pagesByNumber.set(page.pageNumber, page);
  }

  for (const item of items) {
    itemsById.set(item.id, item);
    appendMapValue(itemsByPage, item.pageNumber, item);
    appendMapValue(itemsByLevel, item.level, item);
  }

  return {
    itemsById,
    itemsByPage,
    itemsByLevel,
    pagesByNumber,
  };
}

function appendMapValue<Key, Value>(
  map: Map<Key, Value[]>,
  key: Key,
  value: Value,
) {
  const values = map.get(key);
  if (values) {
    values.push(value);
    return;
  }
  map.set(key, [value]);
}

export function getLayoutItemsForPage({
  index,
  pageNumber,
  levels,
}: {
  index: LayoutItemIndex;
  pageNumber: number;
  levels?: readonly LayoutLevel[];
}) {
  const pageItems = index.itemsByPage.get(pageNumber) ?? [];
  if (!levels?.length) return pageItems;
  const levelSet = new Set(levels);
  return pageItems.filter((item) => levelSet.has(item.level));
}
