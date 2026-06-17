"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"

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
          {items.map((item) => (
            <NavigationMenuItem key={item.href}>
              <Button
                variant="ghost"
                size="sm"
                className="px-2.5"
                asChild
              >
                <Link
                  href={item.href}
                  data-active={
                    item.href === "/blocks"
                      ? pathname.startsWith(item.href)
                      : pathname === item.href
                  }
                  className="relative items-center"
                >
                  {item.label}
                </Link>
              </Button>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    </nav>
  )
}
