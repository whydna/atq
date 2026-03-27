const MODEL_DEFAULTS = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-5.4',
};

export class Task {
  constructor({ prompt, concurrency = 10, retries = 3, verbose = false, provider = 'anthropic', items = [], model, apiKey, allowedTools }) {
    this.prompt = prompt;
    this.concurrency = concurrency;
    this.retries = retries;
    this.verbose = verbose;
    this.provider = provider;
    this.model = model || MODEL_DEFAULTS[provider] || MODEL_DEFAULTS.anthropic;
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

    const { run: providerRun } = await import(`./providers/${this.provider}.js`);
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

    const exec = async (item, idx) => {
      const retries = this.retries;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          let result = '';
          for await (const msg of providerRun(item, { systemPrompt: prompt, model: this.model, apiKey: this.apiKey, allowedTools: this.allowedTools })) {
            if (this.verbose) {
              if (msg.type === 'text') process.stderr.write(`[${idx}] ${msg.text}\n`);
              if (msg.type === 'tool_use') process.stderr.write(`[${idx}] tool: ${msg.name}(${JSON.stringify(msg.input).slice(0, 200)})\n`);
              if (msg.type === 'result') process.stderr.write(`[${idx}] result: ${msg.subtype}\n`);
            }
            if (msg.type === 'result' && msg.subtype === 'success') result = msg.result;
          }
          return result.trim();
        } catch (e) {
          if (attempt < retries) {
            const delay = 1000 * 2 ** attempt;
            await new Promise(r => setTimeout(r, delay));
          } else {
            throw e;
          }
        }
      }
    };

    const fill = () => {
      while (next < total && running < this.concurrency) {
        const idx = next;
        const item = this.items[next++];
        running++;
        exec(item, idx).then(raw => {
          running--;
          completed++;
          results.set(idx, { item, output: raw, progress: { completed, total } });
          tryFlush();
          fill();
        }).catch(e => {
          running--;
          completed++;
          results.set(idx, { item, output: `ERROR: ${e.message}`, progress: { completed, total } });
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
