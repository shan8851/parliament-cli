# 🏛️ parliament-cli

[![npm version](https://img.shields.io/npm/v/@shan8851/parliament-cli.svg)](https://www.npmjs.com/package/@shan8851/parliament-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)

UK Parliament in your terminal. Built for AI agents, still pleasant for humans.

- Website: https://www.parliment-cli.xyz
- npm: https://www.npmjs.com/package/@shan8851/parliament-cli
- UI repo: https://github.com/shan8851/parliament-cli-ui

```bash
parliament bill 3973
parliament bill "renters rights"
parliament search bills "energy"
parliament member "Keir Starmer"
parliament divisions "budget"
parliament votes 2211
parliament questions "transport"
```

## Install

```bash
npm install -g @shan8851/parliament-cli
```

## Auth

**No API key or auth required.** `parliament-cli` uses public UK Parliament endpoints by default.

Or from source:

```bash
git clone https://github.com/shan8851/parliament-cli.git
cd parliament-cli
npm install && npm run build
npm link
```

## Commands

- `parliament bill <query-or-id>`
- `parliament search bills <query>`
- `parliament divisions <query-or-id>`
- `parliament votes <query-or-id>` (alias of `divisions`)
- `parliament member <query-or-id>`
- `parliament questions <query-or-id>`

## Agent Integration

The CLI defaults to **text in a TTY** and **JSON when piped**.

```bash
parliament bill "renters rights" --json
parliament search bills budget | jq
```

All responses use a stable envelope:

```json
{
  "ok": true,
  "schemaVersion": "1",
  "command": "bill",
  "requestedAt": "2026-04-19T00:00:00.000Z",
  "data": { ... }
}
```

Errors return `ok: false` with `error.code`, `error.message`, and `error.retryable`.

## Ambiguous queries

When a text query matches multiple records, the CLI returns an `AMBIGUOUS_QUERY` error and candidate hints in `error.details`.

## Official data sources

- Bills API: https://bills-api.parliament.uk/
- Members API: https://members-api.parliament.uk/
- Written Questions API: https://questions-statements-api.parliament.uk/
- Commons Votes API: https://commonsvotes-api.parliament.uk/
- Developer hub: https://developer.parliament.uk/

## Dev

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

## License

MIT
