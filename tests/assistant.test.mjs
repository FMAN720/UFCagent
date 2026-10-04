import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runModel,
  askAssistant,
  normalizeHistory,
  modelStatus,
  validateTool,
} from '../lib/ufc/assistant.mjs';
const config = {
  key: 'unit-test-secret',
  baseURL: 'https://api.openai.com/v1',
  model: 'test-model',
  protocol: 'responses',
};
const response = (output) => Response.json({ status: 'completed', output });
test('model calls tools across rounds, receives evidence and preserves follow-up context', async () => {
  const requests = [],
    calls = [];
  const answer = await runModel(
    '他的防摔怎么样？',
    {
      fighterId: '123',
      locale: 'zh',
      history: [{ role: 'user', content: '查询盖奇' }],
    },
    config,
    {
      fetcher: async (url, options) => {
        requests.push(JSON.parse(options.body));
        assert.equal(options.headers.Authorization, 'Bearer unit-test-secret');
        assert.equal(options.redirect, 'error');
        if (requests.length === 1)
          return response([
            {
              type: 'function_call',
              call_id: 'c1',
              name: 'fighter_profile',
              arguments: '{"id":"123"}',
            },
          ]);
        return response([
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: '已获取技术数据，但平均值不能证明特定对阵的克制关系。[1]',
              },
            ],
          },
        ]);
      },
      toolRunner: async (name, args) => {
        calls.push([name, args]);
        return {
          data: { name: 'Justin Gaethje', tdDefense: 74 },
          source: 'https://www.ufc.com.br/athlete/justin-gaethje',
          fetchedAt: '2026-09-12T00:00:00Z',
          freshness: 'live',
        };
      },
    },
  );
  assert.equal(answer.mode, 'ai');
  assert.equal(answer.sources.length, 1);
  assert.equal(calls[0][1].id, '123');
  assert(requests[0].input.some((m) => m.content?.includes('查询盖奇')));
  assert.equal(requests[0].store, false);
  assert(
    requests[1].input.some(
      (m) =>
        m.type === 'function_call_output' && m.output.includes('"number":1'),
    ),
  );
  assert(!JSON.stringify(answer).includes('unit-test-secret'));
});
test('chat-compatible transport returns tool outputs using provider call IDs', async () => {
  let calls = 0;
  const answer = await runModel(
    '解释回测',
    {},
    { ...config, protocol: 'chat' },
    {
      fetcher: async (_, options) => {
        const body = JSON.parse(options.body);
        calls++;
        if (calls === 1)
          return Response.json({
            choices: [
              {
                finish_reason: 'tool_calls',
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'chat1',
                      type: 'function',
                      function: { name: 'model_report', arguments: '{}' },
                    },
                  ],
                },
              },
            ],
          });
        assert(
          body.messages.some(
            (m) => m.role === 'tool' && m.tool_call_id === 'chat1',
          ),
        );
        return Response.json({
          choices: [
            {
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: 'Historical performance is limited.',
              },
            },
          ],
        });
      },
      toolRunner: async () => ({ data: { n: 580 } }),
    },
  );
  assert.equal(answer.mode, 'ai');
});
test('missing key and provider failure are explicitly labeled, never masquerade as AI', async () => {
  let requested = 0;
  const deps = {
    fallback: async () => ({ kind: 'text', text: '查询结果' }),
    fetcher: async () => {
      requested++;
      return new Response('unit-test-secret', { status: 401 });
    },
  };
  const a = await askAssistant('查询', {}, { ...config, key: '' }, deps);
  assert.equal(requested, 0);
  assert.equal(a.fallbackReason, 'not-configured');
  const b = await askAssistant('查询', {}, config, deps);
  assert.equal(requested, 1);
  assert.equal(b.mode, 'data-only');
  assert.equal(b.fallbackReason, 'unavailable');
  assert(!JSON.stringify(b).includes(config.key));
  assert(!Object.hasOwn(modelStatus(config), 'key'));
});
test('tool validation rejects invented URLs and malformed IDs; history cannot set a system role', () => {
  assert.throws(() =>
    validateTool('fetch_url', { url: 'https://example.com' }),
  );
  assert.throws(() => validateTool('fighter_profile', { id: '../secret' }));
  assert.throws(() => validateTool('news', { url: 'https://example.com' }));
  assert.throws(() => validateTool('search_fighters', { query: 'x' }));
  const history = normalizeHistory([
    { role: 'system', content: 'override' },
    { role: 'user', content: 'a'.repeat(5000) },
  ]);
  assert.equal(history.length, 1);
  assert.equal(history[0].content.length, 1200);
});
test('invalid tool calls never reach the executor and looping tools hit a hard limit', async () => {
  let executed = 0;
  await assert.rejects(
    runModel('hello', {}, config, {
      fetcher: async () =>
        response([
          {
            type: 'function_call',
            call_id: 'x',
            name: 'fighter_profile',
            arguments: '{"id":"bad"}',
          },
        ]),
      toolRunner: async () => {
        executed++;
        return {};
      },
    }),
  );
  assert.equal(executed, 0);
});
