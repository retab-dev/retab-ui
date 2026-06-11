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
    const value = this.values.get(key)
    if (value !== undefined) {
      this.values.delete(key)
      this.values.set(key, value)
    }
    return value
  }

  set(key: K, value: V) {
    const existing = this.values.get(key)
    if (existing) existing.dispose()
    this.values.delete(key)
    this.values.set(key, value)
    this.evict()
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

  private evict() {
    while (this.values.size > this.limit) {
      const oldest = this.values.keys().next().value as K | undefined
      if (oldest === undefined) break
      this.delete(oldest)
    }
  }
}

export class PptxBitmapEntry implements Disposable {
  constructor(readonly bitmap: ImageBitmap) {}

  dispose() {
    this.bitmap.close()
  }
}
