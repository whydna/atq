# atq

A task queue for agentic workloads.

## The problem

You have a large number of tasks that each require an AI agent — classifying records, extracting data, normalizing content — anything that needs reasoning, not just an API call.

Running these through a single long-lived agent doesn't work:

- **Context bloat.** The agent accumulates results from previous tasks. Gets slower, more expensive, less focused.
- **Fragile batching.** One failure midway can stall everything. Tracking what succeeded is painful.
- **No concurrency.** Processing items one at a time when each task is independent is just slow.

## The approach

Each task gets its own fresh agent with a clean context. A pool of agents process items concurrently — one finishes, the next starts immediately.

- **Fresh context per task.** Each agent only sees the item it's working on. Better focus, lower cost, no cross-contamination.
- **Concurrent by default.** Control the pool size with `concurrency`.
- **Stream results.** Async generator yields results as agents complete. Handle them however you want.

## Usage

```js
import { Task } from 'atq';

const normalize = new Task({
  systemPrompt: `You receive a company name as JSON. Return the canonical normalized form.
For example: "Google LLC" → "Google", "APPLE INC." → "Apple"`,
  concurrency: 10,
  model: 'claude-opus-4-6',
});

for (const name of names) {
  normalize.add({ name });
}

for await (const { item, output, progress } of normalize.run()) {
  console.log(`[${progress.completed}/${progress.total}] ${item.name} → ${output}`);
}
```

### Structured output

Pass an `output` schema and results come back parsed:

```js
const extract = new Task({
  systemPrompt: 'Extract the person name and dollar amount from this contract clause.',
  concurrency: 5,
  model: 'claude-opus-4-6',
  output: { name: 'string', amount: 'string' },
  items: clauses,
});

for await (const { item, output } of extract.run()) {
  db.insert({ clause_id: item.id, name: output.name, amount: output.amount });
}
```

### Pre-loading items

```js
// pass items in the constructor
const task = new Task({ systemPrompt: '...', items: rows });

// or add them one at a time
const task = new Task({ systemPrompt: '...' });
for (const row of rows) {
  task.add(row);
}
```

## API

### `new Task(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `systemPrompt` | `string` | — | Instructions for the agent |
| `concurrency` | `number` | `10` | Max parallel agents |
| `items` | `array` | `[]` | Items to pre-load into the queue |
| `model` | `string` | — | Model name (e.g. `'claude-opus-4-6'`) |
| `output` | `object` | — | Output schema. If set, agents return JSON and results are auto-parsed |

### `.add(item)`

Add an item to the queue. Items are plain objects — they get JSON-stringified and sent as the agent's prompt.

### `.run()`

Returns an async generator. Each yield:

```js
{
  item,     // the original item
  output,   // agent response (string, or parsed object if output schema set)
  progress, // { completed, total }
}
```

## Install

```
npm install atq
```
