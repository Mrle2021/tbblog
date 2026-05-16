const fs = require('node:fs');
const path = require('node:path');

function loadState(statePath) {
  if (!fs.existsSync(statePath)) return {};
  return JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

function saveState(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function upsertDraftState(state, draft) {
  return {
    ...state,
    [draft.slug]: {
      post: draft.post,
      draftMediaId: draft.draftMediaId,
      syncedAt: new Date().toISOString(),
      title: draft.title
    }
  };
}

module.exports = {
  loadState,
  saveState,
  upsertDraftState
};
