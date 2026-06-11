import { type Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  PageActions,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header"
import { HomeShowcase } from "./showcase"

const title = "The Foundation for your Document Workflows"
const description =
  "Lightweight, virtualized React viewers for documents and structured data. Fast by default, built for scale, copy and paste into your apps."

export const dynamic = "force-static"
export const revalidate = false

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    images: [
      {
        url: `/og?title=${encodeURIComponent(
          title
        )}&description=${encodeURIComponent(description)}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      {
        url: `/og?title=${encodeURIComponent(
          title
        )}&description=${encodeURIComponent(description)}`,
      },
    ],
  },
}

export default function IndexPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader>
        <svg
          viewBox="0 0 210 216"
          role="img"
          aria-label="Retab"
          className="mb-1 h-8 w-auto text-foreground"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect y="108" width="58" height="54" />
          <rect width="58" height="54" />
          <rect x="58" y="54" width="152" height="54" />
          <rect x="58" y="162" width="152" height="54" />
        </svg>
        <PageHeaderHeading className="mt-2 max-w-none sm:mt-3 lg:text-nowrap">
          {title}
        </PageHeaderHeading>
        <PageHeaderDescription>{description}</PageHeaderDescription>
        <PageActions>
          <Button
            size="sm"
            className="h-[31px] rounded-lg"
            render={<Link href="/docs/components" />}
          >
            View components
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-lg"
            render={<Link href="/docs" />}
          >
            Documentation
          </Button>
        </PageActions>
      </PageHeader>
      <HomeShowcase />
    </div>
  )
}
