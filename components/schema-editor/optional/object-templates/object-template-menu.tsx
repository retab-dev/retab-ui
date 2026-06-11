import { getTemplateIcon } from "@/components/schema-editor/type-icons"
import {
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui-retab/dropdown-menu"
import { Shapes } from "lucide-react"

import { templateObjects } from "./template-objects"

export function ObjectTemplateSubmenu({
  onSelectTemplate,
}: {
  onSelectTemplate: (name: string) => void
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Shapes className="mr-4 h-4 w-4" />
        object template
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          {Object.entries(templateObjects).map(([name]) => (
            <DropdownMenuItem
              key={name}
              className="flex items-center gap-2"
              onSelect={() => onSelectTemplate(name)}
            >
              {getTemplateIcon(name)}
              {name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  )
}
