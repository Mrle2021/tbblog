const fs = require('node:fs');
const path = require('node:path');

class WeChatApiError extends Error {
  constructor(endpoint, payload) {
    super(`${endpoint} failed: errcode=${payload.errcode} errmsg=${payload.errmsg}`);
    this.name = 'WeChatApiError';
    this.endpoint = endpoint;
    this.payload = payload;
  }
}

class WeChatClient {
  constructor({ appId, appSecret, fetchImpl = fetch }) {
    if (!appId) throw new Error('WECHAT_APP_ID is required');
    if (!appSecret) throw new Error('WECHAT_APP_SECRET is required');

    this.appId = appId;
    this.appSecret = appSecret;
    this.fetchImpl = fetchImpl;
    this.token = null;
    this.tokenExpiresAt = 0;
  }

  async requestJson(endpoint, url, options) {
    const response = await this.fetchImpl(url, options);
    const payload = await response.json();
    if (payload.errcode && payload.errcode !== 0) {
      throw new WeChatApiError(endpoint, payload);
    }
    return payload;
  }

  async getAccessToken() {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;

    const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
    url.searchParams.set('grant_type', 'client_credential');
    url.searchParams.set('appid', this.appId);
    url.searchParams.set('secret', this.appSecret);

    const payload = await this.requestJson('getAccessToken', url);
    this.token = payload.access_token;
    this.tokenExpiresAt = Date.now() + Math.max(0, payload.expires_in - 300) * 1000;
    return this.token;
  }

  async uploadDraftImage(filePath) {
    const token = await this.getAccessToken();
    const url = new URL('https://api.weixin.qq.com/cgi-bin/media/uploadimg');
    url.searchParams.set('access_token', token);

    const form = new FormData();
    const bytes = fs.readFileSync(filePath);
    const blob = new Blob([bytes]);
    form.set('media', blob, path.basename(filePath));

    const payload = await this.requestJson('uploadDraftImage', url, {
      method: 'POST',
      body: form
    });
    return payload.url;
  }

  async uploadThumb(filePath) {
    const token = await this.getAccessToken();
    const url = new URL('https://api.weixin.qq.com/cgi-bin/material/add_material');
    url.searchParams.set('access_token', token);
    url.searchParams.set('type', 'thumb');

    const form = new FormData();
    const bytes = fs.readFileSync(filePath);
    const blob = new Blob([bytes]);
    form.set('media', blob, path.basename(filePath));

    const payload = await this.requestJson('uploadThumb', url, {
      method: 'POST',
      body: form
    });
    return payload.media_id;
  }

  async addDraft(article) {
    const token = await this.getAccessToken();
    const url = new URL('https://api.weixin.qq.com/cgi-bin/draft/add');
    url.searchParams.set('access_token', token);

    const payload = await this.requestJson('addDraft', url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ articles: [article] })
    });
    return payload.media_id;
  }

  async updateDraft(mediaId, article) {
    const token = await this.getAccessToken();
    const url = new URL('https://api.weixin.qq.com/cgi-bin/draft/update');
    url.searchParams.set('access_token', token);

    await this.requestJson('updateDraft', url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ media_id: mediaId, index: 0, articles: article })
    });
    return mediaId;
  }
}

module.exports = {
  WeChatApiError,
  WeChatClient
};
