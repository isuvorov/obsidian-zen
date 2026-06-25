# 🧘 Zen Mode

[![LSK.js](https://github.com/lskjs/presets/raw/main/docs/badge.svg)](https://github.com/lskjs)
[![NPM version](https://badgen.net/npm/v/obsidian-zen)](https://www.npmjs.com/package/obsidian-zen)
[![NPM downloads](https://badgen.net/npm/dt/obsidian-zen)](https://www.npmjs.com/package/obsidian-zen)
[![Package size](https://img.shields.io/npm/unpacked-size/obsidian-zen?label=size&color=blue)](https://www.npmjs.com/package/obsidian-zen)
[![Obsidian plugin](https://img.shields.io/badge/Obsidian-plugin-7c3aed.svg?logo=obsidian&logoColor=white)](https://obsidian.md)
[![License](https://badgen.net/github/license/isuvorov/obsidian-zen)](https://github.com/isuvorov/obsidian-zen/blob/main/LICENSE)
[![Write us in Telegram](https://img.shields.io/badge/write%20us-0088CC?logo=telegram&logoColor=white)](https://t.me/isuvorov)

<div align="center">
  <h3><p><strong>🧘 Distraction-free Obsidian with a clean red-accent styling — a plugin overlay on top of any theme, rolled out to any vault with one command 🔴</strong></p></h3>
</div>

<img src="./docs/logo.png" align="right" width="200" height="200" alt="Zen Mode logo" />

**🧘 Zen mode** — collapse both sidebars and the chrome hides: no view header, no tabs, titlebar blended into the background <br/>
**🎨 Red-accent styling** — red accents, red list bullets that change shape by nesting level, refined heading weights; light & dark <br/>
**🧩 Overlay, not a theme** — sits on top of your current theme; turn it off and your look is untouched <br/>
**⌨️ Heading toggles** — `Toggle heading 1…6` commands, bound to `Cmd+1…6` by the bundled profile; press again to remove <br/>
**📲 Ships via BRAT** — add the repo once, then it auto-updates on every device <br/>
**⚡ One command, any vault** — `npx obsidian-zen <vault>` installs the plugin and your settings <br/>
**🔒 Non-destructive sync** — deep-merges your JSON, backs up first, never touches notes or `workspace.json` <br/>
**🖥️ Cross-platform** — the plugin works on desktop and mobile; the sync CLI runs on Node or Bun <br/>

This is a single repository with two artifacts: the **plugin** (`styles.css` + `main.js`) provides the styling, zen mode and hotkeys, while the **CLI sync tool** (`sync/`) rolls that plugin out together with a settings profile (`settings/`) into any vault. Install it via BRAT — or with a single command.

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

## Roll out to any vault with one command (CLI, bun)

Instead of fiddling with BRAT in every vault, you can roll out the **plugin +
settings** with a single command. The CLI (`sync/`, ESM JS built on
[yargs](https://github.com/yargs/yargs)) installs the plugin straight from the
repository and applies the `settings/` profile **without breaking** the target
vault. Runs on Node and Bun.

```bash
# default source — the isuvorov/obsidian-zen GitHub repository:
npx obsidian-zen ~/vaults/work            # roll out
npx obsidian-zen ~/vaults/work --dry-run  # show the plan without changes

# from a local clone (for development):
node sync/cli.js ~/vaults/work --from .   # or: bun sync/cli.js ...
```

After rolling out, press `Cmd+R` in the vault, then enable the **Zen Mode** plugin.

> Run it with anything — `npx` / `bunx` / `node` / `bun` (it's plain ESM JS).
> To run from a clone, install dependencies first: `npm install` (or `bun install`).

---

## CLI configuration

### Flags

| Argument    | Alias | Default                                    | Purpose                                          |
|-------------|-------|--------------------------------------------|--------------------------------------------------|
| `<vault>`   | —     | (required)                                 | path to the target Obsidian vault                |
| `--from`    | `-f`  | `https://github.com/isuvorov/obsidian-zen` | profile source: folder \| git URL \| `owner/repo` |
| `--dry-run` | `-n`  | `false`                                    | show the plan without changes                    |
| `--help`    | `-h`  | —                                          | show help                                        |
| `--version` | `-v`  | —                                          | show version                                     |

### What gets synced

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
