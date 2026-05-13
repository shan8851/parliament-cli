import { describe, expect, it, vi } from "vitest";

import { createDependencies, type CliDependencies } from "../src/buildCli.js";
import { runCli as executeCli } from "../src/cli.js";

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

const createJsonResponse = (value: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(value), {
    headers: {
      "content-type": "application/json"
    },
    status: 200,
    ...init
  });

const toFetchUrl = (input: { url: string } | string | URL): string => {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
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
      fetchImplementation: dependencies.runtime?.fetchImplementation ?? fetch,
      stdoutIsTTY: dependencies.runtime?.stdoutIsTTY ?? false,
      writeStderr: (text) => {
        stderrChunks.push(text);
      },
      writeStdout: (text) => {
        stdoutChunks.push(text);
      }
    }
  };
  const exitCode = await executeCli(args, cliDependencies);

  return {
    exitCode,
    stderr: stderrChunks.join(""),
    stdout: stdoutChunks.join("")
  };
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

  it("maps numeric house codes to human-readable house labels", async () => {
    const result = await runCli(["member", "4514", "--json"], {
      client: createStubClient({
        getMember: async () => ({
          id: 4514,
          latestHouseMembership: {
            house: 1
          },
          latestParty: {
            name: "Labour"
          },
          nameDisplayAs: "Sir Keir Starmer",
          nameFullTitle: "Rt Hon Sir Keir Starmer MP",
          thumbnailUrl: "https://members-api.parliament.uk/api/Members/4514/Thumbnail"
        })
      })
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: "member",
      data: {
        member: {
          house: "Commons",
          id: 4514
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

  it("returns structured json for missing required arguments in json mode", async () => {
    const result = await runCli(["bill", "--json"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: "bill",
      error: {
        code: "INVALID_INPUT",
        message: "missing required argument 'queryOrId'",
        retryable: false
      },
      ok: false
    });
  });

  it("returns structured json for conflicting output flags", async () => {
    const result = await runCli(["bill", "3973", "--json", "--text"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: "bill",
      error: {
        code: "INVALID_INPUT",
        message: "Choose either --json or --text, not both.",
        retryable: false
      },
      ok: false
    });
  });

  it("rejects whitespace-only bill search queries", async () => {
    const result = await runCli(["search", "bills", "   ", "--json"]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: "search-bills",
      error: {
        code: "INVALID_INPUT",
        message: "Query must not be empty.",
        retryable: false
      },
      ok: false
    });
  });

  it("does not write dotenv banners before successful json output", async () => {
    const stdoutWrites: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdoutWrites.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8")
      );

      return true;
    });
    const cliDependencies = createDependencies(
      async (input) => {
        const url = toFetchUrl(input);

        if (url.endsWith("/api/v1/Bills/3973")) {
          return createJsonResponse({
            billId: 3973,
            currentHouse: "Commons",
            currentStage: {
              description: "2nd reading"
            },
            isAct: false,
            isDefeated: false,
            lastUpdate: "2025-09-16T17:08:18.2184786",
            shortTitle: "A34 Slip Road Safety (East Ilsley and Beedon) Bill"
          });
        }

        throw new Error(`Unexpected fetch URL in test: ${url}`);
      },
      false
    );
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    cliDependencies.runtime.writeStdout = (text) => {
      stdoutChunks.push(text);
    };
    cliDependencies.runtime.writeStderr = (text) => {
      stderrChunks.push(text);
    };

    try {
      const exitCode = await executeCli(["bill", "3973", "--json"], cliDependencies);

      expect(exitCode).toBe(0);
      expect(stderrChunks.join("")).toBe("");
      expect(stdoutWrites.join("")).toBe("");
      expect(JSON.parse(stdoutChunks.join(""))).toMatchObject({
        command: "bill",
        data: {
          bill: {
            billId: 3973
          }
        },
        ok: true
      });
    } finally {
      writeSpy.mockRestore();
    }
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
