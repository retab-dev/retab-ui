import { getPagesFromFolder, type PageTreeFolder } from "@/lib/page-tree"
import { source } from "@/lib/source"
import { absoluteUrl } from "@/lib/utils"

export function replaceComponentsList(content: string) {
  const componentsFolder = source.pageTree.children.find(
    (page) => page.$id === "components"
  )

  const list =
    componentsFolder?.type === "folder"
      ? getPagesFromFolder(componentsFolder as PageTreeFolder, "radix")
          .map((component) => {
            const slug = component.url.replace(/^\/docs\//, "").split("/")
            const description = source.getPage(slug)?.data.description?.trim()
            const url = absoluteUrl(component.url)

            return `- [${component.name}](${url})${
              description ? `: ${description}` : ""
            }`
          })
          .join("\n")
      : ""

  return content.replace(/<ComponentsList\s*\/>/g, list)
}

export function processMdxForLLMs(content: string) {
  return replaceComponentsList(content)
}
