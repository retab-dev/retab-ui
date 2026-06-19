import nextVitals from "eslint-config-next/core-web-vitals"
import tseslint from "typescript-eslint"

const directEffectMessage =
  "Do not call useEffect directly. Use useMountEffect or one of the Rule 1-5 replacements (see no-use-effect.md)."
const directLayoutEffectMessage =
  "Do not call useLayoutEffect directly. For ref mirrors use inline render-time assignment; for reactive side effects use <KeyedRunner>; for DOM text measurement use @chenglou/pretext. See no-use-effect.md."

const eslintConfig = tseslint.config(
  // Remove the @typescript-eslint plugin from next/typescript to prevent
  // duplicate registration with tseslint.configs.recommended.
  ...nextVitals.map((config) =>
    config.name === "next/typescript" ? { ...config, plugins: {} } : config
  ),
  ...tseslint.configs.recommended,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      ".claude/**",
      "reference/**",
      "next-env.d.ts",
      ".source/**",
      "**/__index__.tsx",
    ],
  },
  {
    rules: {
      "react-hooks/incompatible-library": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/set-state-in-effect": "off",
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "off",
      "no-var": "off",
      "react/no-children-prop": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='useEffect']",
          message: directEffectMessage,
        },
        {
          selector:
            "CallExpression[callee.object.name='React'][callee.property.name='useEffect']",
          message: directEffectMessage,
        },
        {
          selector: "CallExpression[callee.name='useLayoutEffect']",
          message: directLayoutEffectMessage,
        },
        {
          selector:
            "CallExpression[callee.object.name='React'][callee.property.name='useLayoutEffect']",
          message: directLayoutEffectMessage,
        },
      ],
    },
  }
)

export default eslintConfig
