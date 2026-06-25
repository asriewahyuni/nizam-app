const { ESLint } = require("eslint");
(async function main() {
  const eslint = new ESLint({ overrideConfigFile: "eslint.config.mjs" });
  const results = await eslint.lintText("const x = db.from('journal_entries');");
  console.log(JSON.stringify(results, null, 2));
})();
