#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { Task } from './index.js';

const readStdin = () => {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
};

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
  console.error('Usage: cat items.txt | atq -p "..." [-c 10] [-m model] [-k api-key] [-t tools]');
  process.exit(1);
}

const input = await readStdin();
const items = input.trim().split('\n');

const task = new Task({
  prompt: values.prompt,
  concurrency: values.concurrency ? parseInt(values.concurrency) : 10,
  model: values.model,
  apiKey: values['api-key'],
  allowedTools: values['allowed-tools'] ? values['allowed-tools'].split(',') : undefined,
  items,
});

for await (const { output, progress } of task.run()) {
  process.stderr.write(`[${progress.completed}/${progress.total}]\n`);
  console.log(output);
}
