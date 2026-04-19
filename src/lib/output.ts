import type { Command } from "commander";

import { JSON_SCHEMA_VERSION } from "./constants.js";
import { createAppError, toAppError, type AppError } from "./errors.js";

import type { CommandRuntime, ErrorEnvelope, OutputMode, OutputOptions, SuccessEnvelope } from "../types.js";

const writeJson = (
  runtime: Pick<CommandRuntime, "writeStdout">,
  value: unknown
): void => {
  runtime.writeStdout(`${JSON.stringify(value, null, 2)}\n`);
};

export const getOutputMode = (
  options: OutputOptions,
  runtime: Pick<CommandRuntime, "stdoutIsTTY">
): OutputMode => {
  if (options.json && options.text) {
    throw createAppError("INVALID_INPUT", "Choose either --json or --text, not both.");
  }

  if (options.json) {
    return "json";
  }

  if (options.text) {
    return "text";
  }

  return runtime.stdoutIsTTY ? "text" : "json";
};

export const withGlobalOutputOptions = <TOptions extends OutputOptions>(
  command: Command,
  options: TOptions
): TOptions & OutputOptions => {
  const globalOptions = command.optsWithGlobals<Record<string, unknown>>();
  const colorValue = typeof globalOptions["color"] === "boolean" ? globalOptions["color"] : undefined;
  const jsonValue = typeof globalOptions["json"] === "boolean" ? globalOptions["json"] : undefined;
  const textValue = typeof globalOptions["text"] === "boolean" ? globalOptions["text"] : undefined;

  return {
    ...options,
    ...(colorValue === undefined ? {} : { color: colorValue }),
    ...(jsonValue === true ? { json: true } : {}),
    ...(textValue === true ? { text: true } : {})
  };
};

export const writeCommandError = (
  commandName: string,
  error: AppError,
  requestedAt: string,
  outputMode: OutputMode,
  runtime: Pick<CommandRuntime, "writeStderr" | "writeStdout">
): void => {
  if (outputMode === "json") {
    const envelope: ErrorEnvelope = {
      command: commandName,
      error: {
        code: error.code,
        ...(error.details === undefined ? {} : { details: error.details }),
        message: error.message,
        retryable: error.retryable
      },
      ok: false,
      requestedAt,
      schemaVersion: JSON_SCHEMA_VERSION
    };

    writeJson(runtime, envelope);
    return;
  }

  runtime.writeStderr(`${error.message}\n`);
};

export const runCommand = async <TData>(
  commandName: string,
  options: OutputOptions,
  runtime: CommandRuntime,
  handler: () => Promise<TData>,
  formatText: (data: TData) => string
): Promise<void> => {
  const requestedAt = new Date().toISOString();
  let outputMode: OutputMode = options.json ? "json" : runtime.stdoutIsTTY ? "text" : "json";

  try {
    outputMode = getOutputMode(options, runtime);
    const data = await handler();
    const envelope: SuccessEnvelope<TData> = {
      command: commandName,
      data,
      ok: true,
      requestedAt,
      schemaVersion: JSON_SCHEMA_VERSION
    };

    if (outputMode === "json") {
      writeJson(runtime, envelope);
      return;
    }

    runtime.writeStdout(`${formatText(data)}\n`);
  } catch (error) {
    const appError = toAppError(error);

    process.exitCode = appError.exitCode;
    writeCommandError(commandName, appError, requestedAt, outputMode, runtime);
  }
};
