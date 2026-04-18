import type { Command } from "commander";

import { toMemberSummary } from "../lib/normalize.js";
import { runCommand, withGlobalOutputOptions } from "../lib/output.js";
import { parseQueryOrId, resolveMemberFromCandidates } from "../lib/resolve.js";

import type { CliDependencies } from "../buildCli.js";
import type { MemberSummary } from "../types.js";

type MemberCommandOptions = {
  json?: boolean;
  text?: boolean;
};

interface MemberCommandData {
  input: {
    queryOrId: string;
  };
  member: MemberSummary;
  resolved: {
    memberId: number;
  };
}

export const registerMemberCommand = (program: Command, dependencies: CliDependencies): void => {
  program
    .command("member <queryOrId>")
    .description("Get a member by id, or resolve a member name to a single match.")
    .option("--json", "Force JSON output")
    .option("--text", "Force text output")
    .addHelpText(
      "after",
      "\nExamples:\n  parliament member 172\n  parliament member \"Keir Starmer\""
    )
    .action(async (queryOrId: string, options: MemberCommandOptions, command: Command) => {
      await runCommand(
        "member",
        withGlobalOutputOptions(command, options),
        dependencies.runtime,
        async (): Promise<MemberCommandData> => {
          const parsed = parseQueryOrId(queryOrId);

          if (parsed.id !== null) {
            const member = await dependencies.client.getMember(parsed.id);

            return {
              input: {
                queryOrId
              },
              member: toMemberSummary(member),
              resolved: {
                memberId: member.id
              }
            };
          }

          const searchResult = await dependencies.client.searchMembers({
            name: parsed.query,
            skip: 0,
            take: 20
          });
          const candidates = searchResult.items.map((item) => toMemberSummary(item.value));
          const resolved = resolveMemberFromCandidates(parsed.query, candidates);
          const member = await dependencies.client.getMember(resolved.id);

          return {
            input: {
              queryOrId
            },
            member: toMemberSummary(member),
            resolved: {
              memberId: member.id
            }
          };
        },
        (data) =>
          [
            `${data.member.nameDisplayAs} (#${data.member.id})`,
            `Party: ${data.member.party ?? "Unknown"}`,
            `House: ${data.member.house ?? "Unknown"}`,
            ...(data.member.nameFullTitle === null ? [] : [`Title: ${data.member.nameFullTitle}`])
          ].join("\n")
      );
    });
};
