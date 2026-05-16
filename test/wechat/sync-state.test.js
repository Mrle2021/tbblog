const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { loadState, saveState, upsertDraftState } = require('../../tools/wechat/sync-state');

test('loadState returns empty object when state file is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wechat-state-'));
  assert.deepEqual(loadState(path.join(dir, '.wechat-drafts.json')), {});
});

test('upsertDraftState writes draft metadata by slug', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wechat-state-'));
  const statePath = path.join(dir, '.wechat-drafts.json');

  const state = upsertDraftState({}, {
    slug: 'sample',
    post: 'source/_posts/sample.md',
    draftMediaId: 'MEDIA_ID',
    title: 'Sample'
  });
  saveState(statePath, state);

  const loaded = loadState(statePath);
  assert.equal(loaded.sample.draftMediaId, 'MEDIA_ID');
  assert.equal(loaded.sample.title, 'Sample');
  assert.match(loaded.sample.syncedAt, /^\d{4}-\d{2}-\d{2}T/);
});
