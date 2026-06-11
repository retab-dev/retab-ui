import { type Components } from "react-markdown"

export const markdownComponents: Components = {
  h1: (props) => (
    <h1
      className="mt-4 mb-2 text-[1.285em] font-semibold first:mt-0"
      {...props}
    />
  ),
  h2: (props) => (
    <h2
      className="mt-4 mb-2 text-[1.14em] font-semibold first:mt-0"
      {...props}
    />
  ),
  h3: (props) => (
    <h3
      className="mt-3 mb-1.5 text-[1em] font-semibold first:mt-0"
      {...props}
    />
  ),
  h4: (props) => (
    <h4 className="mt-3 mb-1.5 text-[1em] font-medium first:mt-0" {...props} />
  ),
  p: (props) => <p className="my-2 leading-relaxed" {...props} />,
  ul: (props) => <ul className="my-2 ml-5 list-disc space-y-1" {...props} />,
  ol: (props) => <ol className="my-2 ml-5 list-decimal space-y-1" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  a: (props) => (
    <a
      className="font-medium text-primary underline underline-offset-2"
      {...props}
    />
  ),
  strong: (props) => <strong className="font-semibold" {...props} />,
  hr: (props) => <hr className="my-4 border-border" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="my-3 border-l-2 border-border pl-3 text-muted-foreground italic"
      {...props}
    />
  ),
  code: (props) => (
    <code
      className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="my-3 overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-[0.85em]"
      {...props}
    />
  ),
  table: (props) => (
    <div className="my-3 overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-[0.85em]" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-muted/60" {...props} />,
  th: (props) => (
    <th
      className="border-b border-border px-3 py-1.5 text-left font-medium [&[align=right]]:text-right"
      {...props}
    />
  ),
  td: (props) => (
    <td
      className="border-b border-border px-3 py-1.5 tabular-nums [&[align=right]]:text-right"
      {...props}
    />
  ),
}
