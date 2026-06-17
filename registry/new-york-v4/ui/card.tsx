import * as React from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "relative flex flex-col rounded-2xl border bg-card text-card-foreground shadow-xs/5 not-dark:bg-clip-padding before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
        className
      )}
      {...props}
    />
  )
}

function CardFrame({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-frame"
      className={cn(
        "relative flex flex-col rounded-2xl border bg-card text-card-foreground shadow-xs/5 [--clip-bottom:-1rem] [--clip-top:-1rem] not-dark:bg-clip-padding before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:bg-muted/72 before:shadow-[0_1px_--theme(--color-black/4%)] has-data-[slot=table-container]:overflow-hidden *:data-[slot=card]:-m-px *:data-[slot=card]:bg-clip-padding *:data-[slot=card]:shadow-none *:data-[slot=card]:[clip-path:inset(var(--clip-top)_1px_var(--clip-bottom)_1px_round_calc(var(--radius-2xl)-1px))] *:not-first:data-[slot=card]:rounded-t-xl *:not-last:data-[slot=card]:rounded-b-xl *:data-[slot=card]:before:hidden *:not-first:data-[slot=card]:before:rounded-t-[calc(var(--radius-xl)-1px)] *:not-last:data-[slot=card]:before:rounded-b-[calc(var(--radius-xl)-1px)] *:data-[slot=card]:first:[--clip-top:1px] *:data-[slot=card]:last:[--clip-bottom:1px] *:data-[slot=table-container]:-m-px *:data-[slot=table-container]:w-[calc(100%+2px)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
        className
      )}
      {...props}
    />
  )
}

function CardFrameHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-frame-header"
      className={cn(
        "relative flex grid auto-rows-min grid-rows-[auto_auto] flex-col items-start gap-x-4 px-6 py-4 has-data-[slot=card-frame-action]:grid-cols-[1fr_auto]",
        className
      )}
      {...props}
    />
  )
}

function CardFrameTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-frame-title"
      className={cn("self-center text-sm font-semibold", className)}
      {...props}
    />
  )
}

function CardFrameDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-frame-description"
      className={cn("self-center text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardFrameAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-frame-action"
      className={cn(
        "col-start-2 inline-flex self-center justify-self-end nth-3:row-span-2 nth-3:row-start-1",
        className
      )}
      {...props}
    />
  )
}

function CardFrameFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-frame-footer"
      className={cn("px-6 py-4", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 p-6 in-[[data-slot=card]:has(>[data-slot=card-panel])]:pb-4 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 inline-flex self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardPanel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-panel"
      className={cn(
        "flex-1 p-6 in-[[data-slot=card]:has(>[data-slot=card-footer]:not(.border-t))]:pb-0 in-[[data-slot=card]:has(>[data-slot=card-header]:not(.border-b))]:pt-0",
        className
      )}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center p-6 in-[[data-slot=card]:has(>[data-slot=card-panel])]:pt-4",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardFrame,
  CardFrameHeader,
  CardFrameTitle,
  CardFrameDescription,
  CardFrameAction,
  CardFrameFooter,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardPanel,
  CardFooter,
  CardPanel as CardContent,
}
