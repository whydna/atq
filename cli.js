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

const { values, positionals } = parseArgs({
  options: {
    help: { type: 'boolean', short: 'h' },
    prompt: { type: 'string', short: 'p' },
    concurrency: { type: 'string', short: 'c' },
    model: { type: 'string', short: 'm' },
    'api-key': { type: 'string', short: 'k' },
    'allowed-tools': { type: 'string', short: 't' },
  },
  allowPositionals: true,
});

if (values.help) {
  console.log(`atq — Batch process tasks across parallel AI agents.

Usage:
  cat items.txt | atq "prompt" [options]

Options:
  -p, --prompt <text>         System prompt for each agent
  -c, --concurrency <n>       Max parallel agents (default: 10)
  -m, --model <model>         Model to use
  -k, --api-key <key>         Anthropic API key
  -t, --allowed-tools <list>  Comma-separated list of allowed tools
  -h, --help                  Show this help message

Each line of stdin is processed by its own agent. Output is printed in
the same order as input, one result per line.`);
  process.exit(0);
}

const prompt = values.prompt || positionals[0];

if (!prompt) {
  console.error('Usage: cat items.txt | atq "prompt" [-c 10] [-m model] [-k api-key] [-t tools]');
  process.exit(1);
}

const input = await readStdin();
const items = input.trim().split('\n');

const task = new Task({
  prompt,
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
