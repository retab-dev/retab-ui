// Ambient shim for the `utif` package, which ships no type declarations
// (and has no @types/utif on npm). shadcn's registry build strips leading
// comments from source files, so an inline `@ts-expect-error` above the import
// does not survive into the published item — a real declaration is required for
// a fresh consumer install to typecheck. The decode workers cast the default
// export to their own local shapes, so an opaque `any` default is sufficient.
declare module "utif" {
   
  const UTIF: any;
  export default UTIF;
}
