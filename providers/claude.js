import { query } from '@anthropic-ai/claude-agent-sdk';

export async function* run(item, { systemPrompt, model, apiKey, allowedTools }) {
  const options = {
    systemPrompt,
    model,
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    allowedTools: allowedTools || ['*'],
  };
  if (apiKey) options.apiKey = apiKey;

  for await (const msg of query({ prompt: typeof item === 'string' ? item : JSON.stringify(item), options })) {
    const m = msg.message;
    if (msg.type === 'assistant' && m?.content) {
      for (const block of m.content) {
        if (block.type === 'text') yield { type: 'text', text: block.text };
        if (block.type === 'tool_use') yield { type: 'tool_use', name: block.name, input: block.input };
      }
    } else if (msg.type === 'result') {
      yield { type: 'result', subtype: msg.subtype === 'success' ? 'success' : 'error', result: msg.subtype === 'success' ? msg.result : msg.errors?.join('; ') || 'unknown error' };
    }
  }
}
