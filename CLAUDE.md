# atq

Batch process tasks across parallel AI agents. Built on the Claude Code SDK.

## Architecture

- `index.js` — Task class. Manages a concurrency pool of agents. Results are buffered and emitted in input order.
- `cli.js` — CLI entry point. Reads lines from stdin, passes to Task, outputs results to stdout.
- `test.js` — Integration tests using Node's built-in test runner. These make real API calls.

## Commands

- `npm test` — Run integration tests (makes real API calls, costs money)
- `npm link` — Symlink for local CLI dev

## Key decisions

- Input/output is plain text lines, not JSONL. One line in, one line out.
- Output is ordered — line N of output corresponds to line N of input, even though agents run in parallel.
- The `query` function from the Claude Code SDK is used directly. Each item gets its own fresh agent with a clean context.
