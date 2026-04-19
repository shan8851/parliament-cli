import type { Command } from "commander";

import { parseNonNegativeInteger, parsePositiveInteger } from "../lib/commandUtils.js";
import { DEFAULT_PAGE_SIZE } from "../lib/constants.js";
import { toBillSummary } from "../lib/normalize.js";
import { runCommand, withGlobalOutputOptions } from "../lib/output.js";
import { normalizeRequiredQuery } from "../lib/resolve.js";

import type { CliDependencies } from "../buildCli.js";
import type { BillSummary, PaginationMeta } from "../types.js";

type SearchBillsOptions = {
  json?: boolean;
  skip?: number;
  take?: number;
  text?: boolean;
};

interface SearchBillsData {
  input: {
    query: string;
    skip: number;
    take: number;
  };
  pagination: PaginationMeta;
  results: BillSummary[];
}

export const registerSearchBillsCommand = (
  searchCommand: Command,
  dependencies: CliDependencies
): void => {
  searchCommand
    .command("bills <query>")
    .description("Search bills by title.")
    .option("--take <number>", "Results per page (default 10).", parsePositiveInteger, DEFAULT_PAGE_SIZE)
    .option("--skip <number>", "Rows to skip (default 0).", parseNonNegativeInteger, 0)
    .option("--json", "Force JSON output")
    .option("--text", "Force text output")
    .addHelpText(
      "after",
      "\nExamples:\n  parliament search bills \"renters rights\"\n  parliament search bills budget --take 5"
    )
    .action(async (query: string, options: SearchBillsOptions, command: Command) => {
      await runCommand(
        "search-bills",
        withGlobalOutputOptions(command, options),
        dependencies.runtime,
        async (): Promise<SearchBillsData> => {
          const normalizedQuery = normalizeRequiredQuery(query);
          const take = options.take ?? DEFAULT_PAGE_SIZE;
          const skip = options.skip ?? 0;
          const result = await dependencies.client.searchBills({
            searchTerm: normalizedQuery,
            skip,
            take
          });
          const summaries = result.items.map(toBillSummary);
          const totalResults = result.totalResults ?? null;

          return {
            input: {
              query: normalizedQuery,
              skip,
              take
            },
            pagination: {
              fetchedAll: false,
              itemsPerPage: take,
              returnedCount: summaries.length,
              startIndex: skip,
              totalResults
            },
            results: summaries
          };
        },
        (data) => {
          if (data.results.length === 0) {
            return `No bills found for "${data.input.query}".`;
          }

          return [
            `Bills for "${data.input.query}" (${data.results.length}${
              data.pagination.totalResults === null ? "" : `/${data.pagination.totalResults}`
            })`,
            ...data.results.map(
              (item) =>
                `- ${item.billId}: ${item.shortTitle} (${item.currentHouse ?? "Unknown House"}, ${item.currentStage ?? "Stage unknown"})`
            )
          ].join("\n");
        }
      );
    });
};
