import { query } from '@anthropic-ai/claude-agent-sdk';

export class Task {
  constructor({ prompt, concurrency = 10, items = [], model, apiKey, allowedTools }) {
    this.prompt = prompt;
    this.concurrency = concurrency;
    this.model = model;
    this.apiKey = apiKey;
    this.allowedTools = allowedTools;
    this.items = [...items];
  }

  add(item) {
    this.items.push(item);
  }

  async *run() {
    const total = this.items.length;
    if (total === 0) return;

    const prompt = this.prompt || '';

    let completed = 0;
    let next = 0;
    let running = 0;
    let nextEmit = 0;

    const results = new Map();
    const buffer = [];
    let waiting = null;

    const tryFlush = () => {
      while (results.has(nextEmit)) {
        const result = results.get(nextEmit);
        results.delete(nextEmit);
        nextEmit++;
        if (waiting) { const r = waiting; waiting = null; r(result); }
        else buffer.push(result);
      }
    };

    const pull = () => {
      if (buffer.length > 0) return Promise.resolve(buffer.shift());
      return new Promise(r => { waiting = r; });
    };

    const exec = async (item) => {
      const options = {
        systemPrompt: prompt,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
      };
      if (this.model) options.model = this.model;
      if (this.apiKey) options.apiKey = this.apiKey;
      options.allowedTools = this.allowedTools || ['*'];
      let result = '';
      for await (const msg of query({ prompt: typeof item === 'string' ? item : JSON.stringify(item), options })) {
        if (msg.type === 'result' && msg.subtype === 'success') result = msg.result;
      }
      return result.trim();
    };

    const fill = () => {
      while (next < total && running < this.concurrency) {
        const idx = next;
        const item = this.items[next++];
        running++;
        exec(item).then(raw => {
          running--;
          completed++;
          results.set(idx, { item, output: raw, progress: { completed, total } });
          tryFlush();
          fill();
        });
      }
    };

    fill();

    while (nextEmit < total || buffer.length > 0) {
      yield await pull();
    }
  }
}
