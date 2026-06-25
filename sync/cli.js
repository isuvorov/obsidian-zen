#!/usr/bin/env node
// CLI: раскатать настройки/плагин obsidian-zen в указанный ваулт.
//
//   obsidian-zen <vault> [--from <source>] [--dry-run]
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { sync } from "./sync.js";

const DEFAULT_FROM = "https://github.com/isuvorov/obsidian-zen";

yargs(hideBin(process.argv))
  .scriptName("obsidian-zen")
  .command(
    "$0 <vault>",
    "Раскатать тему/плагин и настройки obsidian-zen в Obsidian-ваулт",
    (y) =>
      y
        .positional("vault", {
          describe: "путь к целевому Obsidian-ваулту",
          type: "string",
        })
        .option("from", {
          alias: "f",
          type: "string",
          default: DEFAULT_FROM,
          describe: "источник профиля: папка | git URL | owner/repo",
        })
        .option("dry-run", {
          alias: "n",
          type: "boolean",
          default: false,
          describe: "показать план без изменений",
        })
        .example("$0 ~/vaults/work", "раскатать из GitHub по умолчанию")
        .example("$0 ~/vaults/work --dry-run", "показать план")
        .example("$0 ~/vaults/work --from .", "из локального клона репо"),
    async (args) => {
      try {
        await sync({ vault: args.vault, from: args.from, dry: args.dryRun });
      } catch (err) {
        console.error(`Ошибка: ${err.message}`);
        process.exit(1);
      }
    },
  )
  .strict()
  .demandCommand(1)
  .help()
  .alias("h", "help")
  .alias("v", "version")
  .wrap(Math.min(100, process.stdout.columns || 100))
  .parse();
