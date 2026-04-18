import type { Command } from "commander";
import { describe, expect, it } from "vitest";

import { buildCli } from "../src/buildCli.js";

import type { CliDependencies } from "../src/buildCli.js";
import type { ParliamentClient } from "../src/lib/parliamentClient.js";

const notImplemented = (name: string): never => {
  throw new Error(`${name} was not mocked.`);
};

const createStubClient = (overrides: Partial<ParliamentClient> = {}): ParliamentClient => ({
  getBill: async () => notImplemented("getBill"),
  getDivision: async () => notImplemented("getDivision"),
  getDivisionSearchTotal: async () => notImplemented("getDivisionSearchTotal"),
  getMember: async () => notImplemented("getMember"),
  getQuestion: async () => notImplemented("getQuestion"),
  searchBills: async () => notImplemented("searchBills"),
  searchDivisions: async () => notImplemented("searchDivisions"),
  searchMembers: async () => notImplemented("searchMembers"),
  searchQuestions: async () => notImplemented("searchQuestions"),
  ...overrides
});

const applyExitOverrideRecursively = (command: Command): void => {
  command.exitOverride();
  command.commands.forEach((subcommand) => {
    applyExitOverrideRecursively(subcommand);
  });
};

const runCli = async (
  args: string[],
  dependencies: Partial<CliDependencies> = {}
): Promise<{ exitCode: number; stderr: string; stdout: string }> => {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const cliDependencies: CliDependencies = {
    client: dependencies.client ?? createStubClient(),
    runtime: {
      fetchImplementation: fetch,
      stdoutIsTTY: dependencies.runtime?.stdoutIsTTY ?? false,
      writeStderr: (text) => {
        stderrChunks.push(text);
      },
      writeStdout: (text) => {
        stdoutChunks.push(text);
      }
    }
  };
  const previousExitCode = process.exitCode;

  process.exitCode = undefined;

  try {
    const cli = buildCli(cliDependencies);
    applyExitOverrideRecursively(cli);

    try {
      await cli.parseAsync(args, {
        from: "user"
      });
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error)) {
        throw error;
      }
    }

    return {
      exitCode: process.exitCode ?? 0,
      stderr: stderrChunks.join(""),
      stdout: stdoutChunks.join("")
    };
  } finally {
    process.exitCode = previousExitCode;
  }
};

describe("parliament cli", () => {
  it("gets a bill by id", async () => {
    const result = await runCli(["bill", "3973", "--json"], {
      client: createStubClient({
        getBill: async () => ({
          billId: 3973,
          currentHouse: "Commons",
          currentStage: {
            description: "2nd reading"
          },
          isAct: false,
          isDefeated: false,
          lastUpdate: "2025-09-16T17:08:18.2184786",
          shortTitle: "A34 Slip Road Safety (East Ilsley and Beedon) Bill"
        })
      })
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: "bill",
      data: {
        bill: {
          billId: 3973,
          shortTitle: "A34 Slip Road Safety (East Ilsley and Beedon) Bill"
        },
        resolved: {
          billId: 3973
        }
      },
      ok: true
    });
  });

  it("returns ambiguous member errors with structured json", async () => {
    const result = await runCli(["member", "smith", "--json"], {
      client: createStubClient({
        searchMembers: async () => ({
          items: [
            {
              value: {
                id: 1,
                latestHouseMembership: {
                  house: "Commons"
                },
                latestParty: {
                  name: "Labour"
                },
                nameDisplayAs: "Mr Smith",
                nameFullTitle: "Mr Smith",
                thumbnailUrl: null
              }
            },
            {
              value: {
                id: 2,
                latestHouseMembership: {
                  house: "Commons"
                },
                latestParty: {
                  name: "Conservative"
                },
                nameDisplayAs: "Sir Smith",
                nameFullTitle: "Sir Smith",
                thumbnailUrl: null
              }
            }
          ]
        })
      })
    });

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: "member",
      error: {
        code: "AMBIGUOUS_QUERY"
      },
      ok: false
    });
  });

  it("searches bills with pagination envelope", async () => {
    const result = await runCli(["search", "bills", "budget", "--json"], {
      client: createStubClient({
        searchBills: async () => ({
          items: [
            {
              billId: 1,
              currentHouse: "Commons",
              currentStage: {
                description: "2nd reading"
              },
              isAct: false,
              isDefeated: false,
              lastUpdate: "2026-04-01T00:00:00Z",
              shortTitle: "Budget Responsibility Bill"
            }
          ],
          totalResults: 12
        })
      })
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: "search-bills",
      data: {
        input: {
          query: "budget",
          skip: 0,
          take: 10
        },
        pagination: {
          returnedCount: 1,
          totalResults: 12
        },
        results: [
          {
            billId: 1,
            shortTitle: "Budget Responsibility Bill"
          }
        ]
      },
      ok: true
    });
  });

  it("defaults to json in non-tty mode", async () => {
    const result = await runCli(["questions", "1899443"], {
      client: createStubClient({
        getQuestion: async () => ({
          answerText: "answer",
          answeringBodyName: "Department for Transport",
          dateAnswered: "2026-04-17T00:00:00",
          dateTabled: "2026-04-14T00:00:00",
          house: "Commons",
          id: 1899443,
          questionText: "To ask the Secretary of State for Transport...",
          uin: "127109"
        })
      })
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as unknown;
    expect(parsed).toBeTruthy();
    expect(result.stderr).toBe("");
  });
});
