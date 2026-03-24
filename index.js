import { spawn } from 'node:child_process';

export class Task {
  constructor({ systemPrompt, concurrency = 10, items = [], model, output }) {
    this.systemPrompt = systemPrompt;
    this.concurrency = concurrency;
    this.model = model;
    this.outputSchema = output;
    this.items = [...items];
  }

  add(item) {
    this.items.push(item);
  }

  async *run() {
    const total = this.items.length;
    if (total === 0) return;

    let systemPrompt = this.systemPrompt || '';
    if (this.outputSchema) {
      systemPrompt += '\n\nReturn your response as JSON matching this schema:\n' + JSON.stringify(this.outputSchema, null, 2);
    }

    let completed = 0;
    let next = 0;
    let running = 0;

    const buffer = [];
    let waiting = null;

    const push = (result) => {
      if (waiting) { const r = waiting; waiting = null; r(result); }
      else buffer.push(result);
    };

    const pull = () => {
      if (buffer.length > 0) return Promise.resolve(buffer.shift());
      return new Promise(r => { waiting = r; });
    };

    const exec = (item) => new Promise((resolve) => {
      const args = ['-p', JSON.stringify(item), '--output-format', 'text'];
      if (systemPrompt) args.push('--system-prompt', systemPrompt);
      if (this.model) args.push('--model', this.model);
      const proc = spawn('claude', args);
      let out = '';
      proc.stdout.on('data', d => { out += d; });
      proc.on('close', () => resolve(out.trim()));
    });

    const fill = () => {
      while (next < total && running < this.concurrency) {
        const item = this.items[next++];
        running++;
        exec(item).then(raw => {
          running--;
          completed++;
          let output;
          if (this.outputSchema) {
            try { output = JSON.parse(raw); } catch { output = raw; }
          } else {
            output = raw;
          }
          push({ item, output, progress: { completed, total } });
          fill();
        });
      }
    };

    fill();

    while (completed < total || buffer.length > 0) {
      yield await pull();
    }
  }
}
