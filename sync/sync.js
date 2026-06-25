// Ядро синка настроек obsidian-zen в Obsidian-ваулт.
// Безопасно: deep-merge JSON (значения профиля поверх, чужие ключи сохраняются),
// плагины — union (ничего не отключаем), папки копируются без удаления лишнего,
// workspace.json и заметки не трогаются, перед изменениями делается бэкап.
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFileSync } from "node:child_process";

const NEVER_TOUCH = new Set(["workspace.json", "workspace-mobile.json"]);

const isDir = (p) => fs.existsSync(p) && fs.statSync(p).isDirectory();
const isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

// объекты сливаются рекурсивно; массивы и скаляры из src заменяют dst
function deepMerge(a, b) {
  if (!isPlainObject(a) || !isPlainObject(b)) return b;
  const out = { ...a };
  for (const k of Object.keys(b)) {
    out[k] = isPlainObject(a[k]) && isPlainObject(b[k]) ? deepMerge(a[k], b[k]) : b[k];
  }
  return out;
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

// Достаёт папку с исходниками профиля: локальный путь или git clone во временную папку.
function resolveSource(from) {
  if (isDir(from)) return { dir: path.resolve(from), cleanup: () => {} };
  let url = from;
  if (/^[\w.-]+\/[\w.-]+$/.test(from)) url = `https://github.com/${from}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "obsidian-zen-"));
  log(`[fetch] git clone ${url}`);
  execFileSync("git", ["clone", "--depth", "1", "--quiet", url, tmp], { stdio: "inherit" });
  return { dir: tmp, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}

// Ставит сам плагин obsidian-zen прямо из корня репо и включает его (без BRAT).
function installPlugin(repoDir, vaultObs, dry) {
  const manifestPath = path.join(repoDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return;
  const id = readJson(manifestPath).id;
  if (!id) return;

  const destDir = path.join(vaultObs, "plugins", id);
  log(`[plugin] ${id} -> .obsidian/plugins/${id}/`);
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

// Применяет содержимое settings/: *.json -> merge (или union для community-plugins), папки -> copy.
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
    throw new Error(`Не похоже на ваулт: нет ${vaultObs}. Открой его в Obsidian хотя бы раз.`);
  }

  const src = resolveSource(opts.from);
  try {
    const settingsDir = path.join(src.dir, "settings");
    if (!isDir(settingsDir)) throw new Error(`В источнике нет settings/: ${src.dir}`);

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const bak = path.join(opts.vault, `.obsidian.bak-${stamp}`);
    log(`[backup] ${bak}`);
    if (!opts.dry) fs.cpSync(vaultObs, bak, { recursive: true });

    installPlugin(src.dir, vaultObs, opts.dry);
    applySettings(settingsDir, vaultObs, opts.dry);

    log("");
    log(
      opts.dry
        ? "Dry-run: ничего не изменено."
        : `Готово. Бэкап: ${bak}\nВ целевом ваулте нажми Cmd+R, затем включи плагин Zen Mode.`,
    );
  } finally {
    src.cleanup();
  }
}
