class APIError extends Error {
  constructor(code, json) {
    super("APIError status " + code + "\n\n" + JSON.stringify(json));
    this.code = code;
    this.json = json;
  }
}

class URLError extends Error {
  constructor(message) {
    super(message);
  }
}

class HandleCache {
  prepareCache() {
    if (!this.cache) {
      this.cache = JSON.parse(localStorage.getItem('handleCache') ?? '{}');
    }
  }

  saveCache() {
    localStorage.setItem('handleCache', JSON.stringify(this.cache));
  }

  getHandleDid(handle) {
    this.prepareCache();
    return this.cache[handle];
  }

  setHandleDid(handle, did) {
    this.prepareCache();
    this.cache[handle] = did;
    this.saveCache();    
  }

  findHandleByDid(did) {
    this.prepareCache();
    let found = Object.entries(this.cache).find((e) => e[1] == did);
    return found ? found[0] : undefined;
  }
}

let POST_RE = /^(?:https?:\/\/)?((?:staging\.)?bsky\.app|langit\.pages\.dev\/r)\/profile\/([^\/]+)\/post\/([^\/]+)\s*$/;

class BlueskyAPI {
  constructor() {
    this.handleCache = new HandleCache();
    this.profiles = {};
  }

  async getRequest(method, params) {
    let url = 'https://api.bsky.app/xrpc/' + method;

    if (params) {
      url += '?' + Object.entries(params).map((x) => {
        if (x[1] instanceof Array) {
          return x[1].map((i) => `${x[0]}=${encodeURIComponent(i)}`).join('&');
        } else {
          return `${x[0]}=${encodeURIComponent(x[1])}`;
        }
      }).join('&');
    }

    let response = await fetch(url);
    let json = await this.parseResponse(response);

    if (response.status != 200) {
      throw new APIError(response.status, json);
    }

    return json;
  }

  async parseResponse(response) {
    let text = await response.text();

    if (text.trim().length > 0) {
      return JSON.parse(text);
    } else {
      return undefined;
    }
  }
  cacheProfile(author) {
    this.profiles[author.did] = author;
    this.profiles[author.handle] = author;
    this.handleCache.setHandleDid(author.handle, author.did);
  }

  findHandleByDid(did) {
    return this.handleCache.findHandleByDid(did);
  }

  static parsePostURL(string) {
    let match = POST_RE.exec(string);

    if (!match) {
      throw new URLError(`invalid post URL!`);
    }

    let author = match[2];
    let rkey = match[3];

    return [author, rkey];
  }

  async resolveHandle(handle) {
    let did = this.handleCache.getHandleDid(handle);

    if (did) {
      return did;
    } else {
      let json = await this.getRequest('com.atproto.identity.resolveHandle', { handle });
      did = json['did'];
      this.handleCache.setHandleDid(handle, did);
      return did;
    }
  }

  async loadThreadByURL(url) {
    let [author, rkey] = BlueskyAPI.parsePostURL(url);
    return await this.loadThreadById(author, rkey);
  }

  async loadThreadById(author, postId) {
    let did = author.startsWith('did:') ? author : await this.resolveHandle(author);
    let postURI = `at://${did}/app.bsky.feed.post/${postId}`;
    let threadJSON = await this.getRequest('app.bsky.feed.getPostThread', { uri: postURI, depth: 10 });
    return threadJSON;
  }

  async loadRawPostRecord(uri) {
    let { repo, collection, rkey } = atURI(uri);

    return await this.getRequest('com.atproto.repo.getRecord', { repo, collection, rkey });
  }

  async loadRawProfileRecord(handle) {
    if (this.profiles[handle]) {
      return this.profiles[handle];
    } else {
      let profile = await this.getRequest('app.bsky.actor.getProfile', { actor: handle });
      this.cacheProfile(profile);
      return profile;
    }
  }

  async loadRawPostWithAuthor(postURI) {
    let handle = atURI(postURI).repo;
    let loadRecord = this.loadRawPostRecord(postURI);
    let loadProfile = this.loadRawProfileRecord(handle);

    let [post, author] = await Promise.all([loadRecord, loadProfile]);
    return { post, author };
  }
}
