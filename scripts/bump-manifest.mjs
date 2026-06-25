#!/usr/bin/env node
// Stamps the version produced by semantic-release into manifest.json so the
// Obsidian plugin manifest, package.json and the git tag always share one
// version. Invoked from the @semantic-release/exec prepareCmd:
//   node scripts/bump-manifest.mjs ${nextRelease.version}
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!version) {
  console.error("Usage: node scripts/bump-manifest.mjs <version>");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "manifest.json");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.version = version;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`[bump-manifest] manifest.json version -> ${version}`);
