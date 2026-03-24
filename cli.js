#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { Task } from './index.js';

const { values } = parseArgs({
  options: {
    prompt: { type: 'string', short: 'p' },
    concurrency: { type: 'string', short: 'c' },
    model: { type: 'string', short: 'm' },
  },
});

if (!values.prompt) {
  console.error('Usage: cat items.jsonl | atq -p "..." [-c 10] [-m model]');
  process.exit(1);
}

const lines = readFileSync('/dev/stdin', 'utf8').trim().split('\n');
const items = lines.map(line => JSON.parse(line));

const task = new Task({
  systemPrompt: values.prompt,
  concurrency: values.concurrency ? parseInt(values.concurrency) : 10,
  model: values.model,
  items,
});

for await (const { item, output, progress } of task.run()) {
  process.stderr.write(`[${progress.completed}/${progress.total}]\n`);
  console.log(JSON.stringify({ item, output }));
}
