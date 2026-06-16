import type { source } from "@/lib/source"

export type PageTreeNode = (typeof source.pageTree)["children"][number]
export type PageTreeFolder = Extract<PageTreeNode, { type: "folder" }>
export type PageTreePage = Extract<PageTreeNode, { type: "page" }>
export type PageTreeFolderChild = PageTreeFolder["children"][number]
export type PageTreeSeparator = Extract<
  PageTreeFolderChild,
  { type: "separator" }
>
export type PageTreeSidebarGroup = {
  id: string
  name: PageTreeFolder["name"]
  /**
   * Optional link target for the group label itself. Set when a nested folder
   * exposes an index page whose title matches the group separator, so the label
   * doubles as a link instead of repeating the name as a child entry.
   */
  url?: string
  pages: PageTreePage[]
}

// Recursively find all pages in a folder tree.
export function getAllPagesFromFolder(folder: PageTreeFolder): PageTreePage[] {
  const pages: PageTreePage[] = []

  for (const child of folder.children) {
    if (child.type === "page") {
      pages.push(child)
    } else if (child.type === "folder") {
      pages.push(...getAllPagesFromFolder(child))
    }
  }

  return pages
}

// Get the pages from a folder, handling nested base folders (radix/base).
export function getPagesFromFolder(
  folder: PageTreeFolder,
  currentBase: string
): PageTreePage[] {
  // For the components folder, find the base subfolder.
  if (folder.$id === "components" || folder.name === "Components") {
    for (const child of folder.children) {
      if (child.type === "folder") {
        // Match by $id or by name.
        const isRadix = child.$id === "radix" || child.name === "Radix UI"
        const isBase = child.$id === "base" || child.name === "Base UI"

        if (
          (currentBase === "radix" && isRadix) ||
          (currentBase === "base" && isBase)
        ) {
          return child.children.filter(
            (c): c is PageTreePage => c.type === "page"
          )
        }
      }
    }

    // Fallback: include nested component pages so the components index can act
    // as the complete jump list, including PDF Viewer subpages.
    return getAllPagesFromFolder(folder).filter(
      (page) => !page.url.endsWith("/components")
    )
  }

  // For other folders, return direct page children. Nested component categories
  // such as File Viewer need their index page listed beside their anatomy and
  // renderer pages.
  const directPages = folder.children.filter(
    (child): child is PageTreePage =>
      child.type === "page" && !child.url.endsWith("/components")
  )

  return directPages
}

export function getSidebarGroupsFromFolder(
  folder: PageTreeFolder,
  currentBase: string
): PageTreeSidebarGroup[] {
  if (folder.$id !== "components" && folder.name !== "Components") {
    return [
      {
        id: folder.$id ?? String(folder.name),
        name: folder.name,
        pages: getPagesFromFolder(folder, currentBase),
      },
    ]
  }

  const groups: PageTreeSidebarGroup[] = [
    {
      id: folder.$id ?? String(folder.name),
      name: folder.name,
      pages: [],
    },
  ]

  for (const child of folder.children) {
    if (child.type === "separator") {
      groups.push({
        id: child.$id ?? `${folder.$id ?? "components"}-${groups.length}`,
        name: child.name ?? folder.name,
        pages: [],
      })
      continue
    }

    if (child.type === "page" && !child.url.endsWith("/components")) {
      groups[groups.length - 1]?.pages.push(child)
      continue
    }

    if (child.type === "folder") {
      const currentGroup = groups[groups.length - 1]
      const folderPages = getPagesFromFolder(child, currentBase)
      // When the nested folder's index page shares the current separator's
      // name (e.g. the "File Viewer" separator + the file-viewer folder index),
      // promote it to the group label's link rather than listing it again as
      // the first child — otherwise "File Viewer" appears twice in a row.
      const indexPage = currentGroup
        ? folderPages.find((page) => page.name === currentGroup.name)
        : undefined
      if (currentGroup && indexPage) {
        currentGroup.url = indexPage.url
      }
      currentGroup?.pages.push(
        ...folderPages.filter((page) => page !== indexPage)
      )
    }
  }

  return groups.filter((group) => group.pages.length > 0)
}

export function getNestedPagesFromFolder(
  folder: PageTreeFolder,
  folderId: string
): PageTreePage[] {
  const nestedFolder = folder.children.find(
    (child): child is PageTreeFolder =>
      child.type === "folder" &&
      (child.$id === folderId ||
        child.$id?.endsWith(`/${folderId}`) ||
        (typeof child.name === "string" &&
          child.name.toLowerCase().replaceAll(" ", "-") === folderId) ||
        getAllPagesFromFolder(child).some((page) =>
          page.url.includes(`/components/${folderId}/`)
        ))
  )

  if (!nestedFolder) {
    return []
  }

  return getAllPagesFromFolder(nestedFolder).filter(
    (page) => !page.url.endsWith("/components")
  )
}

// Get current base (radix or base) from pathname.
export function getCurrentBase(pathname: string): string {
  const baseMatch = pathname.match(/\/docs\/components\/(radix|base)\//)
  return baseMatch ? baseMatch[1] : "radix" // Default to radix.
}
