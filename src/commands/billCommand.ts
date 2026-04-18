import type { Command } from "commander";

import { toBillSummary } from "../lib/normalize.js";
import { runCommand, withGlobalOutputOptions } from "../lib/output.js";
import { parseQueryOrId, resolveBillFromCandidates } from "../lib/resolve.js";

import type { CliDependencies } from "../buildCli.js";
import type { BillSummary } from "../types.js";

type BillCommandOptions = {
  json?: boolean;
  text?: boolean;
};

interface BillCommandData {
  bill: BillSummary;
  input: {
    queryOrId: string;
  };
  resolved: {
    billId: number;
  };
}

export const registerBillCommand = (program: Command, dependencies: CliDependencies): void => {
  program
    .command("bill <queryOrId>")
    .description("Get a bill by id, or resolve a bill title to a single match.")
    .option("--json", "Force JSON output")
    .option("--text", "Force text output")
    .addHelpText(
      "after",
      "\nExamples:\n  parliament bill 2211\n  parliament bill \"renters rights\""
    )
    .action(async (queryOrId: string, options: BillCommandOptions, command: Command) => {
      await runCommand(
        "bill",
        withGlobalOutputOptions(command, options),
        dependencies.runtime,
        async (): Promise<BillCommandData> => {
          const parsed = parseQueryOrId(queryOrId);

          if (parsed.id !== null) {
            const bill = await dependencies.client.getBill(parsed.id);

            return {
              bill: toBillSummary(bill),
              input: {
                queryOrId
              },
              resolved: {
                billId: bill.billId
              }
            };
          }

          const searchResult = await dependencies.client.searchBills({
            searchTerm: parsed.query,
            skip: 0,
            take: 10
          });
          const candidates = searchResult.items.map(toBillSummary);
          const resolved = resolveBillFromCandidates(parsed.query, candidates);
          const bill = await dependencies.client.getBill(resolved.billId);

          return {
            bill: toBillSummary(bill),
            input: {
              queryOrId
            },
            resolved: {
              billId: bill.billId
            }
          };
        },
        (data) =>
          [
            `${data.bill.shortTitle} (#${data.bill.billId})`,
            `House: ${data.bill.currentHouse ?? "Unknown"}`,
            `Stage: ${data.bill.currentStage ?? "Unknown"}`,
            `Status: ${data.bill.isAct ? "Act" : "Bill"}${
              data.bill.isDefeated ? ", defeated" : ""
            }`,
            `Last update: ${data.bill.lastUpdate}`
          ].join("\n")
      );
    });
};
