// Open Markdown file(s) in Obsidian from the terminal or a file manager.
// A pure-ESM port of the open-in-obsidian shell script:
//   1) file already lives inside some vault   -> open it in place;
//   2) file is under one of the --mirror dirs  -> mirror its structure into the vault via a symlink;
//   3) otherwise                               -> symlink it into the vault's __temp/,
//      preserving the path relative to ~/projects/ or ~.
// Local attachments the note links to (images, etc.) are symlinked alongside it.
// Opening goes through the obsidian:// scheme + the platform's "open".
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFile } from "node:child_process";

const log = (...m) => console.log(...m);
const warn = (...m) => console.warn(...m);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const realpathOr = (p) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
};
// does the path exist, including broken symlinks (lstat does not follow the link)
const lexists = (p) => {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
};

// Path to obsidian.json (the vault registry) — depends on the OS.
function obsidianConfigPath() {
  const home = os.homedir();
  if (process.platform === "darwin")
    return path.join(home, "Library/Application Support/obsidian/obsidian.json");
  if (process.platform === "win32")
    return path.join(
      process.env.APPDATA || path.join(home, "AppData/Roaming"),
      "obsidian/obsidian.json",
    );
  return path.join(
    process.env.XDG_CONFIG_HOME || path.join(home, ".config"),
    "obsidian/obsidian.json",
  );
}

// Paths of all vaults and the path of the active one (open: true).
function readVaults() {
  const cfgPath = obsidianConfigPath();
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  } catch {
    throw new Error(`Obsidian vault registry not found: ${cfgPath}. Open Obsidian at least once.`);
  }
  const entries = Object.values(cfg.vaults || {});
  const all = entries.map((v) => v.path).filter(Boolean);
  const active = (entries.find((v) => v.open) || {}).path;
  return { all, active };
}

// Open a path in Obsidian via obsidian:// + the platform's "open".
function openInApp(targetPath) {
  const url = `obsidian://open?path=${encodeURIComponent(targetPath)}&paneType=tab`;
  log(`[open] ${targetPath}`);
  const [cmd, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  execFile(cmd, args, (err) => {
    if (err) warn(`[warn] could not open URL: ${err.message}`);
  });
}

// Extract local attachment paths from Markdown: [..](path) and <img src="...">.
function extractTargets(content) {
  const out = [];
  for (const m of content.matchAll(/\[[^\]]*\]\(([^")\n]+)/g)) out.push(m[1]);
  for (const m of content.matchAll(/<img[^>]*\ssrc="([^"?]+)/gi)) out.push(m[1]);
  return out;
}

// Symlink the note's local attachments next to its symlink, mirroring subfolders.
function linkAttachments(srcFile, linkDir) {
  const mdDir = path.dirname(srcFile); // srcFile is already a realpath -> mdDir is real
  let content;
  try {
    content = fs.readFileSync(srcFile, "utf8");
  } catch {
    return;
  }
  for (const raw of extractTargets(content)) {
    const target = raw.replace(/\s+$/, "");
    if (!target) continue;
    const linked = realpathOr(path.join(mdDir, target));
    // only local files inside the note's folder (not higher up the tree)
    if (!linked || (linked !== mdDir && !linked.startsWith(mdDir + path.sep))) continue;

    let dir = linkDir;
    const absDir = path.dirname(linked);
    if (absDir !== mdDir) {
      dir = linkDir + absDir.slice(mdDir.length); // reproduce subfolders
      fs.mkdirSync(dir, { recursive: true });
    }
    const linkpath = path.join(dir, path.basename(linked));
    if (!lexists(linkpath)) {
      try {
        fs.symlinkSync(linked, linkpath);
      } catch {
        /* an attachment is non-critical — skip */
      }
    }
  }
}

// Pick a unique symlink name (like the original: name_<rand>.ext).
function uniqueLink(linkpath) {
  while (lexists(linkpath)) {
    const ext = path.extname(linkpath);
    const base = linkpath.slice(0, linkpath.length - ext.length);
    linkpath = `${base}_${Math.floor(Math.random() * 32768)}${ext}`;
  }
  return linkpath;
}

async function openOne(file, ctx) {
  // existence, readability, .md only
  let st;
  try {
    st = fs.statSync(file);
  } catch {
    st = null;
  }
  if (!st || !st.isFile()) return warn(`[skip] no such file: ${file}`);
  try {
    fs.accessSync(file, fs.constants.R_OK);
  } catch {
    return warn(`[skip] not readable: ${file}`);
  }
  if (!file.endsWith(".md")) return warn(`[skip] only .md files are allowed: ${file}`);

  const abspath = fs.realpathSync(file);

  // 1) file already inside some vault — open it in place
  for (const v of ctx.vaults) {
    const realV = realpathOr(v);
    if (realV && (abspath === realV || abspath.startsWith(realV + path.sep))) {
      return openInApp(abspath);
    }
  }

  // 2) under one of the mirrored dirs — reproduce its structure inside the vault
  for (const base of ctx.mirror) {
    const realBase = realpathOr(base) || path.resolve(base);
    if (abspath === realBase || abspath.startsWith(realBase + path.sep)) {
      const linkpath = path.join(
        ctx.defaultVault,
        path.basename(realBase) + abspath.slice(realBase.length),
      );
      fs.mkdirSync(path.dirname(linkpath), { recursive: true });
      if (!lexists(linkpath)) {
        fs.symlinkSync(abspath, linkpath);
        linkAttachments(abspath, path.dirname(linkpath));
        await delay(1000); // let Obsidian notice the new files
      }
      return openInApp(linkpath);
    }
  }

  // 3) otherwise — symlink into __temp/, preserving the path relative to ~/projects/ or ~.
  // home is taken through realpath: abspath is realpath'd too, otherwise the prefixes won't match.
  const home = realpathOr(os.homedir()) || os.homedir();
  const projects = path.join(home, "projects") + path.sep;
  let relpath;
  if (abspath.startsWith(projects)) relpath = abspath.slice(projects.length);
  else if (abspath.startsWith(home + path.sep)) relpath = abspath.slice(home.length + 1);
  else relpath = path.basename(abspath);

  let linkpath = path.join(ctx.defaultVault, "__temp", relpath);
  fs.mkdirSync(path.dirname(linkpath), { recursive: true });

  // dedupe: if a symlink already points to exactly this file — reuse it
  if (lexists(linkpath) && realpathOr(linkpath) === abspath) {
    return openInApp(linkpath);
  }
  linkpath = uniqueLink(linkpath); // don't clobber anything else — take a free name
  fs.symlinkSync(abspath, linkpath);
  linkAttachments(abspath, path.dirname(linkpath));
  await delay(1000);
  return openInApp(linkpath);
}

/**
 * Open Markdown files in Obsidian.
 * @param {string[]} files list of paths to .md files
 * @param {{ vault?: string, mirror?: string[] }} [opts]
 *   vault  — destination vault (defaults to the active one from obsidian.json)
 *   mirror — directories whose inner structure is mirrored into the vault
 */
export async function openInObsidian(files, opts = {}) {
  if (!files || files.length === 0) throw new Error("No files to open.");

  const { all, active } = readVaults();
  const defaultVault = opts.vault ? path.resolve(opts.vault) : active;
  if (!defaultVault) {
    throw new Error("Could not determine the default vault. Pass one via --vault.");
  }

  const ctx = {
    vaults: all.length ? all : [defaultVault],
    defaultVault,
    mirror: opts.mirror || [],
  };

  for (const f of files) {
    try {
      await openOne(f, ctx);
    } catch (err) {
      warn(`[warn] ${f}: ${err.message}`);
    }
  }
}
