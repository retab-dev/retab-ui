import { docs } from "@/.source"
import { loader } from "fumadocs-core/source"
// Sidebar order/inclusion comes from content/docs/**/meta.json.

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
})
