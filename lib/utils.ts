import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { siteConfig } from "@/lib/config"

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function absoluteUrl(path: string): string {
  return `${siteConfig.url}${path}`
}
