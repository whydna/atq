# atq

[![npm](https://img.shields.io/npm/v/@endyai/atq?color=brightgreen)](https://www.npmjs.com/package/@endyai/atq)
[![license](https://img.shields.io/npm/l/@endyai/atq)](https://github.com/whydna/atq)

Batch process tasks using agents in parallel.

## The problem

You have a large batch of tasks that need to be processed using an LLM agent (language/reasoning/tool use tasks).

Running these through a single long-lived agent doesn't work:

- Agents usually want to write a script to process batch tasks - rather than reason through each one.
- **Context bloat.** The agent accumulates results from previous tasks. Gets slower, more expensive, less focused.
- **Fragile batching.** One failure midway can stall everything. Tracking what succeeded is painful.
- **No concurrency.** Processing items one at a time when each task is independent is just slow.

## The approach

Isolate each with a clean context. A pool of agents process them in parallel.

- **Fresh context per task.** Each agent only sees the item it's working on. Better focus, lower cost.
- **Concurrent by default.** Control the pool size with `concurrency`.
- **Stream results.** Results stream to stdout as agents complete.

## CLI

```
npm install -g @endyai/atq
```

```bash
cat companies.txt | atq "Find the current CEO of this company. Return their full name." -c 10
```

Input is piped via stdin (one line per item):

```
Apple
Google
Meta
```

**Output** (stdout, one line per item, in input order):

```
Tim Cook
Sundar Pichai
Mark Zuckerberg
```

**Progress** (stderr):

```
[1/3]
[2/3]
[3/3]
```

### Flags

| Short | Long              | Required | Default              | Description                                           |
| ----- | ----------------- | -------- | -------------------- | ----------------------------------------------------- |
| `-f`  | `--prompt-file`   | —        | —                    | Read prompt from a file                               |
| `-c`  | `--concurrency`   | no       | `10`                 | Max parallel agents                                   |
| `-p`  | `--provider`      | no       | `anthropic`             | Provider: `anthropic` or `openai`                        |
| `-m`  | `--model`         | no       | per provider         | Model name                                            |
| `-k`  | `--api-key`       | no       | —                    | API key (or set `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`) |
| `-r`  | `--retries`       | no       | `3`                  | Max retries per failed item (exponential backoff)     |
| `-v`  | `--verbose`       | no       | —                    | Print agent messages to stderr                        |
| `-t`  | `--allowed-tools` | no       | —                    | Comma-separated list of tools                         |

Prompt is passed as a positional argument or via `--prompt-file`.

### Providers

Supports **Anthropic** and **OpenAI** agents. Set with `--provider` or it defaults to `anthropic`.

| Provider | Default model        | SDK                          |
| -------- | -------------------- | ---------------------------- |
| `anthropic` | `claude-sonnet-4-6`  | `@anthropic-ai/claude-agent-sdk` |
| `openai` | `gpt-5.4`           | `@openai/agents`             |


## Examples

### Clean song titles

```bash
cat songs.txt | atq "Clean the song title. Remove featured artists, extra tags like (Official Video), remaster notes, etc. Return just the clean song title." -c 10
```

Input:

```
Bohemian Rhapsody (Remastered 2011)
Blinding Lights (feat. Doja Cat) [Official Video]
Hotel California - 2013 Remaster
```

Output:

```
Bohemian Rhapsody
Blinding Lights
Hotel California
```

### Find CEO with web search

```bash
cat companies.txt | atq "Find the current CEO of this company. Return their full name." -c 5 -t WebSearch
```

Input:

```
Rivian
Figma
Stripe
```

Output:

```
RJ Scaringe
Dylan Field
Patrick Collison
```

### Research & enrich a database

```bash
cat ids.txt | atq "You have a sqlite db at mydb.db. For the given id:
1. Look up the company name from the companies table
2. Search the web for their most recent funding round
3. Download their logo and save it to ./logos/<id>.png
4. Update the company row with last_round, amount, and logo_path" -c 5 -t WebSearch
```

Input:

```
a1b2c3d4
e5f6g7h8
i9j0k1l2
```

Output:

```
Rippling → Series F, $200M, logo saved
Vercel → Series E, $250M, logo saved
Cursor → Series B, $105M, logo saved
```

## SDK

If you need to run atq programmatically from your own code:

```
npm install @endyai/atq
```

```js
import { Task } from '@endyai/atq';

const task = new Task({
  prompt: 'Find the current CEO of this company. Return their full name.',
  concurrency: 10,
  items: ['Apple', 'Google', 'Meta'],
});

for await (const { item, output, progress } of task.run()) {
  console.log(`[${progress.completed}/${progress.total}] ${item} → ${output}`);
}
```

### `new Task(options)`

| Option         | Type       | Default              | Description                      |
| -------------- | ---------- | -------------------- | -------------------------------- |
| `prompt`       | `string`   | —                    | Instructions for the agent       |
| `concurrency`  | `number`   | `10`                 | Max parallel agents              |
| `retries`      | `number`   | `3`                  | Max retries per failed item      |
| `verbose`      | `boolean`  | `false`              | Print agent messages to stderr   |
| `provider`     | `string`   | `'claude'`           | `'claude'` or `'openai'`        |
| `items`        | `array`    | `[]`                 | Items to process                 |
| `model`        | `string`   | per provider         | Model name                       |
| `apiKey`       | `string`   | —                    | API key for the provider         |
| `allowedTools` | `string[]` | —                    | Tools the agent can use          |

### `.run()`

Async generator. Each yield: `{ item, output, progress: { completed, total } }`

