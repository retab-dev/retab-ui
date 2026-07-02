"use client";

export function shouldCloseFileViewerSidebarOnEscape({
  canToggleSidebar,
  event,
  isSidebarInteractive,
}: {
  canToggleSidebar: boolean;
  event: KeyboardEvent;
  isSidebarInteractive: boolean;
}) {
  return (
    canToggleSidebar &&
    isSidebarInteractive &&
    event.key === "Escape" &&
    !event.defaultPrevented &&
    !event.repeat
  );
}

export function isFileViewerActiveElementInsideShell({
  activeElement,
  viewerShellElement,
}: {
  activeElement: Element | null;
  viewerShellElement: HTMLElement | null;
}) {
  return Boolean(
    activeElement &&
      viewerShellElement &&
      viewerShellElement.contains(activeElement),
  );
}
