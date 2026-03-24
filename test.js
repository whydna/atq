import { test } from 'node:test';
import assert from 'node:assert';
import { Task } from './index.js';

test('single item returns a result', async () => {
  const task = new Task({
    prompt: 'Respond with only the word "hello". Nothing else.',
    items: ['test'],
    concurrency: 1,
  });

  const results = [];
  for await (const r of task.run()) results.push(r);

  assert.strictEqual(results.length, 1);
  assert.ok(results[0].output.toLowerCase().includes('hello'));
});

test('multiple items return in input order', async () => {
  const task = new Task({
    prompt: 'Respond with only the number I give you. Nothing else.',
    items: ['1', '2', '3'],
    concurrency: 3,
  });

  const results = [];
  for await (const r of task.run()) results.push(r);

  assert.strictEqual(results.length, 3);
  assert.ok(results[0].output.includes('1'));
  assert.ok(results[1].output.includes('2'));
  assert.ok(results[2].output.includes('3'));
});

test('progress counts are correct', async () => {
  const task = new Task({
    prompt: 'Respond with "ok".',
    items: ['a', 'b'],
    concurrency: 1,
  });

  const progress = [];
  for await (const r of task.run()) progress.push(r.progress);

  assert.strictEqual(progress.length, 2);
  assert.strictEqual(progress[progress.length - 1].completed, 2);
  assert.strictEqual(progress[progress.length - 1].total, 2);
});

test('empty items completes immediately', async () => {
  const task = new Task({
    prompt: 'test',
    items: [],
  });

  const results = [];
  for await (const r of task.run()) results.push(r);

  assert.strictEqual(results.length, 0);
});

test('concurrency processes items faster than sequential', async () => {
  const items = ['1', '2', '3', '4', '5'];

  const start1 = Date.now();
  const t1 = new Task({ prompt: 'Respond with "ok".', items: [...items], concurrency: 1 });
  for await (const _ of t1.run()) {}
  const sequential = Date.now() - start1;

  const start2 = Date.now();
  const t2 = new Task({ prompt: 'Respond with "ok".', items: [...items], concurrency: 5 });
  for await (const _ of t2.run()) {}
  const parallel = Date.now() - start2;

  console.log(`Sequential: ${sequential}ms, Parallel: ${parallel}ms`);
  assert.ok(parallel < sequential, `parallel (${parallel}ms) should be faster than sequential (${sequential}ms)`);
});
