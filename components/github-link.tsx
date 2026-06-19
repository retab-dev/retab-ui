import * as React from "react";
import Link from "next/link";

import { siteConfig } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";

const GITHUB_REPO = "retab-dev/ui";

export function GitHubLink() {
  return (
    <Button size="sm" variant="ghost" className="h-8 shadow-none" asChild>
      <Link
        href={siteConfig.links.github}
        target="_blank"
        rel="noreferrer"
        aria-label="View Retab UI on GitHub"
      >
        <Icons.gitHub />
        <React.Suspense fallback={<Skeleton className="h-4 w-[24px]" />}>
          <StarsCount />
        </React.Suspense>
      </Link>
    </Button>
  );
}

export async function StarsCount() {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
    headers: {
      Accept: "application/vnd.github+json",
    },
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    return <GitHubLabel />;
  }

  const json = (await response.json()) as {
    stargazers_count?: number;
  };

  if (typeof json.stargazers_count !== "number") {
    return <GitHubLabel />;
  }

  const formattedCount =
    json.stargazers_count >= 1000
      ? `${Math.round(json.stargazers_count / 1000)}k`
      : json.stargazers_count.toLocaleString();

  return (
    <span className="text-muted-foreground w-fit text-xs tabular-nums">
      {formattedCount}
    </span>
  );
}

function GitHubLabel() {
  return <span className="text-muted-foreground text-xs">GitHub</span>;
}
