import type { Command } from "commander";

import { parseNonNegativeInteger, parsePositiveInteger } from "../lib/commandUtils.js";
import { DEFAULT_PAGE_SIZE } from "../lib/constants.js";
import { toDivisionSummary } from "../lib/normalize.js";
import { runCommand, withGlobalOutputOptions } from "../lib/output.js";
import { parseQueryOrId } from "../lib/resolve.js";

import type { CliDependencies } from "../buildCli.js";
import type { DivisionSummary, PaginationMeta } from "../types.js";

type DivisionsOptions = {
  json?: boolean;
  skip?: number;
  take?: number;
  text?: boolean;
};

interface DivisionsSearchData {
  input: {
    query: string;
    skip: number;
    take: number;
  };
  mode: "search";
  pagination: PaginationMeta;
  results: DivisionSummary[];
}

interface DivisionByIdData {
  division: DivisionSummary;
  input: {
    queryOrId: string;
  };
  mode: "id";
}

type DivisionsData = DivisionsSearchData | DivisionByIdData;

export const registerDivisionsCommand = (program: Command, dependencies: CliDependencies): void => {
  program
    .command("divisions <queryOrId>")
    .alias("votes")
    .description("Get a Commons division by id, or search divisions by term.")
    .option("--take <number>", "Results per page for search mode (default 10).", parsePositiveInteger, DEFAULT_PAGE_SIZE)
    .option("--skip <number>", "Rows to skip for search mode (default 0).", parseNonNegativeInteger, 0)
    .option("--json", "Force JSON output")
    .option("--text", "Force text output")
    .addHelpText(
      "after",
      "\nExamples:\n  parliament divisions 2211\n  parliament divisions budget\n  parliament votes immigration"
    )
    .action(async (queryOrId: string, options: DivisionsOptions, command: Command) => {
      await runCommand(
        "divisions",
        withGlobalOutputOptions(command, options),
        dependencies.runtime,
        async (): Promise<DivisionsData> => {
          const parsed = parseQueryOrId(queryOrId);

          if (parsed.id !== null) {
            const division = await dependencies.client.getDivision(parsed.id);

            return {
              division: toDivisionSummary(division),
              input: {
                queryOrId
              },
              mode: "id"
            };
          }

          const take = options.take ?? DEFAULT_PAGE_SIZE;
          const skip = options.skip ?? 0;
          const [totalResults, divisions] = await Promise.all([
            dependencies.client.getDivisionSearchTotal(parsed.query),
            dependencies.client.searchDivisions({
              searchTerm: parsed.query,
              skip,
              take
            })
          ]);
          const summaries = divisions.map(toDivisionSummary);

          return {
            input: {
              query: parsed.query,
              skip,
              take
            },
            mode: "search",
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
          if (data.mode === "id") {
            const division = data.division;

            return [
              `${division.title} (#${division.divisionId})`,
              `Date: ${division.date}`,
              `Ayes: ${division.ayeCount}`,
              `Noes: ${division.noCount}`
            ].join("\n");
          }

          if (data.results.length === 0) {
            return `No divisions found for "${data.input.query}".`;
          }

          return [
            `Divisions for "${data.input.query}" (${data.results.length}${
              data.pagination.totalResults === null ? "" : `/${data.pagination.totalResults}`
            })`,
            ...data.results.map(
              (division) =>
                `- ${division.divisionId}: ${division.title} (${division.date}, Ayes ${division.ayeCount} / Noes ${division.noCount})`
            )
          ].join("\n");
        }
      );
    });
};
