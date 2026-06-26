// Core of syncing obsidian-zen settings into an Obsidian vault.
// Safe by design: deep-merge JSON (profile values win, foreign keys are kept),
// plugins are a union (nothing gets disabled), folders are copied without deleting extras,
// workspace.json and notes are left untouched, a backup is made before any change.
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFileSync } from "node:child_process";

const NEVER_TOUCH = new Set(["workspace.json", "workspace-mobile.json"]);

const isDir = (p) => fs.existsSync(p) && fs.statSync(p).isDirectory();
const isLink = (p) => {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};
const isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

// objects are merged recursively; arrays and scalars from src replace dst
function deepMerge(a, b) {
  if (!isPlainObject(a) || !isPlainObject(b)) return b;
  const out = { ...a };
  for (const k of Object.keys(b)) {
    out[k] = isPlainObject(a[k]) && isPlainObject(b[k]) ? deepMerge(a[k], b[k]) : b[k];
  }
  return out;
}

// A normalized id for a key binding so the same combo compares equal regardless of
// modifier order or letter case: "ctrl,mod|p".
function comboId(b) {
  const mods = [...(b.modifiers || [])].sort().join(",");
  return `${mods}|${String(b.key || "").toLowerCase()}`;
}

// hotkeys.json maps a command id -> array of { modifiers, key } bindings. A plain
// deep-merge lets the profile win per command, but it can't see that a combo the
// profile claims may still be bound to a *foreign* command in the vault -> Obsidian
// would then flag a conflict. So after merging we strip every profile-claimed combo
// from the commands the profile doesn't define.
function mergeHotkeys(cur, src) {
  const merged = deepMerge(cur, src);
  const claimed = new Set();
  for (const id of Object.keys(src)) for (const b of src[id] || []) claimed.add(comboId(b));

  for (const id of Object.keys(merged)) {
    if (id in src) continue; // profile-owned commands keep their bindings verbatim
    merged[id] = (merged[id] || []).filter((b) => !claimed.has(comboId(b)));
  }
  return merged;
}

function copyDirInto(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDirInto(s, d);
    else fs.copyFileSync(s, d);
  }
}

const log = (...m) => console.log(...m);

// Resolves the profile source folder: a local path, or a git clone into a temp folder.
function resolveSource(from) {
  if (isDir(from)) return { dir: path.resolve(from), cleanup: () => {} };
  let url = from;
  if (/^[\w.-]+\/[\w.-]+$/.test(from)) url = `https://github.com/${from}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "obsidian-zen-"));
  log(`[fetch] git clone ${url}`);
  execFileSync("git", ["clone", "--depth", "1", "--quiet", url, tmp], { stdio: "inherit" });
  return { dir: tmp, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}

// Installs the obsidian-zen plugin straight from the repo root and enables it (no BRAT).
function installPlugin(repoDir, vaultObs, dry) {
  const manifestPath = path.join(repoDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return;
  const id = readJson(manifestPath).id;
  if (!id) return;

  const destDir = path.join(vaultObs, "plugins", id);
  log(`[plugin] ${id} -> .obsidian/plugins/${id}/`);
  // A dev setup may symlink the plugin folder straight at the source repo (live
  // editing). copyFileSync would then write *through* the link and clobber the
  // repo's own files. Drop the symlink first so we copy into a fresh real folder.
  if (isLink(destDir)) {
    log(`[unlink] .obsidian/plugins/${id} is a symlink -> replacing with a real copy`);
    if (!dry) fs.unlinkSync(destDir);
  }
  if (!dry) {
    fs.mkdirSync(destDir, { recursive: true });
    for (const f of ["manifest.json", "main.js", "styles.css"]) {
      const s = path.join(repoDir, f);
      if (fs.existsSync(s)) fs.copyFileSync(s, path.join(destDir, f));
    }
  }

  const cpPath = path.join(vaultObs, "community-plugins.json");
  const cur = fs.existsSync(cpPath) ? readJson(cpPath) : [];
  if (!cur.includes(id)) {
    log(`[enable] community-plugins += ${id}`);
    if (!dry) writeJson(cpPath, [...cur, id]);
  }
}

// Obsidian downloads a community theme's manifest.json + theme.css from the theme
// repo's latest GitHub release. We replicate that so `cssTheme` actually resolves:
// without the files in .obsidian/themes/<name>/ Obsidian silently drops the setting.
const THEMES_REGISTRY =
  "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/HEAD/community-css-themes.json";

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// Looks up a theme's GitHub repo ("owner/name") by its display name in the registry.
async function resolveThemeRepo(name) {
  const list = JSON.parse(await fetchText(THEMES_REGISTRY));
  const hit = list.find((t) => t.name === name);
  return hit ? hit.repo : null;
}

// Downloads the latest release of a community theme into .obsidian/themes/<name>/.
// The folder name must equal the theme's manifest name, which is what cssTheme points at.
async function installTheme(vaultObs, name, dry) {
  if (!name) return;

  let repo;
  try {
    repo = await resolveThemeRepo(name);
  } catch (err) {
    log(`[theme] skip "${name}": cannot read themes registry (${err.message})`);
    return;
  }
  if (!repo) {
    log(`[theme] skip: "${name}" is not in the community themes registry`);
    return;
  }

  const base = `https://github.com/${repo}/releases/latest/download`;
  log(`[theme] ${name} <- ${repo} (latest release)`);
  if (dry) return;

  let manifest, css;
  try {
    [manifest, css] = await Promise.all([
      fetchText(`${base}/manifest.json`),
      fetchText(`${base}/theme.css`),
    ]);
  } catch (err) {
    log(`[theme] skip "${name}": download failed (${err.message})`);
    return;
  }

  const destDir = path.join(vaultObs, "themes", name);
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, "manifest.json"), manifest);
  fs.writeFileSync(path.join(destDir, "theme.css"), css);
}

