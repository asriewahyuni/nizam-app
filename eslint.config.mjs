import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const customRules = {
  files: ["**/*.ts", "**/*.tsx"],
  ignores: ["modules/accounting/**", "lib/erp-bridge/**", "modules/cash/**"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "CallExpression[callee.property.name='from'][arguments.0.value='journal_entries']",
        message: "🚨 SILO ALERT: Dilarang mengakses tabel journal_entries secara langsung. Wajib gunakan ERPBridge.recordRevenue() atau ERPBridge.recordExpense()."
      },
      {
        selector: "CallExpression[callee.property.name='from'][arguments.0.value='bank_transactions']",
        message: "🚨 SILO ALERT: Dilarang memodifikasi bank_transactions secara manual. Gunakan fungsi standar di modul cash/bank atau ERPBridge."
      },
      {
        selector: "CallExpression[callee.name='queryPostgres'] > TemplateLiteral[quasis.0.value.raw=/(?i)insert\\s+into\\s+public\\.journal_entries/]",
        message: "🚨 SILO ALERT: Dilarang menggunakan raw query untuk insert ke journal_entries. Gunakan ERPBridge."
      }
    ]
  }
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  customRules,
]);

export default eslintConfig;
