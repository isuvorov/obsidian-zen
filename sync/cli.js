#!/usr/bin/env node
// Single obsidian-zen CLI with subcommands:
//
//   obsidian-zen sync <vault> [--from <source>] [--dry-run]
//   obsidian-zen open <files..> [--vault <path>] [--mirror <dir>]
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { sync } from "./sync.js";
import { openInObsidian } from "./open.js";

const DEFAULT_FROM = "https://github.com/isuvorov/obsidian-zen";

yargs(hideBin(process.argv))
  .scriptName("obsidian-zen")
  .command(
    "sync <vault>",
    "Roll out the obsidian-zen plugin and settings into an Obsidian vault",
    (y) =>
      y
        .positional("vault", {
          describe: "path to the target Obsidian vault",
          type: "string",
        })
        .option("from", {
          alias: "f",
          type: "string",
          default: DEFAULT_FROM,
          describe: "profile source: folder | git URL | owner/repo",
        })
        .option("dry-run", {
          alias: "n",
          type: "boolean",
          default: false,
          describe: "show the plan without making changes",
        })
        .example("$0 sync ~/vaults/work", "roll out from the default GitHub source")
        .example("$0 sync ~/vaults/work --dry-run", "show the plan")
        .example("$0 sync ~/vaults/work --from .", "from a local clone of the repo"),
    async (args) => {
      try {
        await sync({ vault: args.vault, from: args.from, dry: args.dryRun });
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    },
  )
  .command(
    "open <files..>",
    "Open Markdown file(s) — or a vault folder — in Obsidian",
    (y) =>
      y
        .positional("files", {
          describe: "paths to .md files, or a vault folder to open the vault itself",
          type: "string",
          array: true,
        })
        .option("vault", {
          alias: "V",
          type: "string",
          describe: "destination vault (defaults to the active one from obsidian.json)",
        })
        .option("mirror", {
          alias: "m",
          type: "array",
          default: [],
          describe: "directory whose inner structure is mirrored into the vault (repeatable)",
        })
        .example("$0 open README.md", "open a file in the active vault")
        .example("$0 open .", "open the vault in the current directory")
        .example("$0 open ~/projects/app/docs/*.md", "open several files")
        .example("$0 open NOTES.md --vault ~/vaults/work", "pick the destination vault"),
    async (args) => {
      try {
        await openInObsidian(args.files, { vault: args.vault, mirror: args.mirror });
      } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    },
  )
  .strict()
  .demandCommand(1, "Specify a subcommand: sync or open")
  .help()
  .alias("h", "help")
  .alias("v", "version")
  .wrap(Math.min(100, process.stdout.columns || 100))
  .parse();
