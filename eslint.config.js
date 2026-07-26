import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    // src-tauri is Rust; cargo clippy covers it.
    ignores: ["dist/**", "src-tauri/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // tsconfig.json covers src/ only, so these root files have no type info.
    // Lint them syntactically rather than reporting every value as untyped.
    files: ["eslint.config.js", "vite.config.ts"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  // Must stay last so it can turn off rules that conflict with Prettier.
  prettier,
);
