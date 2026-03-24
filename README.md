# atq

A task queue for agentic workloads.

## The problem

You have a large batch of tasks that need to be processed using an agent (language, reasoning, tool use tasks).

Running these through a single long-lived agent doesn't work:

- **Context bloat.** The agent accumulates results from previous tasks. Gets slower, more expensive, less focused.
- **Fragile batching.** One failure midway can stall everything. Tracking what succeeded is painful.
- **No concurrency.** Processing items one at a time when each task is independent is just slow.

## The approach

Each task gets its own fresh agent with a clean context. A pool of agents process items concurrently — one finishes, the next starts immediately.

- **Fresh context per task.** Each agent only sees the item it's working on. Better focus, lower cost, no cross-contamination.
- **Concurrent by default.** Control the pool size with `concurrency`.
- **Stream results.** Results stream to stdout as agents complete.

## CLI

```
npm install -g @endyai/atq
```

```bash
cat companies.jsonl | atq -p "Find the current CEO of this company. Return their full name." -c 10
```

Input is piped via stdin (one JSON object per line):

```jsonl
{"company": "Apple"}
{"company": "Google"}
{"company": "Meta"}
```

**Output** (stdout, one JSON line per completed item):

```jsonl
{"item":{"company":"Apple"},"output":"Tim Cook"}
{"item":{"company":"Google"},"output":"Sundar Pichai"}
{"item":{"company":"Meta"},"output":"Mark Zuckerberg"}
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


## SDK

```
npm install @endyai/atq
```

```js
import { Task } from '@endyai/atq';

const task = new Task({
  prompt: 'Find the current CEO of this company. Return just their full name.',
  concurrency: 10,
  items: [{ company: 'Apple' }, { company: 'Google' }, { company: 'Meta' }],
});

for await (const { item, output, progress } of task.run()) {
  console.log(`[${progress.completed}/${progress.total}] ${item.company} → ${output}`);
}
```

### `new Task(options)`


| Option         | Type       | Default | Description                      |
| -------------- | ---------- | ------- | -------------------------------- |
| `prompt`       | `string`   | —       | Instructions for the agent       |
| `concurrency`  | `number`   | `10`    | Max parallel agents              |
| `items`        | `array`    | `[]`    | Items to pre-load into the queue |
| `model`        | `string`   | —       | Model name                       |
| `apiKey`       | `string`   | —       | Anthropic API key                |
| `allowedTools` | `string[]` | —       | Tools the agent can use          |


### `.add(item)`

Add an item to the queue.

### `.run()`

Async generator. Each yield: `{ item, output, progress: { completed, total } }`

## Examples

### Clean song titles

```bash
cat songs.jsonl | atq -p "Clean the song title. Remove featured artists, extra tags like (Official Video), remaster notes, etc. Return just the clean song title." -c 10
```

Input:

```jsonl
{"title": "Bohemian Rhapsody (Remastered 2011)"}
{"title": "Blinding Lights (feat. Doja Cat) [Official Video]"}
{"title": "Hotel California - 2013 Remaster"}
```

Output:

```jsonl
{"item":{"title":"Bohemian Rhapsody (Remastered 2011)"},"output":"Bohemian Rhapsody"}
{"item":{"title":"Blinding Lights (feat. Doja Cat) [Official Video]"},"output":"Blinding Lights"}
{"item":{"title":"Hotel California - 2013 Remaster"},"output":"Hotel California"}
```

### Find CEO with web search

```bash
cat companies.jsonl | atq -c 5 --allowed-tools WebSearch -p "Find the current CEO of this company. Return their full name."
```

Input:

```jsonl
{"company": "Rivian"}
{"company": "Figma"}
{"company": "Stripe"}
```

Output:

```jsonl
{"item":{"company":"Rivian"},"output":"RJ Scaringe"}
{"item":{"company":"Figma"},"output":"Dylan Field"}
{"item":{"company":"Stripe"},"output":"Patrick Collison"}
```

### Research & enrich a database

```bash
cat ids.jsonl | atq -c 5 --allowed-tools WebSearch -p "You have a sqlite db at mydb.db. For the given id:
1. Look up the company name from the companies table
2. Search the web for their most recent funding round
3. Download their logo and save it to ./logos/<id>.png
4. Update the company row with last_round, amount, and logo_path"
```

Input:

```jsonl
{"id": 1}
{"id": 2}
{"id": 3}
```

Output:

```jsonl
{"item":{"id":1},"output":"Rippling → Series F, $200M, logo saved"}
{"item":{"id":2},"output":"Vercel → Series E, $250M, logo saved"}
{"item":{"id":3},"output":"Cursor → Series B, $105M, logo saved"}
```

