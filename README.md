# 🐻‍❄️ Zen Mode for Obsidian

<p>
  <a href="https://github.com/lskjs"><img alt="Made by LSK.js" src="https://github.com/lskjs/presets/raw/main/docs/badge.svg" height="20"></a>
  <a href="https://www.npmjs.com/package/obsidian-zen"><img alt="NPM version" src="https://badgen.net/npm/v/obsidian-zen" height="20"></a>
  <a href="https://www.npmjs.com/package/obsidian-zen"><img alt="NPM downloads" src="https://badgen.net/npm/dt/obsidian-zen" height="20"></a>
  <a href="https://www.npmjs.com/package/obsidian-zen"><img alt="Package size" src="https://img.shields.io/npm/unpacked-size/obsidian-zen?label=size&amp;color=blue" height="20"></a>
  <a href="https://obsidian.md"><img alt="Obsidian plugin" src="https://img.shields.io/badge/Obsidian-plugin-7c3aed.svg?logo=obsidian&amp;logoColor=white" height="20"></a>
  <a href="https://github.com/isuvorov/obsidian-zen/blob/main/LICENSE"><img alt="License" src="https://badgen.net/github/license/isuvorov/obsidian-zen" height="20"></a>
  <a href="https://t.me/isuvorov"><img alt="Write us in Telegram" src="https://img.shields.io/badge/write%20us-0088CC?logo=telegram&amp;logoColor=white" height="20"></a>
</p>

<img src="./docs/logo.png" align="right" width="180" height="180" alt="Zen Mode logo" />

<div align="center">
  <h3><p><strong>🐻‍❄️ Zen Mode plugin for Obsidian 🐻‍❄️</strong></p></h3>
</div>

**🧘 Zen mode** — no header, no tabs, no noise — focus on content <br/>
**🎨 Accent** — accent only important, powered by Cupertino <br/>
**⌨️ Hotkeys** — familiar hotkeys from other editors like Bear App <br/>
**⚡ Sync** — keeps any vault in sync with your own setting <br/>
**📂 File** — open any file without adding a vault <br/>

---

## Quick Start

Have an Obsidian vault? Roll out the plugin and settings with one command:

```bash
npx obsidian-zen sync ~/vaults/work
```

Then press `Cmd+R` in the vault and enable the **Zen Mode** plugin. Cmd + § That's it.

---

## Install via CLI

The CLI installs the plugin straight from the repo and applies the `settings/`
profile into a vault. It's **non-destructive** — it backs up `.obsidian/` first,
deep-merges JSON (your own keys are kept) and never deletes anything.

```bash
npx obsidian-zen sync ~/vaults/work             # roll out
npx obsidian-zen sync ~/vaults/work --dry-run   # preview the plan, change nothing
```

After it finishes, press `Cmd+R` in the vault and enable the **Zen Mode** plugin.

## Install via BRAT

Prefer the in-app route? Install with [**BRAT**](https://github.com/TfTHacker/obsidian42-brat):

1. Install and enable **BRAT** (Settings → Community plugins).
2. Command palette → **BRAT: Add a beta plugin** → paste `https://github.com/isuvorov/obsidian-zen`.
3. Enable **Zen Mode** (Settings → Community plugins).

---

## CLI

Two subcommands, both run on Node and Bun.

### `sync` — roll out the plugin and settings into a vault

```bash
npx obsidian-zen sync ~/vaults/work               # default source (this GitHub repo)
npx obsidian-zen sync ~/vaults/work --dry-run     # show the plan without changes
npx obsidian-zen sync ~/vaults/work --from .      # from a local clone (development)
npx obsidian-zen sync ~/vaults/work --from you/fork   # from another owner/repo
```

| Argument    | Alias | Default                                    | Purpose                                           |
|-------------|-------|--------------------------------------------|---------------------------------------------------|
| `<vault>`   | —     | (required)                                 | path to the target Obsidian vault                 |
| `--from`    | `-f`  | `https://github.com/isuvorov/obsidian-zen` | profile source: folder \| git URL \| `owner/repo` |
| `--dry-run` | `-n`  | `false`                                    | show the plan without changes                     |

### `open` — open any Markdown file in Obsidian

Open a `.md` file that lives **anywhere** on disk, even outside a vault. Local
attachments the note links to are symlinked alongside it, so images render.

```bash
npx obsidian-zen open README.md                       # open in the active vault
npx obsidian-zen open ~/projects/app/docs/*.md         # several files at once
npx obsidian-zen open NOTES.md --vault ~/vaults/work   # pick the destination vault
npx obsidian-zen open paper.md --mirror ~/projects/app # mirror the tree under the vault
```

| Argument    | Alias | Default      | Purpose                                                                 |
|-------------|-------|--------------|-------------------------------------------------------------------------|
| `<files..>` | —     | (required)   | one or more `.md` files to open                                         |
| `--vault`   | `-V`  | active vault | destination vault for the symlinks                                      |
| `--mirror`  | `-m`  | —            | directory whose inner structure is mirrored into the vault (repeatable) |

> Tip: alias it for one-keystroke opening — `alias ob='obsidian-zen open'`, then `ob note.md`.

---

## Hotkeys & commands

The plugin registers `Toggle heading 1…6` commands. The `settings/hotkeys.json`
profile binds keys to them:

| Hotkey            | Action                                                 |
| ----------------- | ------------------------------------------------------ |
| `Cmd+1` … `Cmd+6` | Toggle heading 1–6 (toggle: pressing again removes it) |
| `Cmd+0`           | Remove heading (plain text)                            |
| `Cmd+P`           | Quick switcher (open file)                             |
| `Cmd+Shift+P`     | Command palette                                        |
| `Cmd+§`           | Toggle the left sidebar                                |
| `Cmd+Shift+§`     | Toggle the right sidebar                               |

> Collapse **both** sidebars → **zen mode** kicks in: the view header, tab bar
> and inline title hide, and the titlebar is painted to match the background.

Heading toggle behaves like `Cmd+B` for bold: one press sets a heading of the
given level, pressing again at the same level removes it. Works across multi-line
selections (blank lines are left untouched).

---

## License

MIT — see [LICENSE](LICENSE).
