import type { HeaderDropSide } from "@/components/json-table/lib/header-drag-model";

export function clearHeaderDragClasses(element: HTMLElement) {
  element.classList.remove(
    "border-l-2",
    "border-r-2",
    "border-r-primary",
    "border-l-primary",
  );
}

export function applyHeaderDropClass(
  element: HTMLElement,
  dropSide: HeaderDropSide | undefined,
) {
  if (dropSide === "after") {
    element.classList.add("border-r-2", "border-r-primary");
  } else if (dropSide === "before") {
    element.classList.add("border-l-2", "border-l-primary");
  }
}

export function createHeaderDragPreview(label: string) {
  const dragImage = document.createElement("div");
  dragImage.textContent = label;
  dragImage.style.position = "absolute";
  dragImage.style.top = "-1000px";
  dragImage.style.left = "-1000px";
  dragImage.style.padding = "4px 8px";
  dragImage.style.backgroundColor = "var(--popover)";
  dragImage.style.color = "var(--popover-foreground)";
  dragImage.style.border = "1px solid var(--border)";
  dragImage.style.borderRadius = "var(--radius-sm)";
  dragImage.style.fontSize = "var(--text-xs)";
  dragImage.style.fontFamily = "var(--font-sans)";
  document.body.appendChild(dragImage);
  return dragImage;
}

export function scheduleHeaderDragPreviewRemoval(dragImage: HTMLElement) {
  setTimeout(() => {
    document.body.removeChild(dragImage);
  }, 0);
}
