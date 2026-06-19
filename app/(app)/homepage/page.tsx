import { type Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  PageActions,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header"

const title = "Homepage"
const description = "A focused entry point for Retab UI."

const links = [
  {
    href: "/docs",
    title: "Docs",
    description: "Core concepts, component contracts, and usage notes.",
  },
  {
    href: "/docs/components",
    title: "Components",
    description: "Document AI primitives for viewers, forms, and tables.",
  },
  {
    href: "/blocks",
    title: "Blocks",
    description: "Composed examples built from the Retab UI primitives.",
  },
]

export const dynamic = "force-static"
export const revalidate = false

export const metadata: Metadata = {
  title,
  description,
}

export default function HomepagePage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader>
        <PageHeaderHeading>{title}</PageHeaderHeading>
        <PageHeaderDescription>{description}</PageHeaderDescription>
        <PageActions>
          <Button size="sm" className="h-[31px] rounded-lg" asChild>
            <Link href="/docs/components">View components</Link>
          </Button>
          <Button size="sm" variant="ghost" className="rounded-lg" asChild>
            <Link href="/docs">Documentation</Link>
          </Button>
        </PageActions>
      </PageHeader>
      <div className="container-wrapper flex-1">
        <div className="container grid gap-4 py-8 md:grid-cols-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <h2 className="text-sm font-medium">{link.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {link.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
