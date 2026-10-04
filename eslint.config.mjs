import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    ignores: ["components/input-control.tsx", "components/select-control.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='type'] > Literal[value=/^(checkbox|radio|range|file|hidden|color)$/]))",
          message: "文本输入必须复用 InputControl、SearchCombobox 或 IdentifierField，保持输入状态和字段反馈一致。",
        },
        { selector: "JSXOpeningElement[name.name='textarea']", message: "多行输入必须复用 TextareaControl，保持输入状态和字段反馈一致。" },
        { selector: "JSXOpeningElement[name.name='select']", message: "普通下拉必须复用 SelectControl。" },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    ".next-backend/**",
    "out/**",
    "build/**",
    ".local/**",
    "next-env.d.ts",
    "history/**",
    "prototypes/**",
  ]),
]);
