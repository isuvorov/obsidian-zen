# 🐻‍❄️ Zen Mode

<p>
  <a href="https://github.com/lskjs"><img alt="Made by LSK.js" src="https://github.com/lskjs/presets/raw/main/docs/badge.svg" height="20"></a>
  <a href="https://www.npmjs.com/package/obsidian-zen"><img alt="NPM version" src="https://badgen.net/npm/v/obsidian-zen" height="20"></a>
  <a href="https://www.npmjs.com/package/obsidian-zen"><img alt="NPM downloads" src="https://badgen.net/npm/dt/obsidian-zen" height="20"></a>
  <a href="https://www.npmjs.com/package/obsidian-zen"><img alt="Package size" src="https://img.shields.io/npm/unpacked-size/obsidian-zen?label=size&amp;color=blue" height="20"></a>
  <a href="https://obsidian.md"><img alt="Obsidian plugin" src="https://img.shields.io/badge/Obsidian-plugin-7c3aed.svg?logo=obsidian&amp;logoColor=white" height="20"></a>
  <a href="https://github.com/isuvorov/obsidian-zen/blob/main/LICENSE"><img alt="License" src="https://badgen.net/github/license/isuvorov/obsidian-zen" height="20"></a>
  <a href="https://t.me/isuvorov"><img alt="Write us in Telegram" src="https://img.shields.io/badge/write%20us-0088CC?logo=telegram&amp;logoColor=white" height="20"></a>
</p>

<div align="center">
  <h3><p><strong>🐻‍❄️ Zen Mode for Obsidian 🐻‍❄️</strong></p></h3>
</div>

<img src="./docs/logo.png" align="right" width="200" height="200" alt="Zen Mode logo" />

**🧘 Zen mode** — no header, no tabs, no noise — focus on content <br/>
**🎨 Accent** — accent only important, powered by Cupertino <br/>
**⌨️ Hotkeys** — Familiar hotkeys from other editors like Bear App <br/>
**⚡ Sync** — keeps any vault in sync with your own setting <br/>
**📂 File** — open any file without adding a vault <br/>



---

## Install via BRAT

1. Install and enable the **BRAT** plugin (Settings → Community plugins).
2. Command palette → **BRAT: Add a beta plugin**.
3. Paste: `https://github.com/isuvorov/obsidian-zen`
4. Enable the plugin: Settings → Community plugins → **Zen Mode**.

The CSS layers on top of your current theme. Disable the plugin and the styling
is removed. Repeat once per device/vault; after that updates arrive on their own.

> BRAT pulls `main.js` + `manifest.json` + `styles.css` from the latest GitHub **Release**.
> Without a release you'll get a `no releases found` error — see [Releases](#releases-fully-automated-no-tags-needed).

## CLI: one command, any vault

