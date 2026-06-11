"use client"

import * as React from "react"

// A failed parse updates the outer FileThumbnail state so it degrades to the
// shared fallback surface instead of an empty preview layer.
export class ThumbnailErrorBoundary extends React.Component<
  {
    children: React.ReactNode
    fallback: React.ReactNode
    onError: () => void
  },
  { failed: boolean }
> {
  constructor(props: {
    children: React.ReactNode
    fallback: React.ReactNode
    onError: () => void
  }) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
}
