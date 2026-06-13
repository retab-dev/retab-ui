export const dataCellDisplayClass =
  "relative inline-flex w-full rounded-lg bg-transparent text-base text-foreground ring-ring/24 transition-shadow sm:text-sm"

export const dataCellDisplayValueClass =
  "flex h-8.5 w-full min-w-0 items-center rounded-[inherit] px-3 leading-8.5 sm:h-7.5 sm:leading-7.5"

export const dataCellPickerTriggerClass =
  "relative inline-flex h-8.5 w-full min-w-0 shrink-0 cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-lg bg-transparent px-3 text-base font-normal whitespace-nowrap text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 sm:h-7.5 sm:text-sm pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0 [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4"

export const dataCellBooleanDisplayClass =
  "flex h-8 w-full min-w-0 items-center overflow-hidden rounded-lg bg-transparent px-3 text-sm text-foreground ring-ring/24 transition-shadow"

export const dataCellCheckboxDisplayClass =
  "peer bg-transparent data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 size-4 shrink-0 rounded-[4px] transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
