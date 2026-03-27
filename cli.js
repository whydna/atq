#!/usr/bin/env node

import { readFileSync } from 'node:fs';
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

let values, positionals;
try {
  ({ values, positionals } = parseArgs({
    options: {
      help: { type: 'boolean', short: 'h' },
      'prompt-file': { type: 'string', short: 'f' },
      concurrency: { type: 'string', short: 'c' },
      provider: { type: 'string', short: 'p' },
      model: { type: 'string', short: 'm' },
      'api-key': { type: 'string', short: 'k' },
      retries: { type: 'string', short: 'r' },
      verbose: { type: 'boolean', short: 'v' },
      'allowed-tools': { type: 'string', short: 't' },
    },
    allowPositionals: true,
  }));
} catch (e) {
  console.error(`atq: ${e.message}`);
  process.exit(1);
}

if (values.help) {
  console.log(`atq — Batch process tasks across parallel AI agents.

Usage:
  cat items.txt | atq "prompt" [options]

Options:
  -f, --prompt-file <path>    Read prompt from a file
  -c, --concurrency <n>       Max parallel agents (default: 10)
  -p, --provider <name>       Provider: claude or openai (default: claude)
  -m, --model <model>         Model to use (default: per provider)
  -k, --api-key <key>         API key
  -r, --retries <n>           Max retries per item on failure (default: 3)
  -v, --verbose               Print agent messages to stderr
  -t, --allowed-tools <list>  Comma-separated list of allowed tools
  -h, --help                  Show this help message

Each line of stdin is processed by its own agent. Output is printed in
the same order as input, one result per line.`);
  process.exit(0);
}

const prompt = positionals[0] || (values['prompt-file'] ? readFileSync(values['prompt-file'], 'utf8').trim() : null);

if (!prompt) {
  console.error('Usage: cat items.txt | atq "prompt" [-c 10] [-m model] [-k api-key] [-t tools]');
  process.exit(1);
}

const input = await readStdin();
const items = input.trim().split('\n');

const task = new Task({
  prompt,
  concurrency: values.concurrency ? parseInt(values.concurrency) : 10,
  retries: values.retries ? parseInt(values.retries) : undefined,
  verbose: values.verbose || false,
  provider: values.provider || 'claude',
  model: values.model,
  apiKey: values['api-key'],
  allowedTools: values['allowed-tools'] ? values['allowed-tools'].split(',') : undefined,
  items,
});

for await (const { output, progress } of task.run()) {
  process.stderr.write(`[${progress.completed}/${progress.total}]\n`);
  console.log(output);
}