// Applies the contents of settings/: *.json -> merge (or union for community-plugins), folders -> copy.
function applySettings(settingsDir, vaultObs, dry) {
  for (const e of fs.readdirSync(settingsDir, { withFileTypes: true })) {
    const name = e.name;
    if (NEVER_TOUCH.has(name)) continue;
    const srcPath = path.join(settingsDir, name);
    const destPath = path.join(vaultObs, name);

    if (e.isDirectory()) {
      log(`[sync] ${name}/`);
      if (!dry) copyDirInto(srcPath, destPath);
    } else if (name === "community-plugins.json") {
      const cur = fs.existsSync(destPath) ? readJson(destPath) : [];
      const next = Array.from(new Set([...cur, ...readJson(srcPath)]));
      log(`[union] ${name}`);
      if (!dry) writeJson(destPath, next);
    } else if (name === "hotkeys.json") {
      const cur = fs.existsSync(destPath) ? readJson(destPath) : {};
      const next = mergeHotkeys(cur, readJson(srcPath));
      log(`[hotkeys] ${name}`);
      if (!dry) writeJson(destPath, next);
    } else if (name.endsWith(".json")) {
      const cur = fs.existsSync(destPath) ? readJson(destPath) : {};
      const next = deepMerge(cur, readJson(srcPath));
      log(`[merge] ${name}`);
      if (!dry) writeJson(destPath, next);
    }
  }
}

/**
 * @param {{ vault: string, from: string, dry: boolean }} opts
 */
export async function sync(opts) {
  const vaultObs = path.join(opts.vault, ".obsidian");
  if (!isDir(vaultObs)) {
    throw new Error(`Doesn't look like a vault: ${vaultObs} is missing. Open it in Obsidian at least once.`);
  }

  const src = resolveSource(opts.from);
  try {
    const settingsDir = path.join(src.dir, "settings");
    if (!isDir(settingsDir)) throw new Error(`The source has no settings/: ${src.dir}`);

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const bak = path.join(opts.vault, `.obsidian.bak-${stamp}`);
    log(`[backup] ${bak}`);
    if (!opts.dry) fs.cpSync(vaultObs, bak, { recursive: true });

    installPlugin(src.dir, vaultObs, opts.dry);

    // install the community theme the profile asks for, so cssTheme actually applies
    let themeName = null;
    const appearancePath = path.join(settingsDir, "appearance.json");
    if (fs.existsSync(appearancePath)) {
      try {
        themeName = readJson(appearancePath).cssTheme || null;
      } catch {
        // malformed appearance.json: applySettings will surface it; just skip the theme
      }
    }
    await installTheme(vaultObs, themeName, opts.dry);

    applySettings(settingsDir, vaultObs, opts.dry);

    log("");
    log(
      opts.dry
        ? "Dry-run: nothing was changed."
        : `Done. Backup: ${bak}\nIn the target vault press Cmd+R, then enable the Zen Mode plugin.`,
    );
  } finally {
    src.cleanup();
  }
}
