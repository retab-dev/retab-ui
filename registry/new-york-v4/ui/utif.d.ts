// Ambient shim for the `utif` package, which ships no type declarations
// (and has no @types/utif on npm). The TIFF decode workers import the default
// export and immediately cast it to their own local `Utif` interface, so an
// opaque default is all that's needed to satisfy the compiler.
declare module "utif" {
  const UTIF: unknown
  export default UTIF
}
