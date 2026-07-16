const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const manifest = JSON.parse(read("package.json"));
const lockfile = JSON.parse(read("package-lock.json"));
const version = manifest.version;
const expectedLabel = `v${version}`;

const checks = [
  ["package-lock root version", lockfile.version === version],
  ["package-lock workspace version", lockfile.packages?.[""]?.version === version],
  ["runtime version", read("brams.js").includes(`const VERSION = "${version}";`)],
  ["catalog title", read("index.html").includes(`<title>Brams ${expectedLabel} — Komponenten-Katalog</title>`)],
  ["README heading", read("README.md").startsWith(`# Brams ${expectedLabel}\n`)],
  ["changelog release", read("CHANGELOG.md").includes(`## ${version} —`)],
];

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name);
if (failures.length) {
  console.error(`Release metadata mismatch for ${expectedLabel}: ${failures.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`Release metadata verified for ${expectedLabel}.`);
}
