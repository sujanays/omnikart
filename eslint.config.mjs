import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * The wall. The store and the assistant may talk only through contract/ (types) and over HTTP.
 * A lint error here fails the build.
 *   store/**, app/(store)/**, app/api/store/**   may not import assistant/**
 *   assistant/**, app/judge/**, app/api/<assistant routes>/**   may not import store/**
 *   contract/**   imports neither
 * app/layout.tsx is the host page: the one place where both are mounted side by side.
 */
const wall = (files, blocked, message) => ({
  files,
  rules: {
    "no-restricted-imports": ["error", { patterns: [{ group: blocked, message }] }],
  },
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  wall(
    ["store/**/*.{ts,tsx}", "app/(store)/**/*.{ts,tsx}", "app/api/store/**/*.{ts,tsx}"],
    ["@/assistant/*", "@/assistant", "**/assistant/**"],
    "The store must never import the assistant. Talk through contract/ instead.",
  ),
  wall(
    ["assistant/**/*.{ts,tsx}", "app/judge/**/*.{ts,tsx}", "app/api/{agent,ask,asr,compose,health,mt,tts}/**/*.{ts,tsx}"],
    ["@/store/*", "@/store", "@/app/(store)/*", "**/store/**"],
    "The assistant must never import the store. Use the StoreAdapter from contract/ (HTTP) instead.",
  ),
  wall(["contract/**/*.{ts,tsx}"], ["@/store/*", "@/assistant/*", "**/store/**", "**/assistant/**"], "contract/ is types only."),
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
