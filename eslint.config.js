import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**", ".claude/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/engine/src/**/*.ts", "packages/scenarios/src/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use the seeded Rng: the engine must be deterministic (spec §5)." },
      ],
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "No wall-clock time in the engine (spec §5)." },
        { name: "performance", message: "No wall-clock time in the engine (spec §5)." },
        { name: "crypto", message: "Use the seeded Rng: the engine must be deterministic (spec §5)." },
      ],
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.*"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "MemberExpression[property.name='scrollIntoView']", message: "scrollIntoView also scrolls the PitOS root (M1.6 F1). Set scrollTop on the scrolling element." },
      ],
    },
  },
);