The CLI (`sync/`, ESM JS built on [yargs](https://github.com/yargs/yargs)) ships
two subcommands. Runs on Node and Bun.

| Subcommand                  | What it does                                                              |
|-----------------------------|--------------------------------------------------------------------------|
| `obsidian-zen sync <vault>` | install the plugin + settings profile into a vault (non-destructive)     |
| `obsidian-zen open <files>` | symlink any external `.md` (and its attachments) into a vault and open it |

### `sync` — roll out the plugin and settings

Instead of fiddling with BRAT in every vault, roll out the **plugin + settings**
with a single command. It installs the plugin straight from the repository and
applies the `settings/` profile **without breaking** the target vault.

```bash
# default source — the isuvorov/obsidian-zen GitHub repository:
npx obsidian-zen sync ~/vaults/work            # roll out
npx obsidian-zen sync ~/vaults/work --dry-run  # show the plan without changes

# from a local clone (for development):
node sync/cli.js sync ~/vaults/work --from .   # or: bun sync/cli.js ...
```

After rolling out, press `Cmd+R` in the vault, then enable the **Zen Mode** plugin.

> Run it with anything — `npx` / `bunx` / `node` / `bun` (it's plain ESM JS).
> To run from a clone, install dependencies first: `npm install` (or `bun install`).

#### `sync` flags

| Argument    | Alias | Default                                    | Purpose                                          |
|-------------|-------|--------------------------------------------|--------------------------------------------------|
| `<vault>`   | —     | (required)                                 | path to the target Obsidian vault                |
| `--from`    | `-f`  | `https://github.com/isuvorov/obsidian-zen` | profile source: folder \| git URL \| `owner/repo` |
| `--dry-run` | `-n`  | `false`                                    | show the plan without changes                    |

### `open` — open any Markdown file in Obsidian

Open an `.md` file that lives **anywhere** on disk in Obsidian, even outside any
vault. It resolves the file against your vaults and:

1. **already inside a vault** → opens it in place;
2. **under a `--mirror` directory** → recreates that directory's inner structure in
   the vault and links the file into it;
3. **anywhere else** → symlinks it into the vault's `Temp/`, preserving the path
   relative to `~/projects/` (or `~`).

Local attachments the note links to — `![](img.png)` and `<img src="...">` — are
symlinked alongside it, so images render. The destination defaults to your
**active** vault (from `obsidian.json`); override it with `--vault`.

```bash
npx obsidian-zen open README.md                       # open in the active vault
npx obsidian-zen open ~/projects/app/docs/*.md         # several files at once
npx obsidian-zen open NOTES.md --vault ~/vaults/work   # pick the destination vault
npx obsidian-zen open paper.md --mirror ~/projects/app # mirror the tree under the vault
```

> Tip: alias it for one-keystroke opening — `alias ob='obsidian-zen open'`, then `ob note.md`.

#### `open` flags

| Argument     | Alias | Default                | Purpose                                                          |
|--------------|-------|------------------------|------------------------------------------------------------------|
| `<files..>`  | —     | (required)             | one or more `.md` files to open                                  |
| `--vault`    | `-V`  | active vault           | destination vault for the symlinks                               |
| `--mirror`   | `-m`  | —                      | directory whose inner structure is mirrored into the vault (repeatable) |

> Currently the `open` registry lookup and `Temp/` layout target macOS/Linux
> (`obsidian.json` under `~/Library/Application Support` / `~/.config`).

### What `sync` writes

The profile lives in **`settings/`** of this repository — edit it there and the
command rolls out the updated profile:

| File              | How it's applied | What's inside                                         |
|-------------------|------------------|------------------------------------------------------|
| `app.json`        | deep-merge       | base app settings                                    |
| `appearance.json` | deep-merge       | active theme (`cssTheme: "Cupertino"`)               |
| `hotkeys.json`    | deep-merge       | hotkeys (headings `Cmd+1…6`, sidebars, palette, switcher) |

The plugin itself is installed into `.obsidian/plugins/obsidian-zen/`, and its id
is added to `community-plugins.json` (union — nothing gets disabled).

---

## Hotkeys & commands

The plugin registers `Toggle heading 1…6` commands. The `settings/hotkeys.json`
profile binds keys to them:

| Hotkey            | Action                                                  |
|-------------------|---------------------------------------------------------|
| `Cmd+1` … `Cmd+6` | Toggle heading 1–6 (toggle: pressing again removes it)  |
| `Cmd+0`           | Remove heading (plain text)                             |
| `Cmd+P`           | Quick switcher (open file)                              |
| `Cmd+Shift+P`     | Command palette                                         |
| `Cmd+§`           | Toggle the left sidebar                                 |
| `Cmd+Shift+§`     | Toggle the right sidebar                                |

> Collapse **both** sidebars → **zen mode** kicks in: the view header, tab bar
> and inline title hide, and the titlebar is painted to match the background.

Heading toggle behaves like `Cmd+B` for bold: one press sets a heading of the
given level, pressing again at the same level removes it. Works across multi-line
selections (blank lines are left untouched).

---

## How the sync tool works

```
resolveSource(--from)   local folder | git clone owner/repo into a temp folder
        │
   backup .obsidian → .obsidian.bak-<timestamp>
        │
installPlugin           copies manifest.json + main.js + styles.css
        │               into .obsidian/plugins/obsidian-zen/ and enables the plugin
        │
applySettings           applies settings/*.json and folders into .obsidian/
```

| What                                                | Behaviour                                                    |
|-----------------------------------------------------|--------------------------------------------------------------|
| JSON objects                                        | deep-merge — profile values win, foreign keys are preserved  |
| `community-plugins.json`                            | union — lists are merged, nothing gets disabled              |
| folders                                             | copied on top, extra files are not removed                   |
| `workspace.json`, `workspace-mobile.json`, notes    | **left untouched**                                           |
| before any change                                   | a backup at `<vault>/.obsidian.bak-<date>`                   |

`--from` accepts a local folder, a git URL or `owner/repo` (cloned from GitHub in
that case). A git source requires `git` to be installed.

---

## Releases (fully automated, no tags needed)

A single CI workflow (`release.yml`) releases **both** artifacts with **one shared
version**, so the GitHub Release, npm, `manifest.json` and `package.json` never
drift apart:

| Workflow       | Trigger (paths)                                                | What it does                                                              | Version                                                  |
|----------------|----------------------------------------------------------------|--------------------------------------------------------------------------|----------------------------------------------------------|
| `release.yml`  | `styles.css`, `main.js`, `manifest.json`, `sync/**`, `package.json` | GitHub **Release** (BRAT pulls it) **and** `npm publish` (for `npx`) | `major.minor` from `manifest.json` + `github.run_number` |

```bash
git commit -am "changes"
git push          # ← one run releases the plugin and npm together
```

`patch` = `github.run_number` — a single, always-increasing build counter shared
by both artifacts, so each push produces the same version everywhere. The
workflow stamps that version into `manifest.json` and `package.json` before
releasing. Want to bump `minor`/`major`? Edit the `version` in `manifest.json`
(the single source of truth for `major.minor`) and push.

Changing any of `styles.css`, `main.js`, `manifest.json`, `sync/**` or
`package.json` → one release of both artifacts. Changing `README.md` produces
nothing.

### One-time setup

- **npm**: create a token on npmjs.com (Automation) and add it to the repository
  as the **`NPM_TOKEN`** secret (Settings → Secrets and variables → Actions). The
  package name `obsidian-zen` must be available on npm.
- **GitHub Release**: if the first run fails with `403` — Settings → Actions →
  General → Workflow permissions → **Read and write permissions**.

---

## Limitations

- **BRAT pulls from the latest GitHub Release** — without a release you'll get `no releases found`.
- **A git `--from` source requires `git` to be installed** (a local folder doesn't).
- **The vault must have been opened in Obsidian at least once** — the sync needs the `.obsidian/` folder.
- **After rolling out**, press `Cmd+R` in the vault and enable the plugin (it's
  added to the list, but Obsidian only picks up the changes after a reload).
- **Typography uses the system font stack** (`-apple-system`, `Helvetica Neue`).
- **The styling targets Cupertino** as the base theme, but the CSS works on top of any theme.

---

## License

MIT — see [LICENSE](LICENSE).
