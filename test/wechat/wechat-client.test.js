const assert = require('node:assert/strict');
const test = require('node:test');

const { WeChatClient, WeChatApiError } = require('../../tools/wechat/wechat-client');

test('WeChatClient fetches and caches access token', async () => {
  const calls = [];
  const client = new WeChatClient({
    appId: 'APP',
    appSecret: 'SECRET',
    fetchImpl: async (url) => {
      calls.push(url);
      return {
        ok: true,
        json: async () => ({ access_token: 'TOKEN', expires_in: 7200 })
      };
    }
  });

  assert.equal(await client.getAccessToken(), 'TOKEN');
  assert.equal(await client.getAccessToken(), 'TOKEN');
  assert.equal(calls.length, 1);
});

test('WeChatClient throws readable API errors', async () => {
  const client = new WeChatClient({
    appId: 'APP',
    appSecret: 'SECRET',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ errcode: 40164, errmsg: 'invalid ip' })
    })
  });

  await assert.rejects(
    () => client.getAccessToken(),
    (error) => error instanceof WeChatApiError && /40164/.test(error.message)
  );
});
