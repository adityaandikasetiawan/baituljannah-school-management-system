import { readFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const readText = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const root = readJson("../package.json");
const api = readJson("../apps/api/package.json");
const web = readJson("../apps/web/package.json");
const metadata = readJson("../version.json");
const apiSource = readText("../apps/api/src/version.ts");
const webSource = readText("../apps/web/src/version.ts");
const sourceVersion = (source) => source.match(/APP_VERSION\s*=\s*"([^"]+)"/)?.[1];
const entries = {
  root: root.version,
  api: api.version,
  web: web.version,
  metadata: metadata.version,
  apiSource: sourceVersion(apiSource),
  webSource: sourceVersion(webSource),
};
const unique = new Set(Object.values(entries));
if (unique.size !== 1 || Object.values(entries).some((value) => !value)) {
  console.error("Version mismatch:", entries);
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+$/.test(root.version)) {
  console.error("Version must follow MAJOR.MINOR.PATCH:", root.version);
  process.exit(1);
}
console.log(`Version check passed: ${root.version}`);
