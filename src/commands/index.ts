import type { Command } from "commander";

import { registerBillCommand } from "./billCommand.js";
import { registerDivisionsCommand } from "./divisionsCommand.js";
import { registerMemberCommand } from "./memberCommand.js";
import { registerQuestionsCommand } from "./questionsCommand.js";
import { registerSearchBillsCommand } from "./searchBillsCommand.js";

import type { CliDependencies } from "../buildCli.js";

export const registerCommands = (program: Command, dependencies: CliDependencies): void => {
  registerBillCommand(program, dependencies);
  registerDivisionsCommand(program, dependencies);
  registerMemberCommand(program, dependencies);
  registerQuestionsCommand(program, dependencies);

  const searchCommand = program.command("search").description("Search Parliament datasets.");

  registerSearchBillsCommand(searchCommand, dependencies);
};
