import { createRequire } from "node:module";

import { Command } from "commander";

import { registerCommands } from "./commands/index.js";
import { loadConfig } from "./lib/config.js";
import { createParliamentClient, type ParliamentClient } from "./lib/parliamentClient.js";

import type { CommandRuntime } from "./types.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

const TOP_LEVEL_HELP_EXAMPLES = [
  "parliament bill 3973",
  'parliament bill "renters rights"',
  'parliament search bills "energy"',
  'parliament member "Keir Starmer"',
  'parliament divisions "budget"',
  'parliament questions "transport"',
  'parliament bill "renters rights" | jq'
].join("\n  ");

export interface CliDependencies {
  client: ParliamentClient;
  runtime: CommandRuntime;
}

export const createRuntime = (
  fetchImplementation: typeof fetch = fetch,
  stdoutIsTTY: boolean = process.stdout.isTTY ?? false
): CommandRuntime => ({
  fetchImplementation,
  stdoutIsTTY,
  writeStderr: (text) => {
    process.stderr.write(text);
  },
  writeStdout: (text) => {
    process.stdout.write(text);
  }
});

export const createDependencies = (
  fetchImplementation: typeof fetch = fetch,
  stdoutIsTTY: boolean = process.stdout.isTTY ?? false
): CliDependencies => {
  const runtime = createRuntime(fetchImplementation, stdoutIsTTY);
  const config = loadConfig();
  const client = createParliamentClient(
    config,
    runtime.fetchImplementation,
    `parliament-cli/${packageJson.version}`
  );

  return {
    client,
    runtime
  };
};

export const buildCli = (dependencies: CliDependencies = createDependencies()): Command => {
  const program = new Command();

  program
    .name("parliament")
    .description("Agent-friendly UK Parliament CLI.")
    .option("--json", "Force JSON output.")
    .option("--text", "Force text output.")
    .option("--no-color", "Disable ANSI colour and styling in text output.")
    .showHelpAfterError()
    .showSuggestionAfterError()
    .version(packageJson.version);

  registerCommands(program, dependencies);

  program.addHelpText(
    "after",
    `\nOutput defaults to text in a TTY and JSON when piped. Use --json or --text to override.\n\nExamples:\n  ${TOP_LEVEL_HELP_EXAMPLES}`
  );

  return program;
};
