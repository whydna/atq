#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { Task } from './index.js';

const { values } = parseArgs({
  options: {
    prompt: { type: 'string', short: 'p' },
    concurrency: { type: 'string', short: 'c' },
    model: { type: 'string', short: 'm' },
    'api-key': { type: 'string', short: 'k' },
    'allowed-tools': { type: 'string', short: 't' },
  },
});

if (!values.prompt) {
  console.error('Usage: cat items.jsonl | atq -p "..." [-c 10] [-m model] [-k api-key]');
  process.exit(1);
}

const lines = readFileSync('/dev/stdin', 'utf8').trim().split('\n');
const items = lines.map(line => JSON.parse(line));

const task = new Task({
  prompt: values.prompt,
  concurrency: values.concurrency ? parseInt(values.concurrency) : 10,
  model: values.model,
  apiKey: values['api-key'],
  allowedTools: values['allowed-tools'] ? values['allowed-tools'].split(',') : undefined,
  items,
});

for await (const { item, output, progress } of task.run()) {
  process.stderr.write(`[${progress.completed}/${progress.total}]\n`);
  console.log(JSON.stringify({ item, output }));
}
