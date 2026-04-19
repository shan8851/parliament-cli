#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { CommanderError, type Command } from "commander";
import { fileURLToPath } from "node:url";

import { buildCli, createDependencies, type CliDependencies } from "./buildCli.js";
import { toAppError } from "./lib/errors.js";
import { getOutputMode, writeCommandError } from "./lib/output.js";

import type { OutputMode, OutputOptions } from "./types.js";

const getRawOutputOptions = (argv: string[]): OutputOptions => ({
  json: argv.includes("--json"),
  text: argv.includes("--text")
});

const resolveCommandName = (argv: string[]): string => {
  const positionalArguments = argv.filter((argument) => !argument.startsWith("-"));
  const [firstArgument, secondArgument] = positionalArguments;

  if (firstArgument === "help") {
    return resolveCommandName(positionalArguments.slice(1));
  }

  if (firstArgument === "votes" || firstArgument === "divisions") {
    return "divisions";
  }

  if (firstArgument === "search" && secondArgument === "bills") {
    return "search-bills";
  }

  if (firstArgument === "search") {
    return "search";
  }

  if (
    firstArgument === "bill" ||
    firstArgument === "member" ||
    firstArgument === "questions"
  ) {
    return firstArgument;
  }

  return "cli";
};

const getParseErrorOutputMode = (
  outputOptions: OutputOptions,
  dependencies: CliDependencies
): OutputMode => (outputOptions.json ? "json" : dependencies.runtime.stdoutIsTTY ? "text" : "json");

const configureCommandRecursively = (
  command: Command,
  dependencies: CliDependencies,
  suppressErrorOutput: boolean
): void => {
  command.configureOutput({
    outputError: (text, write) => {
      if (suppressErrorOutput) {
        return;
      }

      write(text);
    },
    writeErr: (text) => {
      if (suppressErrorOutput) {
        return;
      }

      dependencies.runtime.writeStderr(text);
    },
    writeOut: (text) => {
      dependencies.runtime.writeStdout(text);
    }
  });
  command.exitOverride();
  command.commands.forEach((subcommand) => {
    configureCommandRecursively(subcommand, dependencies, suppressErrorOutput);
  });
};

export const runCli = async (
  argv: string[],
  dependencies: CliDependencies = createDependencies()
): Promise<number> => {
  const outputOptions = getRawOutputOptions(argv);
  const requestedAt = new Date().toISOString();
  const commandName = resolveCommandName(argv);
  const previousExitCode = process.exitCode;

  process.exitCode = undefined;

  try {
    const parseErrorOutputMode = getParseErrorOutputMode(outputOptions, dependencies);
    const resolvedOutputMode = (() => {
      try {
        return {
          ok: true as const,
          outputMode: getOutputMode(outputOptions, dependencies.runtime)
        };
      } catch (error) {
        return {
          error: toAppError(error),
          ok: false as const
        };
      }
    })();

    if (!resolvedOutputMode.ok) {
      writeCommandError(
        commandName,
        resolvedOutputMode.error,
        requestedAt,
        parseErrorOutputMode,
        dependencies.runtime
      );

      return resolvedOutputMode.error.exitCode;
    }

    const parseOutputMode = resolvedOutputMode.outputMode;
    const suppressErrorOutput = parseOutputMode === "json";
    const cli = buildCli(dependencies);

    configureCommandRecursively(cli, dependencies, suppressErrorOutput);

    try {
      await cli.parseAsync(argv, {
        from: "user"
      });

      return process.exitCode ?? 0;
    } catch (error) {
      if (error instanceof CommanderError) {
        if (error.exitCode === 0) {
          return 0;
        }

        const appError = toAppError(error);

        if (parseOutputMode === "json") {
          writeCommandError(commandName, appError, requestedAt, parseOutputMode, dependencies.runtime);
        }

        return appError.exitCode;
      }

      const appError = toAppError(error);

      writeCommandError(commandName, appError, requestedAt, parseOutputMode, dependencies.runtime);

      return appError.exitCode;
    }
  } finally {
    process.exitCode = previousExitCode;
  }
};

const isEntrypoint = (() => {
  if (process.argv[1] === undefined) return false;
  const scriptPath = fileURLToPath(import.meta.url);

  try {
    return realpathSync(process.argv[1]) === realpathSync(scriptPath);
  } catch {
    return scriptPath === process.argv[1];
  }
})();

if (isEntrypoint) {
  const exitCode = await runCli(process.argv.slice(2));

  process.exitCode = exitCode;
}
