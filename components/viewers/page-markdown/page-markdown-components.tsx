import { type Components } from "react-markdown";

export const markdownComponents: Components = {
  h1: ({ node: _node, ...props }) => (
    <h1
      className="mt-4 mb-2 text-[1.285em] font-semibold first:mt-0"
      {...props}
    />
  ),
  h2: ({ node: _node, ...props }) => (
    <h2
      className="mt-4 mb-2 text-[1.14em] font-semibold first:mt-0"
      {...props}
    />
  ),
  h3: ({ node: _node, ...props }) => (
    <h3
      className="mt-3 mb-1.5 text-[1em] font-semibold first:mt-0"
      {...props}
    />
  ),
  h4: ({ node: _node, ...props }) => (
    <h4 className="mt-3 mb-1.5 text-[1em] font-medium first:mt-0" {...props} />
  ),
  p: ({ node: _node, ...props }) => (
    <p className="my-2 leading-relaxed" {...props} />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul className="my-2 ml-5 list-disc space-y-1" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="my-2 ml-5 list-decimal space-y-1" {...props} />
  ),
  li: ({ node: _node, ...props }) => (
    <li className="leading-relaxed" {...props} />
  ),
  a: ({ node: _node, href, children, ...props }) =>
    href ? (
      <a
        className="text-primary font-medium underline underline-offset-2"
        {...props}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  img: ({ node: _node, src, alt, ...props }) =>
    src ? <img {...props} src={src} alt={alt} /> : <span>{alt}</span>,
  strong: ({ node: _node, ...props }) => (
    <strong className="font-semibold" {...props} />
  ),
  hr: ({ node: _node, ...props }) => (
    <hr className="border-border my-4" {...props} />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="border-border text-muted-foreground my-3 border-l-2 pl-3 italic"
      {...props}
    />
  ),
  code: ({ node: _node, ...props }) => (
    <code
      className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]"
      {...props}
    />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre
      className="bg-muted/50 my-3 overflow-x-auto rounded-lg border p-3 font-mono text-[0.85em]"
      {...props}
    />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="my-3 overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-[0.85em]" {...props} />
    </div>
  ),
  thead: ({ node: _node, ...props }) => (
    <thead className="bg-muted/60" {...props} />
  ),
  th: ({ node: _node, ...props }) => (
    <th
      className="border-border border-b px-3 py-1.5 text-left font-medium [&[align=right]]:text-right"
      {...props}
    />
  ),
  td: ({ node: _node, ...props }) => (
    <td
      className="border-border border-b px-3 py-1.5 tabular-nums [&[align=right]]:text-right"
      {...props}
    />
  ),
};
