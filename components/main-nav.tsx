"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { VIEWER_BLOCK_CATEGORIES } from "@/lib/viewer-blocks"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"

const BLOCK_CATEGORY_HASH_PREFIX = "category-"

const blockNavLinks = VIEWER_BLOCK_CATEGORIES.map((category) => ({
  href: `/blocks#${BLOCK_CATEGORY_HASH_PREFIX}${category.id}`,
  label: category.label,
}))

export function MainNav({
  items,
  className,
  ...props
}: React.ComponentProps<"nav"> & {
  items: { href: string; label: string }[]
}) {
  const pathname = usePathname()

  return (
    <nav className={cn("items-center gap-0", className)} {...props}>
      <NavigationMenu viewport={false} className="max-w-none flex-none">
        <NavigationMenuList className="gap-0">
          {items.map((item) =>
            item.href === "/blocks" ? (
              <NavigationMenuItem key={item.href}>
                <NavigationMenuTrigger
                  data-active={pathname === item.href}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "h-8 gap-0 px-2.5 [&_svg]:hidden"
                  )}
                >
                  {item.label}
                </NavigationMenuTrigger>
                <NavigationMenuContent className="w-56 p-1.5">
                  <div className="grid gap-0.5">
                    {blockNavLinks.map((link) => (
                      <NavigationMenuLink
                        key={link.href}
                        asChild
                        active={
                          pathname === "/blocks" && link.href === "/blocks"
                        }
                        className="rounded-md px-2.5 py-2 text-sm"
                      >
                        <Link href={link.href}>{link.label}</Link>
                      </NavigationMenuLink>
                    ))}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
            ) : (
              <NavigationMenuItem key={item.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2.5"
                  render={
                    <Link
                      href={item.href}
                      data-active={pathname === item.href}
                      className="relative items-center"
                    />
                  }
                >
                  {item.label}
                </Button>
              </NavigationMenuItem>
            )
          )}
        </NavigationMenuList>
      </NavigationMenu>
    </nav>
  )
}
