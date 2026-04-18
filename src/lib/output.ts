import type { Command } from "commander";

import { JSON_SCHEMA_VERSION } from "./constants.js";
import { createAppError, toAppError } from "./errors.js";

import type { CommandRuntime, ErrorEnvelope, OutputMode, OutputOptions, SuccessEnvelope } from "../types.js";

const writeJson = (runtime: CommandRuntime, value: unknown): void => {
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

export const runCommand = async <TData>(
  commandName: string,
  options: OutputOptions,
  runtime: CommandRuntime,
  handler: () => Promise<TData>,
  formatText: (data: TData) => string
): Promise<void> => {
  const requestedAt = new Date().toISOString();
  const outputMode = getOutputMode(options, runtime);

  try {
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
    const envelope: ErrorEnvelope = {
      command: commandName,
      error: {
        code: appError.code,
        ...(appError.details === undefined ? {} : { details: appError.details }),
        message: appError.message,
        retryable: appError.retryable
      },
      ok: false,
      requestedAt,
      schemaVersion: JSON_SCHEMA_VERSION
    };

    process.exitCode = appError.exitCode;

    if (outputMode === "json") {
      writeJson(runtime, envelope);
      return;
    }

    runtime.writeStderr(`${appError.message}\n`);
  }
};
