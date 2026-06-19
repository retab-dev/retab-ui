"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

import { type ThemeOption, type ThemeValue } from "./homepage-types"
import { focusRing } from "./primitives"

function isThemeValue(
  options: readonly ThemeOption[],
  value: string | undefined
): value is ThemeValue {
  return options.some((option) => option.value === value)
}

function ThemeIcon({ value }: { value: ThemeValue }) {
  if (value === "light") {
    return <Sun aria-hidden="true" className="size-3.5" />
  }

  if (value === "dark") {
    return <Moon aria-hidden="true" className="size-3.5" />
  }

  return <Monitor aria-hidden="true" className="size-3.5" />
}

export function FooterThemeSelector({
  options,
}: {
  options: readonly ThemeOption[]
}) {
  const [isMounted, setIsMounted] = useState(false)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const { setTheme, theme } = useTheme()
  const selectedTheme: ThemeValue =
    isMounted && isThemeValue(options, theme) ? theme : "system"

  useEffect(() => {
    setIsMounted(true)
  }, [])

  function onThemeKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    const lastIndex = options.length - 1
    let nextIndex: number | undefined

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = index === lastIndex ? 0 : index + 1
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = index === 0 ? lastIndex : index - 1
    } else if (event.key === "Home") {
      nextIndex = 0
    } else if (event.key === "End") {
      nextIndex = lastIndex
    }

    if (nextIndex === undefined) {
      return
    }

    event.preventDefault()
    setTheme(options[nextIndex].value)
    optionRefs.current[nextIndex]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label="Select a display theme"
      className="inline-flex h-6 overflow-hidden rounded-full border border-neutral-200 bg-white shadow-[0_1px_1px_rgba(0,0,0,0.03)]"
    >
      {options.map((option, index) => {
        const isSelected = selectedTheme === option.value

        return (
          <button
            key={option.value}
            ref={(element) => {
              optionRefs.current[index] = element
            }}
            type="button"
            role="radio"
            aria-label={option.label}
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            title={`${option.label} theme`}
            onClick={() => setTheme(option.value)}
            onKeyDown={(event) => onThemeKeyDown(event, index)}
            className={cn(
              "relative grid size-6 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-black focus-visible:z-10 motion-reduce:transition-none",
              focusRing,
              isSelected &&
                "bg-black text-white hover:bg-black hover:text-white"
            )}
          >
            <ThemeIcon value={option.value} />
          </button>
        )
      })}
    </div>
  )
}
