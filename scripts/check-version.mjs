import { readFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const root = readJson("../package.json");
const api = readJson("../apps/api/package.json");
const web = readJson("../apps/web/package.json");
const metadata = readJson("../version.json");
const entries = { root: root.version, api: api.version, web: web.version, metadata: metadata.version };
const unique = new Set(Object.values(entries));
if (unique.size !== 1) {
  console.error("Version mismatch:", entries);
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+$/.test(root.version)) {
  console.error("Version must follow MAJOR.MINOR.PATCH:", root.version);
  process.exit(1);
}
console.log(`Version check passed: ${root.version}`);
