#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { Task } from './index.js';

const { values } = parseArgs({
  options: {
    prompt: { type: 'string', short: 'p' },
    input: { type: 'string', short: 'i' },
    concurrency: { type: 'string', short: 'c' },
    model: { type: 'string', short: 'm' },
  },
});

if (!values.prompt || !values.input) {
  console.error('Usage: atq -p "..." -i items.jsonl [-c 10] [-m model]');
  process.exit(1);
}

const lines = readFileSync(values.input, 'utf8').trim().split('\n');
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
