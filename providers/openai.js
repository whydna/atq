import { Agent, run as runAgent, shellTool } from '@openai/agents';
import { execSync } from 'node:child_process';

const localShell = {
  async run(action) {
    const output = [];
    for (const cmd of action.commands) {
      try {
        const stdout = execSync(cmd, { encoding: 'utf8', timeout: action.timeoutMs || 30000 });
        output.push({ type: 'text', text: stdout });
      } catch (e) {
        output.push({ type: 'text', text: e.stderr || e.message });
      }
    }
    return { output };
  },
};

export async function* run(item, { systemPrompt, model, apiKey, allowedTools }) {
  if (apiKey) process.env.OPENAI_API_KEY = apiKey;

  const agent = new Agent({
    name: 'atq-worker',
    instructions: systemPrompt || '',
    model: model || 'gpt-5.4',
    tools: [shellTool({ shell: localShell })],
  });

  const input = typeof item === 'string' ? item : JSON.stringify(item);

  const result = await runAgent(agent, input, { stream: true });

  for await (const event of result) {
    if (event.type === 'run_item_stream_event') {
      if (event.name === 'message_output_created') {
        const text = event.item?.rawItem?.content?.map(c => c.text).filter(Boolean).join('') || '';
        if (text) yield { type: 'text', text };
      } else if (event.name === 'tool_called') {
        const raw = event.item?.rawItem;
        const name = raw?.type === 'shell_call' ? 'shell' : raw?.name || raw?.type || 'tool';
        yield { type: 'tool_use', name, input: raw?.action || raw?.arguments || {} };
      }
    }
  }

  const finalOutput = result.finalOutput || '';
  yield { type: 'result', subtype: 'success', result: typeof finalOutput === 'string' ? finalOutput : JSON.stringify(finalOutput) };
}
