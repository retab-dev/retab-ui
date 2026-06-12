import { lruGet, lruSet } from "./viewer-lru-cache"

export interface Disposable {
  dispose(): void
}

export class DisposableLruCache<K, V extends Disposable> {
  private values = new Map<K, V>()

  constructor(private readonly limit: number) {}

  get size() {
    return this.values.size
  }

  get(key: K): V | undefined {
    return lruGet(this.values, key)
  }

  snapshotValues(): V[] {
    return [...this.values.values()]
  }

  set(key: K, value: V) {
    const existing = this.values.get(key)
    if (existing) existing.dispose()
    lruSet(
      this.values,
      key,
      value,
      (_droppedKey, droppedValue) => droppedValue.dispose(),
      this.limit
    )
  }

  delete(key: K) {
    const value = this.values.get(key)
    if (!value) return
    this.values.delete(key)
    value.dispose()
  }

  clear() {
    for (const value of this.values.values()) value.dispose()
    this.values.clear()
  }
}

export class PptxBitmapEntry implements Disposable {
  constructor(readonly bitmap: ImageBitmap) {}

  dispose() {
    this.bitmap.close()
  }
}
