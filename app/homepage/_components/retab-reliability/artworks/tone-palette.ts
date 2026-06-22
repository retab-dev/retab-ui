import type { CardTone } from "../types";

const COLOR_UTILITIES = [
  "from",
  "via",
  "to",
  "bg",
  "text",
  "border",
  "ring",
  "stroke",
  "fill",
  "shadow",
  "decoration",
  "outline",
  "placeholder",
] as const;

export const DEFAULT_TO_WARM_TAILWIND_FAMILY_MAP = {
  slate: "stone",
  gray: "stone",
  zinc: "stone",
  neutral: "stone",
  stone: "stone",
  red: "red",
  orange: "orange",
  amber: "amber",
  yellow: "amber",
  lime: "green",
  green: "emerald",
  emerald: "emerald",
  teal: "emerald",
  cyan: "sky",
  sky: "amber",
  blue: "orange",
  indigo: "indigo",
  violet: "violet",
  purple: "purple",
  fuchsia: "rose",
  pink: "rose",
  rose: "rose",
} as const;

export type TailwindColorFamily =
  keyof typeof DEFAULT_TO_WARM_TAILWIND_FAMILY_MAP;
export type TailwindWarmFamilyMap = Readonly<
  Record<TailwindColorFamily, string>
>;

type Primitive = string | number | boolean | null | undefined;
export type DeepPartial<T> = T extends Primitive
  ? T
  : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : { [K in keyof T]?: DeepPartial<T[K]> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const FAMILY_NAMES = Object.keys(
  DEFAULT_TO_WARM_TAILWIND_FAMILY_MAP,
) as TailwindColorFamily[];
const COLOR_CLASS_TOKEN_PATTERN = new RegExp(
  `^((?:[\\w-]+:)*)((?:${COLOR_UTILITIES.join("|")})-)(${FAMILY_NAMES.join("|")})(-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\\/\\d{1,3})?)$`,
);

export function convertTailwindClassNameToWarm(
  className: string,
  familyMap: TailwindWarmFamilyMap = DEFAULT_TO_WARM_TAILWIND_FAMILY_MAP,
): string {
  return className.replace(/\S+/g, (token) => {
    const match = token.match(COLOR_CLASS_TOKEN_PATTERN);
    if (!match) {
      return token;
    }
    const variants = match[1] ?? "";
    const utilityPrefix = match[2] ?? "";
    const family = (match[3] ?? "") as TailwindColorFamily;
    const shadeAndOpacity = match[4] ?? "";
    const mappedFamily = familyMap[family];
    if (!mappedFamily) {
      return token;
    }
    return `${variants}${utilityPrefix}${mappedFamily}${shadeAndOpacity}`;
  });
}

function deepMapStrings<T>(value: T, mapper: (input: string) => string): T {
  if (typeof value === "string") {
    return mapper(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepMapStrings(item, mapper)) as T;
  }
  if (isRecord(value)) {
    const mapped: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      mapped[key] = deepMapStrings(entry, mapper);
    }
    return mapped as T;
  }
  return value;
}

function mergeRecords(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };

  for (const [key, overrideValue] of Object.entries(overrides)) {
    if (overrideValue === undefined) {
      continue;
    }

    const baseValue = merged[key];
    if (isRecord(baseValue) && isRecord(overrideValue)) {
      merged[key] = mergeRecords(baseValue, overrideValue);
      continue;
    }

    merged[key] = overrideValue;
  }

  return merged;
}

function mergeDeep<T>(base: T, overrides?: DeepPartial<T>): T {
  if (overrides === undefined) {
    return base;
  }
  if (!isRecord(base) || !isRecord(overrides)) {
    return overrides as T;
  }

  return mergeRecords(base, overrides) as T;
}

export function convertDefaultPaletteToWarm<T>(
  defaultConfig: T,
  options?: {
    overrides?: DeepPartial<T>;
    familyMap?: TailwindWarmFamilyMap;
  },
): T {
  const converted = deepMapStrings(defaultConfig, (value) =>
    convertTailwindClassNameToWarm(
      value,
      options?.familyMap ?? DEFAULT_TO_WARM_TAILWIND_FAMILY_MAP,
    ),
  );
  return mergeDeep(converted, options?.overrides);
}

export function buildTonePalette<T>(
  defaultConfig: T,
  warmOverrides?: DeepPartial<T>,
  familyMap?: TailwindWarmFamilyMap,
): Record<CardTone, T> {
  return {
    default: defaultConfig,
    warm: convertDefaultPaletteToWarm(defaultConfig, {
      overrides: warmOverrides,
      familyMap,
    }),
  };
}
