export const DEFINITIONS_SECTION_ID = "schema-definitions-section";

const REVEAL_AFTER_RENDER_DELAY_MS = 0;
const HIGHLIGHT_DURATION_MS = 2500;

export function definitionElementId(definitionId: string) {
  return `schema-definition-${definitionId}`;
}

export function revealDefinitionElement(definitionId: string) {
  revealElementAfterRender(definitionElementId(definitionId));
}

export function revealDefinitionsSection() {
  revealElementAfterRender(DEFINITIONS_SECTION_ID);
}

function revealElementAfterRender(elementId: string) {
  window.setTimeout(() => {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("bg-accent");
    window.setTimeout(() => {
      element.classList.remove("bg-accent");
    }, HIGHLIGHT_DURATION_MS);
  }, REVEAL_AFTER_RENDER_DELAY_MS);
}
