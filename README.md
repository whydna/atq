# atq

A task queue for agentic workloads.

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
cat companies.txt | atq -p "Find the current CEO of this company. Return their full name." -c 10
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


| Short | Long              | Required | Default | Description                   |
| ----- | ----------------- | -------- | ------- | ----------------------------- |
| `-p`  | `--prompt`        | yes      | —       | Instructions for the agent    |
| `-c`  | `--concurrency`   | no       | `10`    | Max parallel agents           |
| `-m`  | `--model`         | no       | —       | Model name                    |
| `-k`  | `--api-key`       | no       | —       | Anthropic API key             |
| `-t`  | `--allowed-tools` | no       | —       | Comma-separated list of tools |


## Examples

### Clean song titles

```bash
cat songs.txt | atq -p "Clean the song title. Remove featured artists, extra tags like (Official Video), remaster notes, etc. Return just the clean song title." -c 10
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
cat companies.txt | atq -c 5 --allowed-tools WebSearch -p "Find the current CEO of this company. Return their full name."
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
cat ids.txt | atq -c 5 --allowed-tools WebSearch -p "You have a sqlite db at mydb.db. For the given id:
1. Look up the company name from the companies table
2. Search the web for their most recent funding round
3. Download their logo and save it to ./logos/<id>.png
4. Update the company row with last_round, amount, and logo_path"
```

Input:

```
1
2
3
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

| Option         | Type       | Default | Description                      |
| -------------- | ---------- | ------- | -------------------------------- |
| `prompt`       | `string`   | —       | Instructions for the agent       |
| `concurrency`  | `number`   | `10`    | Max parallel agents              |
| `items`        | `array`    | `[]`    | Items to process                 |
| `model`        | `string`   | —       | Model name                       |
| `apiKey`       | `string`   | —       | Anthropic API key                |
| `allowedTools` | `string[]` | —       | Tools the agent can use          |

### `.run()`

Async generator. Each yield: `{ item, output, progress: { completed, total } }`

