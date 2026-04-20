// ---- utils.js ----
(function(mod){
'use strict';

var VERSION = '2.1.0';
var STORAGE = {
  proxyUrl: 'lordfilm_proxy_url',
  proxyToken: 'lordfilm_proxy_token',
  baseUrl: 'lordfilm_base_url',
  extraBases: 'lordfilm_extra_bases',
  timeoutMs: 'lordfilm_timeout_ms',
  debug: 'lordfilm_debug',
  quality: 'video_quality_default',
  kodikToken: 'lordfilm_kodik_token',
  allohaToken: 'lordfilm_alloha_token',
  rezkaWorkerUrl: 'lordfilm_rezka_worker_url',
  filmixWorkerUrl: 'lordfilm_filmix_worker_url',
  kinobaseWorkerUrl: 'lordfilm_kinobase_worker_url',
  providerPrefix: 'lordfilm_provider_enabled_'
};

var DEFAULTS = {
  baseUrl: 'https://lordfilm-2026.org',
  proxyUrl: 'https://lordfilm-proxy-iwalker2005.ivonin38.workers.dev',
  proxyToken: '',
  timeoutMs: 5000,
  quality: '1080'
};

var PROVIDERS = [
  { key: 'reyohoho', title: 'ReYohoho', enabled: true },
  { key: 'lordfilm', title: 'LordFilm', enabled: true },
  { key: 'collaps', title: 'Collaps', enabled: true },
  { key: 'alloha', title: 'Alloha', enabled: true },
  { key: 'kodik', title: 'Kodik', enabled: true },
  { key: 'cdnvideohub', title: 'CDNVideoHub', enabled: true },
  { key: 'rezka', title: 'HDRezka', enabled: true },
  { key: 'filmix', title: 'Filmix', enabled: true },
  { key: 'kinobase', title: 'Kinobase', enabled: true }
];

var MAP = {
  '\u0430':'a','\u0431':'b','\u0432':'v','\u0433':'g','\u0434':'d','\u0435':'e','\u0451':'e','\u0436':'zh','\u0437':'z','\u0438':'i','\u0439':'y','\u0456':'i',
  '\u043a':'k','\u043b':'l','\u043c':'m','\u043d':'n','\u043e':'o','\u043f':'p','\u0440':'r','\u0441':'s','\u0442':'t','\u0443':'u','\u0444':'f','\u0445':'h',
  '\u0446':'c','\u0447':'ch','\u0448':'sh','\u0449':'sch','\u044a':'','\u044b':'y','\u044c':'','\u044d':'e','\u044e':'yu','\u044f':'ya'
};

function sget(key, fallback){
  try { return Lampa.Storage.get(key, fallback); }
  catch (e) { return fallback; }
}

function sset(key, value){
  try { Lampa.Storage.set(key, value); }
  catch (e) {}
}

function clean(text){
  var html = String(text || '').replace(/\s+/g, ' ').trim();
  var textarea = document.createElement('textarea');
  textarea.innerHTML = html;
  return textarea.value;
}

function normalizeBaseUrl(value){
  var raw = String(value || '').trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  try {
    var u = new URL(raw);
    return (u.origin || raw).replace(/\/+$/, '');
  } catch (e) {
    return '';
  }
}

function parseBaseList(raw){
  var src = Array.isArray(raw) ? raw.join('\n') : String(raw || '');
  var out = [];
  var seen = {};
  src.split(/[\s,;\n\r]+/).forEach(function(part){
    var base = normalizeBaseUrl(part);
    if (!base || seen[base]) return;
    seen[base] = 1;
    out.push(base);
  });
  return out;
}

function year(value){
  var m = String(value || '').match(/(19|20)\d{2}/);
  return m ? parseInt(m[0], 10) : 0;
}

function abs(base, value){
  try { return new URL(value, base).toString(); }
  catch (e) { return String(value || ''); }
}

function lower(text){
  return clean(text || '').toLowerCase();
}

function norm(text){
  var raw = lower(text);
  var out = '';
  for (var i = 0; i < raw.length; i++) {
    var ch = raw.charAt(i);
    if (MAP.hasOwnProperty(ch)) out += MAP[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else out += ' ';
  }
  return out.replace(/\s+/g, ' ').trim();
}

function tokens(text){
  return norm(text).split(' ').filter(function(x){ return x && x.length > 1; });
}

function translit(text){
  return norm(text).replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

function slugVariants(text){
  var base = translit(text);
  if (!base) return [];
  var vars = [
    base,
    base.replace(/ey/g, 'ei').replace(/iy/g, 'ii'),
    base.replace(/yo/g, 'io').replace(/ya/g, 'ia').replace(/yu/g, 'iu')
  ];
  var out = [];
  var seen = {};
  vars.forEach(function(v){
    var slug = String(v || '').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
    if (!slug || slug.length < 3 || seen[slug]) return;
    seen[slug] = 1;
    out.push(slug);
  });
  return out;
}

function queryVariants(meta){
  var out = [];
  var seen = {};
  function add(value){
    var t = clean(value || '');
    if (!t || t.length < 2) return;
    var key = t.toLowerCase();
    if (seen[key]) return;
    seen[key] = 1;
    out.push(t);
  }
  add(meta.title);
  add(meta.original_title);
  add(meta.original_name);
  add(norm(meta.title));
  add(norm(meta.original_title));
  add(norm(meta.original_name));
  return out.slice(0, 10);
}

function jaccard(a, b){
  if (!a.length || !b.length) return 0;
  var A = {};
  var B = {};
  var U = {};
  var i;
  var inter = 0;
  for (i = 0; i < a.length; i++) A[a[i]] = 1;
  for (i = 0; i < b.length; i++) B[b[i]] = 1;
  for (i in A) {
    U[i] = 1;
    if (B[i]) inter++;
  }
  for (i in B) U[i] = 1;
  var total = Object.keys(U).length;
  return total ? inter / total : 0;
}

function dice(a, b){
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  var map = {};
  var i;
  for (i = 0; i < a.length - 1; i++) {
    var p = a.slice(i, i + 2);
    map[p] = (map[p] || 0) + 1;
  }
  var inter = 0;
  for (i = 0; i < b.length - 1; i++) {
    var q = b.slice(i, i + 2);
    if (map[q]) {
      inter++;
      map[q]--;
    }
  }
  return (2 * inter) / ((a.length - 1) + (b.length - 1));
}

function titleScore(a, b){
  var n1 = norm(a);
  var n2 = norm(b);
  if (!n1 || !n2) return 0;
  if (n1 === n2) return 60;
  if (n1.indexOf(n2) >= 0 || n2.indexOf(n1) >= 0) return 54;
  return Math.round(Math.max(dice(n1, n2), jaccard(tokens(n1), tokens(n2))) * 60);
}

function matchScore(meta, candidate){
  var name = 0;
  [meta.title, meta.original_title, meta.original_name].forEach(function(v){
    name = Math.max(name, titleScore(v, candidate.title));
  });
  var y = 0;
  if (meta.year && candidate.year) {
    var d = Math.abs(meta.year - candidate.year);
    if (d === 0) y = 30;
    else if (d === 1) y = 20;
  }
  return { total: name + y, name: name, year: y };
}

function cardMeta(object){
  var movie = object && object.movie ? object.movie : (object || {});
  return {
    movie: movie,
    id: movie.id || movie.tmdb_id || '',
    title: movie.title || movie.name || '',
    original_title: movie.original_title || movie.original_name || '',
    original_name: movie.original_name || '',
    year: year(movie.year || movie.release_date || movie.first_air_date || movie.last_air_date),
    imdb_id: movie.imdb_id || '',
    kinopoisk_id: movie.kinopoisk_id || movie.kp_id || '',
    type: (movie.name || movie.original_name || movie.first_air_date || movie.number_of_seasons || movie.media_type === 'tv') ? 'tv' : 'movie'
  };
}

function hash(parts){
  try { return Lampa.Utils.hash(parts.join('|')); }
  catch (e) { return parts.join('|'); }
}

function firstMapUrl(map){
  if (!map) return '';
  var keys = Object.keys(map);
  return keys.length ? String(map[keys[0]] || '') : '';
}

function normalizeProviderEnabled(raw, fallback){
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    var lowerRaw = raw.toLowerCase();
    if (lowerRaw === 'true' || lowerRaw === '1') return true;
    if (lowerRaw === 'false' || lowerRaw === '0') return false;
  }
  return !!fallback;
}

function getProviderFlags(){
  var out = {};
  PROVIDERS.forEach(function(p){
    var key = STORAGE.providerPrefix + p.key;
    out[p.key] = normalizeProviderEnabled(sget(key, p.enabled ? 'true' : 'false'), p.enabled);
  });
  return out;
}

function getConfig(){
  var configuredBases = parseBaseList(sget(STORAGE.baseUrl, DEFAULTS.baseUrl) || DEFAULTS.baseUrl);
  var fromBase = configuredBases.slice(1);
  var fromExtra = parseBaseList(sget(STORAGE.extraBases, ''));
  var timeoutMs = parseInt(sget(STORAGE.timeoutMs, DEFAULTS.timeoutMs), 10);
  if (!timeoutMs || timeoutMs < 1000) timeoutMs = DEFAULTS.timeoutMs;
  return {
    proxyUrl: String(sget(STORAGE.proxyUrl, DEFAULTS.proxyUrl) || DEFAULTS.proxyUrl).trim().replace(/\/+$/, ''),
    proxyToken: String(sget(STORAGE.proxyToken, DEFAULTS.proxyToken) || DEFAULTS.proxyToken).trim(),
    baseUrl: normalizeBaseUrl(configuredBases[0] || DEFAULTS.baseUrl),
    extraBases: fromBase.concat(fromExtra).slice(0, 12),
    timeoutMs: timeoutMs,
    debug: normalizeProviderEnabled(sget(STORAGE.debug, 'false'), false),
    quality: String(sget(STORAGE.quality, DEFAULTS.quality) || DEFAULTS.quality),
    kodikToken: String(sget(STORAGE.kodikToken, '') || '').trim(),
    allohaToken: String(sget(STORAGE.allohaToken, '') || '').trim(),
    rezkaWorkerUrl: normalizeBaseUrl(sget(STORAGE.rezkaWorkerUrl, '')),
    filmixWorkerUrl: normalizeBaseUrl(sget(STORAGE.filmixWorkerUrl, '')),
    kinobaseWorkerUrl: normalizeBaseUrl(sget(STORAGE.kinobaseWorkerUrl, '')),
    providerEnabled: getProviderFlags()
  };
}

function log(){
  var cfg = getConfig();
  if (!cfg.debug) return;
  try {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[ReYohohoAggregator]');
    console.log.apply(console, args);
  } catch (e) {}
}

function dedupeItems(items){
  var out = [];
  var seen = {};
  (items || []).forEach(function(item, idx){
    if (!item) return;
    var key = [
      item.provider || 'unknown',
      item.season || 0,
      item.episode || 0,
      norm(item.voice || ''),
      item.vkId || '',
      item.embedUrl || '',
      firstMapUrl(item.sourceMap) || '',
      item.id || idx
    ].join('|');
    if (seen[key]) return;
    seen[key] = 1;
    out.push(item);
  });
  return out;
}

mod.shared = {
  VERSION: VERSION,
  STORAGE: STORAGE,
  DEFAULTS: DEFAULTS,
  PROVIDERS: PROVIDERS,
  sget: sget,
  sset: sset,
  clean: clean,
  year: year,
  abs: abs,
  lower: lower,
  norm: norm,
  tokens: tokens,
  translit: translit,
  slugVariants: slugVariants,
  queryVariants: queryVariants,
  matchScore: matchScore,
  cardMeta: cardMeta,
  hash: hash,
  firstMapUrl: firstMapUrl,
  parseBaseList: parseBaseList,
  normalizeBaseUrl: normalizeBaseUrl,
  normalizeProviderEnabled: normalizeProviderEnabled,
  getConfig: getConfig,
  log: log,
  dedupeItems: dedupeItems
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});


// ---- network.js ----
(function(mod){
'use strict';

var shared = mod.shared;

function HttpError(status, message, payload){
  this.name = 'HttpError';
  this.status = status || 500;
  this.message = message || 'HTTP error';
  this.payload = payload || null;
}
HttpError.prototype = Object.create(Error.prototype);

function timeoutError(err){
  return !!(err && (err.name === 'AbortError' || /timeout/i.test(String(err.message || ''))));
}

function transientError(err){
  var m = String((err && err.message) || '').toLowerCase();
  return m.indexOf('failed to fetch') >= 0 || m.indexOf('networkerror') >= 0 || m.indexOf('fetch failed') >= 0 || m.indexOf('connection') >= 0 || m.indexOf('aborted') >= 0;
}

function withTimeout(promise, ms, label){
  return new Promise(function(resolve, reject){
    var done = false;
    var timer = setTimeout(function(){
      if (done) return;
      done = true;
      var err = new Error((label || 'Task') + ' timed out after ' + ms + 'ms');
      err.name = 'TimeoutError';
      reject(err);
    }, ms);
    Promise.resolve(promise).then(function(value){
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    }).catch(function(err){
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

function buildProxyUrl(targetUrl, cfg, opt){
  var final = cfg.proxyUrl + '/proxy?url=' + encodeURIComponent(targetUrl);
  if (opt && opt.proxyReferer) final += '&rf=' + encodeURIComponent(String(opt.proxyReferer));
  if (opt && opt.proxyOrigin) final += '&of=' + encodeURIComponent(String(opt.proxyOrigin));
  if (opt && opt.cookie) final += '&cookie=' + encodeURIComponent(String(opt.cookie));
  return final;
}

async function fetchWithTimeout(url, opt){
  var cfg = shared.getConfig();
  var timeout = Math.max(1000, parseInt((opt && opt.timeout) || cfg.timeoutMs, 10) || cfg.timeoutMs);
  var controller = new AbortController();
  var timer = setTimeout(function(){
    try { controller.abort(); } catch (e) {}
  }, timeout);
  try {
    return await fetch(url, {
      method: (opt && opt.method) || 'GET',
      headers: (opt && opt.headers) || {},
      body: opt && opt.body,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeHeaders(opt){
  var headers = {};
  if (opt && opt.headers) {
    Object.keys(opt.headers).forEach(function(key){
      headers[key] = opt.headers[key];
    });
  }
  return headers;
}

async function request(targetUrl, opt){
  opt = opt || {};
  var cfg = shared.getConfig();
  var useProxy = !opt.direct && !!cfg.proxyUrl;
  var url = useProxy ? buildProxyUrl(targetUrl, cfg, opt) : targetUrl;
  var headers = normalizeHeaders(opt);
  if (cfg.proxyToken && useProxy) headers['X-Proxy-Token'] = cfg.proxyToken;
  if (opt.cookie && useProxy) headers['X-Proxy-Cookie'] = String(opt.cookie);
  var retries = (typeof opt.retries === 'number') ? Math.max(0, parseInt(opt.retries, 10) || 0) : 0;

  for (var i = 0; i <= retries; i++) {
    try {
      var response = await fetchWithTimeout(url, {
        method: opt.method || 'GET',
        headers: headers,
        body: opt.body,
        timeout: opt.timeout || cfg.timeoutMs
      });

      if (!response.ok) {
        var errText = '';
        try { errText = await response.text(); } catch (e) {}
        throw new HttpError(response.status, errText || response.statusText, { body: errText });
      }

      if (opt.type === 'json') {
        var ctype = String(response.headers.get('content-type') || '').toLowerCase();
        if (ctype.indexOf('application/json') >= 0) {
          var json = await response.json();
          if (json && typeof json.status === 'number' && typeof json.body !== 'undefined') {
            if (json.status >= 400) throw new HttpError(json.status, json.error || 'Proxy error', json);
            if (typeof json.body === 'string') {
              try { return JSON.parse(json.body); }
              catch (e) { return json.body; }
            }
            return json.body;
          }
          return json;
        }
        var text = await response.text();
        try { return JSON.parse(text); }
        catch (e2) { throw new HttpError(500, 'Invalid JSON', { body: text }); }
      }

      var payload = await response.text();
      if (payload && payload.charAt(0) === '{') {
        try {
          var wrapped = JSON.parse(payload);
          if (wrapped && typeof wrapped.status === 'number' && typeof wrapped.body !== 'undefined') {
            if (wrapped.status >= 400) throw new HttpError(wrapped.status, wrapped.error || 'Proxy error', wrapped);
            return String(wrapped.body || '');
          }
        } catch (e3) {
          if (e3 && e3.name === 'HttpError') throw e3;
        }
      }
      return payload;
    } catch (err) {
      var retryable = (timeoutError(err) || transientError(err));
      if (retryable && i < retries) continue;
      throw err;
    }
  }

  throw new HttpError(500, 'Request failed');
}

async function requestPreferProxy(targetUrl, opt){
  opt = opt || {};
  try {
    return await request(targetUrl, opt);
  } catch (err) {
    if (opt.direct) throw err;
    var retry = {};
    Object.keys(opt).forEach(function(k){ retry[k] = opt[k]; });
    retry.direct = true;
    return await request(targetUrl, retry);
  }
}

function wrapProvider(provider, fn, timeoutMs, onUpdate){
  return withTimeout(Promise.resolve().then(fn), timeoutMs, provider.name || provider.key || 'provider')
    .then(function(items){
      var payload = {
        status: 'fulfilled',
        provider: provider,
        items: Array.isArray(items) ? items : []
      };
      if (onUpdate) onUpdate(payload);
      return payload;
    })
    .catch(function(error){
      var payload = {
        status: 'rejected',
        provider: provider,
        reason: error
      };
      if (onUpdate) onUpdate(payload);
      return payload;
    });
}

function pickQuality(sourceMap, preferred){
  var map = sourceMap || {};
  if (!map || !Object.keys(map).length) return { label: '', url: '' };
  if (preferred && map[preferred]) return { label: preferred, url: map[preferred] };
  if (map['Auto HLS']) return { label: 'Auto HLS', url: map['Auto HLS'] };
  var order = ['2160p', '1440p', '1080p QHD', '1080p', '720p', '480p', '360p', '240p', '144p', 'Auto HLS', 'Auto DASH'];
  var idx = order.indexOf(String(shared.getConfig().quality || '1080') + 'p');
  var i;
  if (idx >= 0) {
    for (i = idx; i < order.length; i++) {
      if (map[order[i]]) return { label: order[i], url: map[order[i]] };
    }
    for (i = idx - 1; i >= 0; i--) {
      if (map[order[i]]) return { label: order[i], url: map[order[i]] };
    }
  }
  var first = Object.keys(map)[0];
  return { label: first || '', url: first ? map[first] : '' };
}

function proxifyStream(url){
  var cfg = shared.getConfig();
  if (!url || !cfg.proxyUrl) return url;
  var out = cfg.proxyUrl + '/stream?url=' + encodeURIComponent(url);
  if (cfg.proxyToken) out += '&token=' + encodeURIComponent(cfg.proxyToken);
  return out;
}

function sourceMapFromUrl(url){
  var src = String(url || '').trim();
  var map = {};
  if (!src) return map;
  if (/\.m3u8(?:$|\?)/i.test(src)) map['Auto HLS'] = proxifyStream(src);
  else if (/\.mpd(?:$|\?)/i.test(src)) map['Auto DASH'] = proxifyStream(src);
  else if (/\.mp4(?:$|\?)/i.test(src)) map['MP4'] = proxifyStream(src);
  else map['Auto'] = proxifyStream(src);
  return map;
}

function errMessage(err){
  var status = err && err.status ? err.status : 0;
  if (status === 401 || status === 403) return '\u041e\u0448\u0438\u0431\u043a\u0430 \u0434\u043e\u0441\u0442\u0443\u043f\u0430 \u043a \u043f\u0440\u043e\u043a\u0441\u0438';
  if (status === 404) return '\u041a\u043e\u043d\u0442\u0435\u043d\u0442 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d';
  if (status === 429) return '\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u0437\u0430\u043f\u0440\u043e\u0441\u043e\u0432';
  if (timeoutError(err) || (err && err.name === 'TimeoutError')) return '\u0422\u0430\u0439\u043c\u0430\u0443\u0442 \u0437\u0430\u043f\u0440\u043e\u0441\u0430';
  return '\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438 \u0434\u0430\u043d\u043d\u044b\u0445';
}

mod.network = {
  HttpError: HttpError,
  timeoutError: timeoutError,
  transientError: transientError,
  withTimeout: withTimeout,
  request: request,
  requestPreferProxy: requestPreferProxy,
  wrapProvider: wrapProvider,
  pickQuality: pickQuality,
  proxifyStream: proxifyStream,
  sourceMapFromUrl: sourceMapFromUrl,
  errMessage: errMessage
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});

// ---- reyohoho_catalog.js ----
;(function(){
'use strict';

var GLOBAL_METHOD = 'parseReyohohoCatalog';
var GLOBAL_NAMESPACE = 'LampaCatalogClients';
var DEFAULT_BASE_URL = 'https://dav2010id.github.io/reyohoho/';
var CARD_SELECTORS = [
  '.movie-card',
  'a[data-test-id^="movie-card-"]',
  '.grid > a[href]',
  '.grid .movie-card'
];
var TITLE_SELECTORS = [
  '.movie-header h3',
  '.movie-details h3',
  'h3',
  '[title]',
  '[aria-label]'
];
var IMAGE_SELECTORS = [
  'img.movie-poster',
  '.movie-poster-frame img',
  'img[loading="lazy"]',
  'img'
];

function toArray(list){
  return list ? Array.prototype.slice.call(list) : [];
}

function isNode(value){
  return !!(value && typeof value === 'object' && typeof value.nodeType === 'number');
}

function cleanText(value){
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^постер\s+/i, '')
    .trim();
}

function cutText(value, limit){
  var text = cleanText(value);
  if (!text) return '';
  return text.length > limit ? text.slice(0, limit).trim() : text;
}

function firstMatch(root, selectors){
  if (!root || !root.querySelector) return null;

  var i;
  for (i = 0; i < selectors.length; i++) {
    try {
      var found = root.querySelector(selectors[i]);
      if (found) return found;
    } catch (e) {}
  }

  return null;
}

function firstAttribute(node, names){
  if (!node || !node.getAttribute) return '';

  var i;
  for (i = 0; i < names.length; i++) {
    var value = node.getAttribute(names[i]);
    if (value) return value;
  }

  return '';
}

function parseSrcset(value){
  var text = String(value || '').trim();
  if (!text) return '';

  var first = text.split(',')[0] || '';
  return cleanText(first.split(/\s+/)[0] || '');
}

function resolveUrl(value, baseUrl){
  var raw = cleanText(value);
  if (!raw) return '';

  try {
    return new URL(raw, baseUrl || DEFAULT_BASE_URL).toString();
  } catch (e) {
    return raw;
  }
}

function normalizeBaseUrl(source, options){
  var explicitBase = options && options.baseUrl ? String(options.baseUrl) : '';
  if (explicitBase) return explicitBase;

  if (source && source.baseUrl) return String(source.baseUrl);
  if (source && source.ownerDocument && source.ownerDocument.baseURI) return source.ownerDocument.baseURI;
  if (typeof document !== 'undefined' && document.baseURI) return document.baseURI;
  if (typeof window !== 'undefined' && window.location && window.location.href) return window.location.href;

  return DEFAULT_BASE_URL;
}

function createDocumentFromHtml(html){
  var markup = String(html || '').trim();
  if (!markup || typeof DOMParser === 'undefined') return null;

  try {
    return new DOMParser().parseFromString(markup, 'text/html');
  } catch (e) {
    return null;
  }
}

function resolveRoot(source, options){
  var root = options && options.root ? options.root : source;

  if (!root) {
    return typeof document !== 'undefined' ? document : null;
  }

  if (typeof root === 'string') {
    if (root.indexOf('<') >= 0) {
      return createDocumentFromHtml(root);
    }

    if (typeof document !== 'undefined' && document.querySelector) {
      try {
        return document.querySelector(root);
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  if (root && typeof root.html === 'string') {
    return createDocumentFromHtml(root.html);
  }

  return isNode(root) ? root : null;
}

function uniquePush(target, seen, node){
  if (!node) return;
  if (seen.indexOf(node) >= 0) return;
  seen.push(node);
  target.push(node);
}

function findCards(root){
  if (!root || !root.querySelectorAll) return [];

  var cards = [];
  var seen = [];

  if (root.matches) {
    var i;
    for (i = 0; i < CARD_SELECTORS.length; i++) {
      try {
        if (root.matches(CARD_SELECTORS[i])) {
          uniquePush(cards, seen, root);
          break;
        }
      } catch (e) {}
    }
  }

  CARD_SELECTORS.forEach(function(selector){
    var nodes = [];

    try {
      nodes = toArray(root.querySelectorAll(selector));
    } catch (e) {}

    nodes.forEach(function(node){
      uniquePush(cards, seen, node);
    });
  });

  return cards;
}

function getTitle(card){
  var titleNode = firstMatch(card, TITLE_SELECTORS);
  var title = '';

  if (titleNode) {
    title =
      cleanText(titleNode.textContent) ||
      cleanText(titleNode.getAttribute && titleNode.getAttribute('title')) ||
      cleanText(titleNode.getAttribute && titleNode.getAttribute('aria-label'));
  }

  if (title) return title;

  var imageNode = firstMatch(card, IMAGE_SELECTORS);
  if (imageNode) {
    title = cleanText(firstAttribute(imageNode, ['alt', 'title', 'aria-label']));
    if (title) return title;
  }

  title = cleanText(firstAttribute(card, ['title', 'aria-label']));
  if (title) return title;

  return cutText(card.textContent, 160);
}

function getLink(card, baseUrl){
  var anchor = null;

  if (card.tagName && String(card.tagName).toLowerCase() === 'a') {
    anchor = card;
  } else if (card.querySelector) {
    anchor = card.querySelector('a[href]');
  }

  if (!anchor) return '';

  var href = cleanText(anchor.getAttribute('href'));
  if (!href || href === '#') return '';

  return resolveUrl(href, baseUrl);
}

function getPicture(card, baseUrl){
  var imageNode = firstMatch(card, IMAGE_SELECTORS);
  if (!imageNode) return '';

  var candidate =
    firstAttribute(imageNode, ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-url']) ||
    parseSrcset(firstAttribute(imageNode, ['srcset', 'data-srcset']));

  if (!candidate) return '';

  return resolveUrl(candidate, baseUrl);
}

function isValidItem(item){
  return !!(item && item.title && item.link);
}

async function parseReyohohoCatalog(source, options){
  var opts = options || {};
  var root = resolveRoot(source, opts);
  var baseUrl = normalizeBaseUrl(source, opts);

  if (!root || !root.querySelectorAll) return [];

  var cards = findCards(root);
  if (!cards.length) return [];

  var seen = Object.create(null);
  var output = [];

  cards.forEach(function(card){
    try {
      var item = {
        title: getTitle(card),
        link: getLink(card, baseUrl),
        picture: getPicture(card, baseUrl)
      };

      if (!isValidItem(item)) return;

      var key = item.link + '::' + item.title;
      if (seen[key]) return;

      seen[key] = true;
      output.push(item);
    } catch (e) {}
  });

  return output;
}

window[GLOBAL_METHOD] = parseReyohohoCatalog;
window[GLOBAL_NAMESPACE] = window[GLOBAL_NAMESPACE] || {};
window[GLOBAL_NAMESPACE][GLOBAL_METHOD] = parseReyohohoCatalog;

})();


// ---- reyohoho.js ----
(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

var KINOBD_BASE_URL = 'https://kinobd.net';
var KINOBOX_BASE_URL = 'https://api.kinobox.tv';
var KINOBOX_REFERER = 'https://tapeop.dev/';
var KINOBOX_ORIGIN = 'https://tapeop.dev';
var SKIP_PROVIDER_KEYS = {
  nf: 1,
  netflix: 1,
  torrent: 1,
  youtube: 1,
  trailer: 1,
  trailer_local: 1
};
var DEFAULT_KINOBD_PROVIDERS = [
  'collaps',
  'vibix',
  'alloha',
  'kodik',
  'kinotochka',
  'flixcdn',
  'ashdi',
  'turbo',
  'videocdn',
  'bazon',
  'ustore',
  'pleer',
  'videospider',
  'iframe',
  'moonwalk',
  'hdvb',
  'cdnmovies',
  'lookbase',
  'kholobok',
  'videoapi',
  'voidboost',
  'trailer_local',
  'videoseed',
  'ia',
  'youtube',
  'ext',
  'trailer',
  'netflix',
  'torrent',
  'vk',
  'nf'
].join(',');

var directSourceCache = {};

function parseJsonSafe(text){
  try { return JSON.parse(text); }
  catch (e) { return null; }
}

function normalizeUrl(value, baseUrl){
  var raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/\//.test(raw)) return 'https:' + raw;
  try { return new URL(raw, baseUrl || KINOBD_BASE_URL).toString(); }
  catch (e) { return raw; }
}

function extractIframeUrl(value, baseUrl){
  if (!value) return '';
  if (typeof value !== 'string') return '';

  var raw = String(value || '').trim();
  if (!raw) return '';

  if (/^(https?:)?\/\//i.test(raw)) return normalizeUrl(raw, baseUrl);

  var dataSrcMatch = raw.match(/data-src="([^"]+)"/i);
  if (dataSrcMatch && dataSrcMatch[1]) return normalizeUrl(dataSrcMatch[1], baseUrl);

  var srcMatch = raw.match(/src="([^"]+)"/i);
  if (srcMatch && srcMatch[1]) return normalizeUrl(srcMatch[1], baseUrl);

  return '';
}

function collectUrls(input, out){
  if (!input) return;

  if (typeof input === 'string') {
    String(input || '').split(' or ').forEach(function(part){
      var full = normalizeUrl(part);
      if (!full) return;
      if (/^(https?:)?\/\//i.test(full)) out.push(full);
    });
    return;
  }

  if (Array.isArray(input)) {
    input.forEach(function(node){ collectUrls(node, out); });
    return;
  }

  if (typeof input === 'object') {
    Object.keys(input).forEach(function(key){
      collectUrls(input[key], out);
    });
  }
}

function qualityFromLabel(label, url){
  var raw = String(label || '') + ' ' + String(url || '');
  var match = raw.match(/(2160|1440|1080|720|480|360|240|144)\s*p?/i);
  return match ? (match[1] + 'p') : '';
}

function buildSourceMapFromUrls(urls){
  var map = {};
  var seen = {};

  (urls || []).forEach(function(item){
    var url = '';
    var label = '';

    if (typeof item === 'string') {
      url = normalizeUrl(item);
    } else if (item && typeof item === 'object') {
      url = normalizeUrl(item.url);
      label = String(item.label || '');
    }

    if (!url || seen[url]) return;
    seen[url] = 1;

    if (!label) {
      if (/\.m3u8(?:$|\?)/i.test(url)) label = 'Auto HLS';
      else if (/\.mpd(?:$|\?)/i.test(url)) label = 'Auto DASH';
      else if (/\.mp4(?:$|\?)/i.test(url)) label = qualityFromLabel('', url) || 'MP4';
      else label = qualityFromLabel('', url) || 'Auto';
    }

    if (!map[label]) map[label] = network.proxifyStream(url);
  });

  return map;
}

function parseGenericEmbedSources(html, baseUrl){
  var text = String(html || '');
  var urls = [];
  var sourceMatch = text.match(/source\s*:\s*\{([\s\S]{0,10000}?)\}/i);

  if (sourceMatch) {
    var reg = /(hls|dash|dasha)\s*:\s*['"]([^'"]+)['"]/ig;
    var row;

    while ((row = reg.exec(sourceMatch[1]))) {
      urls.push({
        label: row[1] === 'hls' ? 'Auto HLS' : 'Auto DASH',
        url: normalizeUrl(row[2], baseUrl)
      });
    }
  }

  var fileListMatch = text.match(/fileList\s*=\s*JSON\.parse\('\s*(\{[\s\S]*?\})\s*'\)/i);
  if (fileListMatch) {
    var rawFileList = fileListMatch[1].replace(/\\'/g, "'").replace(/\\\//g, '/');
    var parsedFileList = parseJsonSafe(rawFileList);
    if (parsedFileList) collectUrls(parsedFileList, urls);
  }

  var objectMatch = text.match(/["']file["']\s*:\s*["']([^"']+)["']/i);
  if (objectMatch && objectMatch[1]) {
    String(objectMatch[1] || '').split(/,+/).forEach(function(chunk){
      var pair = String(chunk || '').match(/\[(\d{3,4})p?\](https?:\/\/[^,\s]+|\/\/[^,\s]+)/i);
      if (pair && pair[2]) {
        urls.push({
          label: pair[1] + 'p',
          url: normalizeUrl(pair[2], baseUrl)
        });
      } else {
        collectUrls(chunk, urls);
      }
    });
  }

  var directUrlReg = /(?:https?:)?\/\/[^"'\\\s]+(?:\.m3u8|\.mpd|\.mp4)[^"'\\\s]*/ig;
  var found;
  while ((found = directUrlReg.exec(text))) {
    urls.push(normalizeUrl(found[0], baseUrl));
  }

  return buildSourceMapFromUrls(urls);
}

function decodeKodikLink(str){
  var value = String(str || '');
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || /^\/\//.test(value)) return value;

  try {
    return atob(value.replace(/[a-zA-Z]/g, function(ch){
      var code = ch.charCodeAt(0) + 18;
      var max = ch <= 'Z' ? 90 : 122;
      if (code > max) code -= 26;
      return String.fromCharCode(code);
    }));
  } catch (e) {
    return '';
  }
}

function toQualityLabel(quality){
  var q = parseInt(quality, 10);
  return isNaN(q) ? 'Auto' : String(q) + 'p';
}

function buildKodikSourceMap(links){
  var pairs = [];

  Object.keys(links || {}).forEach(function(key){
    var row = links[key];
    var raw = row && row[0] ? row[0].src : '';
    var url = decodeKodikLink(raw);
    if (!url) return;
    pairs.push({
      quality: parseInt(key, 10),
      label: toQualityLabel(key),
      url: normalizeUrl(url)
    });
  });

  pairs.sort(function(a, b){
    var aq = isNaN(a.quality) ? -1 : a.quality;
    var bq = isNaN(b.quality) ? -1 : b.quality;
    return bq - aq;
  });

  return buildSourceMapFromUrls(pairs);
}

async function resolveKodikSourceMap(link){
  var cacheKey = String(link || '');
  if (!cacheKey) return {};
  if (directSourceCache[cacheKey]) return directSourceCache[cacheKey];

  var pageUrl = /^https?:/i.test(cacheKey) ? cacheKey : ('https:' + cacheKey);
  var pageHtml = await network.requestPreferProxy(pageUrl, {
    type: 'text',
    timeout: 5000,
    retries: 0,
    proxyReferer: pageUrl
  }).catch(function(){ return ''; });
  var compact = String(pageHtml || '').replace(/\n/g, ' ');

  var urlParamsMatch = compact.match(/\burlParams\s*=\s*'([^']+)'/);
  var typeMatch = compact.match(/\b(?:videoInfo|vInfo)\.type\s*=\s*'([^']+)'/);
  var hashMatch = compact.match(/\b(?:videoInfo|vInfo)\.hash\s*=\s*'([^']+)'/);
  var idMatch = compact.match(/\b(?:videoInfo|vInfo)\.id\s*=\s*'([^']+)'/);
  var playerMatch = compact.match(/<script[^>]*\bsrc="(\/assets\/js\/app\.player_single[^"]+)"/i);

  if (!urlParamsMatch || !typeMatch || !hashMatch || !idMatch || !playerMatch) return {};

  var urlParams = parseJsonSafe(urlParamsMatch[1]);
  if (!urlParams) return {};

  var pageOrigin = 'https://kodik.info';
  try { pageOrigin = new URL(pageUrl).origin; }
  catch (e) {}

  var postData = '';
  postData += 'd=' + encodeURIComponent(urlParams.d || '');
  postData += '&d_sign=' + encodeURIComponent(urlParams.d_sign || '');
  postData += '&pd=' + encodeURIComponent(urlParams.pd || '');
  postData += '&pd_sign=' + encodeURIComponent(urlParams.pd_sign || '');
  postData += '&ref=' + encodeURIComponent(urlParams.ref || '');
  postData += '&ref_sign=' + encodeURIComponent(urlParams.ref_sign || '');
  postData += '&bad_user=true';
  postData += '&cdn_is_working=true';
  postData += '&type=' + encodeURIComponent(typeMatch[1]);
  postData += '&hash=' + encodeURIComponent(hashMatch[1]);
  postData += '&id=' + encodeURIComponent(idMatch[1]);
  postData += '&info=%7B%7D';

  var playerUrl = normalizeUrl(playerMatch[1], pageOrigin);
  var playerScript = await network.requestPreferProxy(playerUrl, {
    type: 'text',
    timeout: 5000,
    retries: 0,
    proxyReferer: pageUrl
  }).catch(function(){ return ''; });
  var infoMatch = String(playerScript || '').match(/\$\.ajax\(\{type:\s*"POST",\s*url:\s*atob\("([^"]+)"\)/);
  if (!infoMatch) return {};

  var infoPath = '';
  try { infoPath = atob(infoMatch[1]); }
  catch (e2) {}
  if (!infoPath) return {};

  var infoUrl = normalizeUrl(infoPath, pageOrigin);
  var info = await network.requestPreferProxy(infoUrl, {
    method: 'POST',
    body: postData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    type: 'json',
    timeout: 5000,
    retries: 0,
    proxyReferer: pageUrl
  }).catch(function(){ return null; });

  var sourceMap = buildKodikSourceMap(info && info.links ? info.links : {});
  directSourceCache[cacheKey] = sourceMap;
  return sourceMap;
}

function parseBalancerMeta(html, iframeUrl){
  var text = String(html || '');
  var movieId = '';
  var baseUrl = '';
  var token = '';
  var requestId = '';
  var match = text.match(/window\.MOVIE_ID\s*=\s*(\d+)/i);
  if (match) movieId = match[1];
  match = text.match(/window\.ENV_BASE_URL\s*=\s*['"]([^'"]+)['"]/i);
  if (match) baseUrl = match[1];
  match = text.match(/['"]DLE-API-TOKEN['"]\s*:\s*['"]([^'"]+)['"]/i);
  if (match) token = match[1];
  match = text.match(/['"]Iframe-Request-Id['"]\s*:\s*['"]([^'"]+)['"]/i);
  if (match) requestId = match[1];

  if (!baseUrl) {
    try {
      var parsed = new URL(iframeUrl);
      baseUrl = parsed.origin + '/balancer-api/proxy/playlists';
    } catch (e) {}
  }

  var headers = {};
  if (token) headers['DLE-API-TOKEN'] = token;
  if (requestId) headers['Iframe-Request-Id'] = requestId;

  return {
    movieId: String(movieId || ''),
    baseUrl: String(baseUrl || ''),
    headers: headers
  };
}

async function loadBalancerItems(iframeUrl, providerLabel){
  var iframeHtml = await network.requestPreferProxy(iframeUrl, {
    type: 'text',
    timeout: 5000,
    retries: 0,
    proxyReferer: iframeUrl
  }).catch(function(){ return ''; });

  var meta = parseBalancerMeta(iframeHtml, iframeUrl);
  if (!meta.movieId || !meta.baseUrl) return [];

  var episodes = await network.requestPreferProxy(
    meta.baseUrl + '/catalog-api/episodes?content-id=' + encodeURIComponent(meta.movieId),
    {
      type: 'json',
      timeout: 5000,
      retries: 0,
      headers: meta.headers,
      proxyReferer: iframeUrl
    }
  ).catch(function(){ return []; });

  if (!Array.isArray(episodes) || !episodes.length) return [];

  var out = [];
  episodes.forEach(function(ep, idx){
    var season = 1;
    var episode = idx + 1;

    if (ep && ep.season && typeof ep.season.order !== 'undefined') {
      var parsedSeason = parseInt(ep.season.order, 10);
      if (!isNaN(parsedSeason)) season = parsedSeason + 1;
    }
    if (ep && typeof ep.order !== 'undefined') {
      var parsedEpisode = parseInt(ep.order, 10);
      if (!isNaN(parsedEpisode)) episode = parsedEpisode + 1;
    }

    var variants = (ep && Array.isArray(ep.episodeVariants) && ep.episodeVariants.length)
      ? ep.episodeVariants
      : (ep && ep.m3u8MasterFilePath
        ? [{ filepath: ep.m3u8MasterFilePath, title: 'Original' }]
        : []);

    variants.forEach(function(variant, variantIndex){
      var sourceUrl = normalizeUrl((variant && variant.filepath) || '', iframeUrl);
      var sourceMap = network.sourceMapFromUrl(sourceUrl);
      if (!Object.keys(sourceMap).length) return;

      out.push({
        id: ['reyohoho', 'balancer', providerLabel, season, episode, variantIndex].join('|'),
        provider: 'reyohoho',
        providerLabel: providerLabel,
        voice: shared.clean((variant && variant.title) || 'Original'),
        season: season,
        episode: episode,
        maxQuality: '1080p',
        sourceMap: sourceMap
      });
    });
  });

  return out;
}

function classifyIframe(url){
  var low = String(url || '').toLowerCase();
  if (!low) return 'iframe';
  if (/\.m3u8(?:$|\?)/.test(low) || /\.mpd(?:$|\?)/.test(low) || /\.mp4(?:$|\?)/.test(low)) return 'direct';
  if (/balancer-api\/iframe/.test(low)) return 'balancer';
  if (/kodik/i.test(low)) return 'kodik';
  return 'iframe';
}

async function resolveIframeSourceMap(iframeUrl){
  var cacheKey = String(iframeUrl || '');
  if (!cacheKey) return {};
  if (directSourceCache[cacheKey]) return directSourceCache[cacheKey];

  var kind = classifyIframe(cacheKey);
  var sourceMap = {};

  if (kind === 'direct') {
    sourceMap = network.sourceMapFromUrl(cacheKey);
  } else if (kind === 'kodik') {
    sourceMap = await resolveKodikSourceMap(cacheKey).catch(function(){ return {}; });
  }

  if (!Object.keys(sourceMap).length) {
    var html = await network.requestPreferProxy(cacheKey, {
      type: 'text',
      timeout: 5000,
      retries: 0,
      proxyReferer: cacheKey
    }).catch(function(){ return ''; });
    sourceMap = parseGenericEmbedSources(html, cacheKey);
  }

  directSourceCache[cacheKey] = sourceMap;
  return sourceMap;
}

function ensureUniqueKey(store, baseKey){
  if (!store[baseKey]) return baseKey;
  var idx = 2;
  while (store[baseKey + ' #' + idx]) idx++;
  return baseKey + ' #' + idx;
}

function dedupeItems(items){
  return shared.dedupeItems((items || []).map(function(item){
    var clone = {};
    Object.keys(item || {}).forEach(function(key){
      clone[key] = item[key];
    });
    return clone;
  }));
}

function rankKinoBdCandidates(meta, candidates){
  return (candidates || []).slice().sort(function(a, b){
    var scoreA = shared.matchScore(meta, {
      title: a && a.title,
      year: shared.year(a && a.year)
    }).total + (String(a && a.kp_id || '') === String(meta && meta.kinopoisk_id || '') ? 40 : 0);

    var scoreB = shared.matchScore(meta, {
      title: b && b.title,
      year: shared.year(b && b.year)
    }).total + (String(b && b.kp_id || '') === String(meta && meta.kinopoisk_id || '') ? 40 : 0);

    return scoreB - scoreA;
  });
}

async function searchKinoBdCandidates(meta){
  var attempts = [];
  if (meta && meta.kinopoisk_id) attempts.push({ q: String(meta.kinopoisk_id), type: 'kp_id' });
  if (meta && meta.imdb_id) attempts.push({ q: String(meta.imdb_id), type: 'title' });

  var title = meta && (meta.title || meta.original_title || meta.original_name || '');
  if (title) attempts.push({ q: title, type: 'title' });

  var out = [];
  for (var i = 0; i < attempts.length; i++) {
    var attempt = attempts[i];
    var url = KINOBD_BASE_URL + '/api/player/search?q=' +
      encodeURIComponent(attempt.q) +
      '&type=' + encodeURIComponent(attempt.type) +
      '&page=1';

    var json = await network.requestPreferProxy(url, {
      type: 'json',
      timeout: 5000,
      retries: 0,
      proxyReferer: KINOBD_BASE_URL + '/'
    }).catch(function(){ return null; });

    var rows = json && Array.isArray(json.data) ? json.data : [];
    rows.forEach(function(item){
      out.push({
        id: item && item.id,
        kp_id: item && (item.kinopoisk_id || item.kp_id || ''),
        imdb_id: item && (item.imdb_id || ''),
        title: item && (item.name_russian || item.name_original || ''),
        year: item && (item.year || ''),
        iframe: extractIframeUrl(item && item.iframe, KINOBD_BASE_URL),
        raw_data: item
      });
    });

    if (out.length) break;
  }

  return rankKinoBdCandidates(meta, out);
}

async function loadKinoBdProviderMap(candidate){
  if (!candidate || !candidate.id) return {};

  var body = 'fast=1' +
    '&inid=' + encodeURIComponent(String(candidate.id)) +
    '&player=' + encodeURIComponent(DEFAULT_KINOBD_PROVIDERS);

  var headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (candidate.iframe) headers['X-Re'] = candidate.iframe;

  if (candidate.iframe) {
    try {
      var iframeOrigin = new URL(candidate.iframe).origin;
      headers.Origin = iframeOrigin;
      headers.Referer = iframeOrigin + '/';
    } catch (e) {}
  }

  return await network.requestPreferProxy(
    KINOBD_BASE_URL + '/playerdata?cache' + encodeURIComponent(String(candidate.id)),
    {
      method: 'POST',
      body: body,
      headers: headers,
      type: 'json',
      timeout: 5000,
      retries: 0,
      proxyReferer: candidate.iframe || (KINOBD_BASE_URL + '/')
    }
  ).catch(function(){ return {}; });
}

async function expandIframeItem(baseItem, iframeUrl){
  var kind = classifyIframe(iframeUrl);
  if (kind === 'balancer') {
    var expanded = await loadBalancerItems(iframeUrl, baseItem.providerLabel).catch(function(){ return []; });
    if (expanded.length) return expanded;
  }

  return [baseItem];
}

async function loadKinoBdItems(meta){
  var candidates = await searchKinoBdCandidates(meta);
  if (!candidates.length) return [];

  var selected = candidates.slice(0, 2);
  var items = [];

  for (var i = 0; i < selected.length; i++) {
    var candidate = selected[i];
    var providerMap = await loadKinoBdProviderMap(candidate).catch(function(){ return {}; });
    var keys = Object.keys(providerMap || {});

    if (!keys.length && candidate.iframe) {
      items = items.concat(await expandIframeItem({
        id: ['reyohoho', 'kinobd', candidate.id || i].join('|'),
        provider: 'reyohoho',
        providerLabel: 'KinoBD',
        voice: shared.clean(candidate.title || 'Original'),
        season: 0,
        episode: 0,
        maxQuality: '',
        loadSourceMap: function(){ return resolveIframeSourceMap(candidate.iframe); }
      }, candidate.iframe));
      continue;
    }

    for (var k = 0; k < keys.length; k++) {
      var providerName = keys[k];
      if (SKIP_PROVIDER_KEYS[String(providerName || '').toLowerCase()]) continue;
      var row = providerMap[providerName] || {};
      var iframe = extractIframeUrl(row.iframe || row.url || row.link || '', KINOBD_BASE_URL);
      if (!iframe) continue;

      var providerLabel = 'KinoBD ' + String(providerName || 'Player').toUpperCase();
      var baseItem = {
        id: ['reyohoho', 'kinobd', providerName, candidate.id || i, iframe].join('|'),
        provider: 'reyohoho',
        providerLabel: providerLabel,
        voice: shared.clean(row.translate || row.translation || providerName || 'Original'),
        season: 0,
        episode: 0,
        maxQuality: '',
        loadSourceMap: function(){ return resolveIframeSourceMap(iframe); }
      };

      items = items.concat(await expandIframeItem(baseItem, iframe));
    }
  }

  return dedupeItems(items);
}

async function loadKinoBoxItems(meta){
  if (!(meta && meta.kinopoisk_id)) return [];

  var url = KINOBOX_BASE_URL + '/api/players?kinopoisk=' + encodeURIComponent(String(meta.kinopoisk_id));
  if (meta.title) url += '&title=' + encodeURIComponent(String(meta.title));

  var json = await network.requestPreferProxy(url, {
    type: 'json',
    timeout: 5000,
    retries: 0,
    headers: {
      Referer: KINOBOX_REFERER,
      Origin: KINOBOX_ORIGIN
    },
    proxyReferer: KINOBOX_REFERER,
    proxyOrigin: KINOBOX_ORIGIN
  }).catch(function(){ return null; });

  var providers = [];
  if (json && Array.isArray(json.data)) providers = json.data;
  else if (Array.isArray(json)) providers = json;
  if (!providers.length) return [];

  var items = [];
  var seen = {};

  for (var i = 0; i < providers.length; i++) {
    var provider = providers[i] || {};
    var providerType = String(provider.type || 'Player').trim();
    var providerLabel = 'Kinobox ' + providerType;
    var providerBaseIframe = extractIframeUrl(provider.iframeUrl || '', KINOBOX_BASE_URL);

    if (providerBaseIframe) {
      var baseKey = ensureUniqueKey(seen, providerLabel);
      seen[baseKey] = 1;
      items = items.concat(await expandIframeItem({
        id: ['reyohoho', 'kinobox', baseKey, providerBaseIframe].join('|'),
        provider: 'reyohoho',
        providerLabel: providerLabel,
        voice: providerType,
        season: 0,
        episode: 0,
        maxQuality: '',
        loadSourceMap: function(){ return resolveIframeSourceMap(providerBaseIframe); }
      }, providerBaseIframe));
    }

    var translations = Array.isArray(provider.translations) ? provider.translations : [];
    for (var t = 0; t < translations.length; t++) {
      var translation = translations[t] || {};
      var iframe = extractIframeUrl(translation.iframeUrl || '', KINOBOX_BASE_URL);
      if (!iframe) continue;

      var translationName = shared.clean(translation.name || providerType || 'Translation');
      var itemLabel = providerLabel;
      var itemVoice = translationName || providerType;
      var itemKey = ensureUniqueKey(seen, providerLabel + '>' + itemVoice);
      seen[itemKey] = 1;

      items = items.concat(await expandIframeItem({
        id: ['reyohoho', 'kinobox', itemKey, iframe].join('|'),
        provider: 'reyohoho',
        providerLabel: itemLabel,
        voice: itemVoice,
        season: 0,
        episode: 0,
        maxQuality: translation.quality || '',
        loadSourceMap: function(){ return resolveIframeSourceMap(iframe); }
      }, iframe));
    }
  }

  return dedupeItems(items);
}

async function search(meta){
  var all = [];

  if (meta && (meta.kinopoisk_id || meta.imdb_id || meta.title || meta.original_title)) {
    var kinoboxItems = await loadKinoBoxItems(meta).catch(function(){ return []; });
    if (kinoboxItems.length) all = all.concat(kinoboxItems);

    var kinobdItems = await loadKinoBdItems(meta).catch(function(){ return []; });
    if (kinobdItems.length) all = all.concat(kinobdItems);
  }

  return dedupeItems(all).slice(0, 200);
}

mod.providers = mod.providers || {};
mod.providers.reyohoho = {
  key: 'reyohoho',
  title: 'ReYohoho',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});


// ---- lordfilm.js ----
(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

var MAIN_MIRRORS = [
  'https://lordfilm-2026.org',
  'https://lordfilmpuq.study'
];

var SEO_MIRRORS = [
  'https://gentalmen-lordfilm.ru',
  'https://12-angry-men-lordfilm.ru'
];

function isWpBase(base){
  try {
    var host = (new URL(base)).hostname.toLowerCase();
    return host.indexOf('lordfilms.ru') >= 0 || /(^|\.)[^.]+-lordfilm\.ru$/.test(host);
  } catch (e) {
    return false;
  }
}

function searchUrl(base, query){
  return isWpBase(base)
    ? (base + '/?s=' + encodeURIComponent(query))
    : (base + '/index.php?do=search&subaction=search&story=' + encodeURIComponent(query));
}

function parseSearch(html, baseUrl){
  var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  var out = [];
  var baseHost = '';

  try { baseHost = (new URL(baseUrl)).hostname.toLowerCase(); }
  catch (e) {}

  function sameHost(url){
    try {
      if (!baseHost) return true;
      return (new URL(url, baseUrl)).hostname.toLowerCase() === baseHost;
    } catch (e) { return true; }
  }

  function push(raw){
    if (!raw || !raw.href || !sameHost(raw.href)) return;
    out.push({
      title: shared.clean(raw.title || ''),
      year: parseInt(raw.year || 0, 10) || 0,
      href: shared.abs(baseUrl, raw.href || ''),
      poster: raw.poster ? shared.abs(baseUrl, raw.poster) : ''
    });
  }

  doc.querySelectorAll('.grid-items__item').forEach(function(node){
    var link = node.querySelector('a.item__title');
    if (!link) return;
    var title = shared.clean(link.textContent || link.getAttribute('title') || '');
    if (!title) return;
    var image = node.querySelector('img');
    push({
      title: title,
      year: shared.year((node.querySelector('.item__year') || {}).textContent || ''),
      href: link.getAttribute('href') || '',
      poster: image ? (image.getAttribute('src') || image.getAttribute('data-src') || '') : ''
    });
  });

  doc.querySelectorAll('a.film-i[href]').forEach(function(link){
    var titleNode = link.querySelector('.film-i__title');
    var title = shared.clean((titleNode || link).textContent || link.getAttribute('title') || '');
    if (!title) return;
    var image = link.querySelector('img');
    var poster = image ? (image.getAttribute('data-src') || image.getAttribute('data-lazy-src') || image.getAttribute('src') || '') : '';
    push({
      title: title,
      year: shared.year((link.querySelector('.film-i__god_vyhoda') || {}).textContent || title),
      href: link.getAttribute('href') || '',
      poster: poster
    });
  });

  doc.querySelectorAll('a.articles__item[href],a.articles__info-button[href]').forEach(function(link){
    var title = shared.clean((link.querySelector('.articles__title') || {}).textContent || link.getAttribute('title') || link.textContent || '');
    title = title.replace(/\b(\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c|\u043e\u043d\u043b\u0430\u0439\u043d|lordfilm)\b/ig, '').replace(/\s+/g, ' ').trim();
    if (!title) return;
    var image = link.querySelector('img') || (link.parentElement && link.parentElement.querySelector ? link.parentElement.querySelector('img') : null);
    var poster = image ? (image.getAttribute('data-src') || image.getAttribute('data-lazy-src') || image.getAttribute('src') || '') : '';
    push({
      title: title,
      year: shared.year(title),
      href: link.getAttribute('href') || '',
      poster: poster
    });
  });

  var seen = {};
  return out.filter(function(item){
    if (!item.href || !item.title || seen[item.href]) return false;
    seen[item.href] = 1;
    return true;
  }).slice(0, 200);
}

function detectPlayerKind(url){
  var low = String(url || '').toLowerCase();
  if (!low) return 'iframe';
  if (/balancer-api\/iframe/.test(low)) return 'balancer';
  if (/api\.namy\.ws\/embed\//.test(low)) return 'embed';
  return 'iframe';
}

function parsePlayerMeta(html, baseUrl, pageUrl){
  var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  var players = [];
  var titleId = '';
  var publisherId = '';
  var aggregator = 'kp';
  var embedUrl = '';

  doc.querySelectorAll('video-player').forEach(function(node){
    var tid = node.getAttribute('data-title-id') || '';
    var pid = node.getAttribute('data-publisher-id') || '';
    var aggr = node.getAttribute('data-aggregator') || 'kp';
    if (tid && !titleId) titleId = tid;
    if (pid && !publisherId) publisherId = pid;
    if (aggr && aggregator === 'kp') aggregator = aggr;
    players.push({
      kind: 'cdnvideohub',
      titleId: tid,
      publisherId: pid,
      aggregator: aggr,
      pageUrl: pageUrl || ''
    });
  });

  doc.querySelectorAll('iframe').forEach(function(node){
    var raw = node.getAttribute('data-lazy-src') || node.getAttribute('data-src') || node.getAttribute('src') || '';
    raw = String(raw || '').replace(/\\u0026/gi, '&').replace(/&amp;/g, '&').replace(/\\\//g, '/');
    if (!raw || raw === 'about:blank') return;
    var full = shared.abs(baseUrl, raw);
    var kind = detectPlayerKind(full);
    players.push({ kind: kind, url: full, pageUrl: pageUrl || '' });
    if (!embedUrl && kind === 'embed') embedUrl = full;
    if ((!titleId || !publisherId) && /balancer-api\/iframe/i.test(full)) {
      try {
        var u = new URL(full, baseUrl);
        if (!titleId) titleId = u.searchParams.get('kp') || u.searchParams.get('id') || '';
        if (!publisherId) publisherId = '2158';
      } catch (e) {}
    }
  });

  return {
    titleId: titleId,
    publisherId: publisherId || '2158',
    aggregator: aggregator,
    embedUrl: embedUrl,
    players: players
  };
}

function parseEmbedSources(html, embedUrl){
  var text = String(html || '');
  var raw = {};
  var sourceMatch = text.match(/source\s*:\s*\{([\s\S]{0,10000}?)\}/i);
  if (sourceMatch) {
    var reg = /(hls|dash|dasha)\s*:\s*['"]([^'"]+)['"]/ig;
    var row;
    while ((row = reg.exec(sourceMatch[1]))) {
      raw[row[1].toLowerCase()] = shared.abs(embedUrl, row[2]);
    }
  }

  if (!raw.hls) {
    var m3u8 = text.match(/https?:\/\/[^"'\\\s]+\.m3u8[^"'\\\s]*/i);
    if (m3u8) raw.hls = m3u8[0];
  }
  if (!raw.dash) {
    var mpd = text.match(/https?:\/\/[^"'\\\s]+\.mpd[^"'\\\s]*/i);
    if (mpd) raw.dash = mpd[0];
  }

  var map = {};
  if (raw.hls) map['Auto HLS'] = network.proxifyStream(raw.hls);
  if (raw.dash) map['Auto DASH'] = network.proxifyStream(raw.dash);
  if (raw.dasha) map['Auto DASH Alt'] = network.proxifyStream(raw.dasha);
  return map;
}

function parseBalancerMeta(html, iframeUrl){
  var text = String(html || '');
  var movieId = '';
  var baseUrl = '';
  var token = '';
  var requestId = '';

  var m = text.match(/window\.MOVIE_ID\s*=\s*(\d+)/i);
  if (m) movieId = m[1];
  m = text.match(/window\.ENV_BASE_URL\s*=\s*['"]([^'"]+)['"]/i);
  if (m) baseUrl = m[1];
  m = text.match(/['"]DLE-API-TOKEN['"]\s*:\s*['"]([^'"]+)['"]/i);
  if (m) token = m[1];
  m = text.match(/['"]Iframe-Request-Id['"]\s*:\s*['"]([^'"]+)['"]/i);
  if (m) requestId = m[1];

  if (!baseUrl) {
    try {
      var u = new URL(iframeUrl);
      baseUrl = u.origin + '/balancer-api/proxy/playlists';
    } catch (e) {}
  }

  var headers = {};
  if (token) headers['DLE-API-TOKEN'] = token;
  if (requestId) headers['Iframe-Request-Id'] = requestId;

  return {
    movieId: String(movieId || ''),
    baseUrl: String(baseUrl || ''),
    headers: headers
  };
}

async function loadBalancerItems(iframeUrl){
  var iframeHtml = await network.requestPreferProxy(iframeUrl, {
    type: 'text',
    timeout: 5000,
    retries: 0,
    proxyReferer: iframeUrl
  });

  var meta = parseBalancerMeta(iframeHtml, iframeUrl);
  if (!meta.movieId || !meta.baseUrl) return [];

  var episodes = await network.requestPreferProxy(meta.baseUrl + '/catalog-api/episodes?content-id=' + encodeURIComponent(meta.movieId), {
    type: 'json',
    timeout: 5000,
    retries: 0,
    headers: meta.headers,
    proxyReferer: iframeUrl
  }).catch(function(){ return []; });

  if (!Array.isArray(episodes) || !episodes.length) return [];

  var out = [];
  episodes.forEach(function(ep, idx){
    var season = 1;
    var episode = idx + 1;
    if (ep && ep.season && typeof ep.season.order !== 'undefined') {
      var sn = parseInt(ep.season.order, 10);
      if (!isNaN(sn)) season = sn + 1;
    }
    if (ep && typeof ep.order !== 'undefined') {
      var en = parseInt(ep.order, 10);
      if (!isNaN(en)) episode = en + 1;
    }

    var vars = (ep && Array.isArray(ep.episodeVariants) && ep.episodeVariants.length)
      ? ep.episodeVariants
      : (ep && ep.m3u8MasterFilePath ? [{ filepath: ep.m3u8MasterFilePath, title: '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b' }] : []);

    vars.forEach(function(v, vidx){
      var url = shared.abs(iframeUrl, (v && v.filepath) || '');
      var map = network.sourceMapFromUrl(url);
      if (!Object.keys(map).length) return;
      out.push({
        id: ['lordfilm', 'balancer', season, episode, vidx].join('|'),
        provider: 'lordfilm',
        providerLabel: 'LordFilm',
        voice: shared.clean((v && v.title) || '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'),
        season: season,
        episode: episode,
        maxQuality: '1080p',
        sourceMap: map
      });
    });
  });

  return out;
}

async function loadCdnvideohubItems(info){
  if (!info.titleId || !info.publisherId) return [];
  var url = 'https://plapi.cdnvideohub.com/api/v1/player/sv/playlist?pub=' + encodeURIComponent(info.publisherId) + '&id=' + encodeURIComponent(info.titleId) + '&aggr=' + encodeURIComponent(info.aggregator || 'kp');
  var playlist = await network.requestPreferProxy(url, { type: 'json', timeout: 5000, retries: 0 }).catch(function(){ return null; });
  if (!playlist || !Array.isArray(playlist.items) || !playlist.items.length) return [];

  return playlist.items.map(function(item, idx){
    return {
      id: ['lordfilm', 'cdn', item.vkId || idx].join('|'),
      provider: 'lordfilm',
      providerLabel: 'LordFilm',
      voice: shared.clean(item.voiceStudio || item.voiceType || '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'),
      season: parseInt(item.season, 10) || 0,
      episode: parseInt(item.episode, 10) || 0,
      maxQuality: '1080p',
      vkId: item.vkId || '',
      loadSourceMap: async function(){
        if (!item.vkId) return {};
        var video = await network.requestPreferProxy('https://plapi.cdnvideohub.com/api/v1/player/sv/video/' + encodeURIComponent(item.vkId), {
          type: 'json',
          timeout: 5000,
          retries: 0
        }).catch(function(){ return null; });
        var sources = (video && video.sources) || {};
        var map = {};
        if (sources.hlsUrl) map['Auto HLS'] = network.proxifyStream(sources.hlsUrl);
        if (sources.mpegFullHdUrl) map['1080p'] = network.proxifyStream(sources.mpegFullHdUrl);
        if (sources.mpegHighUrl) map['720p'] = network.proxifyStream(sources.mpegHighUrl);
        if (sources.mpegMediumUrl) map['480p'] = network.proxifyStream(sources.mpegMediumUrl);
        return map;
      }
    };
  });
}

async function loadEmbedItem(embedUrl, label){
  if (!embedUrl) return [];
  var html = await network.requestPreferProxy(embedUrl, {
    type: 'text',
    timeout: 5000,
    retries: 0,
    proxyReferer: embedUrl
  }).catch(function(){ return ''; });
  if (!html) return [];
  var sourceMap = parseEmbedSources(html, embedUrl);
  if (!Object.keys(sourceMap).length) return [];
  return [{
    id: 'lordfilm|embed|' + embedUrl,
    provider: 'lordfilm',
    providerLabel: 'LordFilm',
    voice: shared.clean(label || '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'),
    season: 0,
    episode: 0,
    maxQuality: Object.keys(sourceMap)[0] || '1080p',
    sourceMap: sourceMap,
    embedUrl: embedUrl
  }];
}

function dynamicDomains(meta){
  var out = [];
  var seen = {};
  [meta.title, meta.original_title, meta.original_name].forEach(function(name){
    shared.slugVariants(name).forEach(function(slug){
      var base = 'https://' + slug + '-lordfilm.ru';
      if (seen[base]) return;
      seen[base] = 1;
      out.push(base);
    });
  });
  return out.slice(0, 8);
}

function orderBases(meta, cfg){
  var seen = {};
  var groups = [[], [], []];

  function add(group, base){
    var normalized = shared.normalizeBaseUrl(base);
    if (!normalized || seen[normalized]) return;
    seen[normalized] = 1;
    groups[group].push(normalized);
  }

  MAIN_MIRRORS.forEach(function(base){ add(0, base); });
  if (cfg && cfg.baseUrl) add(0, cfg.baseUrl);
  if (cfg && Array.isArray(cfg.extraBases)) cfg.extraBases.forEach(function(base){ add(0, base); });
  SEO_MIRRORS.forEach(function(base){ add(1, base); });
  dynamicDomains(meta).forEach(function(base){ add(2, base); });

  return groups;
}

function rankCandidate(meta, candidates){
  var ranked = (candidates || []).map(function(candidate){
    return { candidate: candidate, score: shared.matchScore(meta, candidate) };
  }).sort(function(a, b){ return b.score.total - a.score.total; });
  return ranked[0] || null;
}

async function searchByGroup(bases, query){
  var tasks = (bases || []).map(function(base){
    return network.requestPreferProxy(searchUrl(base, query), {
      type: 'text',
      timeout: 3800,
      retries: 0,
      proxyReferer: base + '/'
    }).then(function(html){
      var rows = parseSearch(html, base);
      rows.forEach(function(row){ row.baseUrl = base; });
      return rows;
    }).catch(function(){
      return [];
    });
  });
  var sets = await Promise.all(tasks);
  var out = [];
  sets.forEach(function(set){ if (set && set.length) out = out.concat(set); });
  return out;
}

async function searchDuckDuckGo(meta){
  var q = meta && (meta.title || meta.original_title || meta.original_name);
  if (!q) return '';
  var url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent('site:lordfilm.ru ' + q);
  var html = await network.requestPreferProxy(url, {
    type: 'text',
    timeout: 4000,
    retries: 0,
    proxyReferer: 'https://duckduckgo.com/'
  }).catch(function(){ return ''; });
  if (!html) return '';

  var doc = new DOMParser().parseFromString(html, 'text/html');
  var link = doc.querySelector('a.result__a, a[data-testid="result-title-a"]');
  if (!link) return '';
  var href = link.getAttribute('href') || '';
  try {
    var parsed = new URL(href, 'https://html.duckduckgo.com');
    if (parsed.hostname.indexOf('duckduckgo.com') >= 0) {
      var uddg = parsed.searchParams.get('uddg');
      if (uddg) href = decodeURIComponent(uddg);
    }
  } catch (e) {}
  if (!/lordfilm\.ru/i.test(href)) return '';
  return href;
}

async function resolveCandidate(meta){
  var cfg = shared.getConfig();
  var groups = orderBases(meta, cfg);
  var queries = shared.queryVariants(meta);
  if (!queries.length) queries = [meta.title || meta.original_title || ''];

  var all = [];
  var gi;
  for (gi = 0; gi < groups.length; gi++) {
    var group = groups[gi];
    var qi;
    for (qi = 0; qi < Math.min(4, queries.length); qi++) {
      var set = await searchByGroup(group, queries[qi]);
      if (set.length) {
        all = all.concat(set);
        break;
      }
    }
    if (all.length) break;
  }

  var best = rankCandidate(meta, all);
  if (best && best.candidate && best.score && best.score.total >= 50) {
    return best.candidate;
  }

  var fallbackUrl = await searchDuckDuckGo(meta);
  if (fallbackUrl) {
    return {
      title: meta.title || meta.original_title || fallbackUrl,
      year: meta.year || 0,
      href: fallbackUrl,
      poster: ''
    };
  }

  return null;
}

async function search(meta){
  var candidate = await resolveCandidate(meta);
  if (!candidate || !candidate.href) return [];

  var pageHtml = await network.requestPreferProxy(candidate.href, {
    type: 'text',
    timeout: 5000,
    retries: 0
  }).catch(function(){ return ''; });
  if (!pageHtml) return [];

  var baseUrl = candidate.baseUrl || '';
  try { baseUrl = (new URL(candidate.href)).origin; }
  catch (e) { if (!baseUrl) baseUrl = shared.getConfig().baseUrl; }

  var playerMeta = parsePlayerMeta(pageHtml, baseUrl, candidate.href);
  var out = [];

  if (playerMeta.titleId && playerMeta.publisherId) {
    out = out.concat(await loadCdnvideohubItems(playerMeta));
  }

  if (playerMeta.embedUrl) {
    out = out.concat(await loadEmbedItem(playerMeta.embedUrl, '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'));
  }

  var players = Array.isArray(playerMeta.players) ? playerMeta.players : [];
  var i;
  for (i = 0; i < players.length; i++) {
    var player = players[i];
    if (!player) continue;
    if (player.kind === 'balancer' && player.url) {
      out = out.concat(await loadBalancerItems(player.url).catch(function(){ return []; }));
    } else if (player.kind !== 'cdnvideohub' && player.url) {
      var label = player.kind === 'embed' ? 'Embed' : 'Iframe';
      out = out.concat(await loadEmbedItem(player.url, label).catch(function(){ return []; }));
    }
  }

  return shared.dedupeItems(out);
}

mod.providers = mod.providers || {};
mod.providers.lordfilm = {
  key: 'lordfilm',
  title: 'LordFilm',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});

// ---- collaps.js ----
(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

function parsePlayerObject(html){
  var text = String(html || '').replace(/\n/g, ' ');
  var found = text.match(/makePlayer\s*\(\s*(\{[\s\S]*?\})\s*\);/i);
  if (!found) return null;
  try {
    return (0, eval)('"use strict"; (' + found[1] + ')');
  } catch (e) {
    return null;
  }
}

function maxQuality(json){
  var max = 0;
  try {
    Object.keys(json && json.qualityByWidth || {}).forEach(function(key){
      var q = parseInt((json.qualityByWidth || {})[key], 10);
      if (!isNaN(q)) max = Math.max(max, q);
    });
  } catch (e) {}
  return max ? String(max) + 'p' : '1080p';
}

function mapFromEpisode(episode){
  var src = '';
  if (episode) {
    src = episode.hls || episode.dasha || episode.dash || '';
  }
  return network.sourceMapFromUrl(src);
}

function voiceNames(audio){
  var names = [];
  var src = audio && Array.isArray(audio.names) ? audio.names : [];
  var order = audio && Array.isArray(audio.order) ? audio.order : [];
  var info = src.map(function(name, index){
    return { name: name, order: typeof order[index] === 'number' ? order[index] : 1000 };
  }).sort(function(a, b){ return a.order - b.order; });
  info.forEach(function(item){
    var name = shared.clean(item.name || '');
    if (name && name !== 'delete' && names.indexOf(name) < 0) names.push(name);
  });
  return names;
}

async function search(meta){
  var id = meta && meta.kinopoisk_id ? String(meta.kinopoisk_id) : '';
  var imdb = meta && meta.imdb_id ? String(meta.imdb_id) : '';
  if (!id && !imdb) return [];

  var base = 'https://api.namy.ws/embed/';
  var first = id ? ('kp/' + encodeURIComponent(id)) : ('imdb/' + encodeURIComponent(imdb));
  var fallback = imdb ? ('imdb/' + encodeURIComponent(imdb)) : '';

  var html = await network.requestPreferProxy(base + first, {
    type: 'text',
    timeout: 5000,
    retries: 0,
    proxyReferer: 'https://api.namy.ws/'
  }).catch(function(){ return ''; });

  if (!html && fallback) {
    html = await network.requestPreferProxy(base + fallback, {
      type: 'text',
      timeout: 5000,
      retries: 0,
      proxyReferer: 'https://api.namy.ws/'
    }).catch(function(){ return ''; });
  }

  if (!html) return [];

  var parsed = parsePlayerObject(html);
  if (!parsed) return [];

  var out = [];

  if (parsed.playlist && Array.isArray(parsed.playlist.seasons) && parsed.playlist.seasons.length) {
    parsed.playlist.seasons.forEach(function(season){
      var seasonNum = parseInt(season.season, 10);
      (season.episodes || []).forEach(function(episode){
        var episodeNum = parseInt(episode.episode, 10);
        var voices = voiceNames(episode.audio || {});
        var map = mapFromEpisode(episode);
        if (!Object.keys(map).length) return;
        if (!voices.length) voices = ['\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'];
        voices.forEach(function(voice, idx){
          out.push({
            id: ['collaps', seasonNum, episodeNum, voice, idx].join('|'),
            provider: 'collaps',
            providerLabel: 'Collaps',
            voice: voice,
            season: isNaN(seasonNum) ? 0 : seasonNum,
            episode: isNaN(episodeNum) ? 0 : episodeNum,
            maxQuality: '1080p',
            sourceMap: map
          });
        });
      });
    });
  } else if (parsed.source) {
    var mapMovie = network.sourceMapFromUrl(parsed.source.hls || parsed.source.dasha || parsed.source.dash || '');
    if (!Object.keys(mapMovie).length) return [];
    var voicesMovie = voiceNames(parsed.source.audio || {});
    if (!voicesMovie.length) voicesMovie = ['\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'];
    var quality = maxQuality(parsed);
    voicesMovie.forEach(function(voice, idx){
      out.push({
        id: ['collaps', 'movie', voice, idx].join('|'),
        provider: 'collaps',
        providerLabel: 'Collaps',
        voice: voice,
        season: 0,
        episode: 0,
        maxQuality: quality,
        sourceMap: mapMovie
      });
    });
  }

  return out;
}

mod.providers = mod.providers || {};
mod.providers.collaps = {
  key: 'collaps',
  title: 'Collaps',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});

// ---- alloha.js ----
(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

function parseJsonSafe(text){
  try { return JSON.parse(text); }
  catch (e) { return null; }
}

function collectUrls(input, out){
  if (!input) return;
  if (typeof input === 'string') {
    var parts = input.split(' or ');
    parts.forEach(function(part){
      var url = String(part || '').trim();
      if (!url) return;
      if (/^https?:\/\//i.test(url) || /^\/\//.test(url)) out.push(url);
    });
    return;
  }
  if (Array.isArray(input)) {
    input.forEach(function(node){ collectUrls(node, out); });
    return;
  }
  if (typeof input === 'object') {
    Object.keys(input).forEach(function(key){ collectUrls(input[key], out); });
  }
}

function qualityFromUrl(url){
  var m = String(url || '').match(/(2160|1440|1080|720|480|360|240|144)p?/i);
  return m ? (m[1] + 'p') : '';
}

function buildSourceMap(urls){
  var map = {};
  var ordered = [];
  var seen = {};
  urls.forEach(function(url){
    var full = String(url || '').trim();
    if (!full) return;
    if (/^\/\//.test(full)) full = 'https:' + full;
    if (seen[full]) return;
    seen[full] = 1;
    ordered.push(full);
  });
  ordered.forEach(function(url){
    var label = qualityFromUrl(url);
    if (!label) {
      if (/\.m3u8(?:$|\?)/i.test(url)) label = 'Auto HLS';
      else if (/\.mp4(?:$|\?)/i.test(url)) label = 'MP4';
      else label = 'Auto';
    }
    if (!map[label]) map[label] = network.proxifyStream(url);
  });
  return map;
}

function parseIframeSources(html){
  var text = String(html || '');
  var urls = [];

  var fileListMatch = text.match(/fileList\s*=\s*JSON\.parse\('\s*(\{[\s\S]*?\})\s*'\)/i);
  if (fileListMatch) {
    var raw = fileListMatch[1].replace(/\\'/g, "'").replace(/\\\//g, '/');
    var parsed = parseJsonSafe(raw);
    if (parsed) collectUrls(parsed, urls);
  }

  var regex = /https?:\/\/[^"'\\\s]+(?:\.m3u8|\.mp4)[^"'\\\s]*/ig;
  var found;
  while ((found = regex.exec(text))) {
    urls.push(found[0]);
  }

  return buildSourceMap(urls);
}

async function fetchApi(token, id, isKp){
  var query = isKp ? ('kp=' + encodeURIComponent(id)) : ('imdb=' + encodeURIComponent(id));
  return await network.requestPreferProxy('https://api.apbugall.org/?token=' + encodeURIComponent(token) + '&' + query, {
    type: 'json',
    timeout: 5000,
    retries: 0
  });
}

async function search(meta){
  var cfg = shared.getConfig();
  if (!cfg.allohaToken) return [];

  var ids = [];
  if (meta && meta.kinopoisk_id) ids.push({ id: String(meta.kinopoisk_id), kp: true });
  if (meta && meta.imdb_id) ids.push({ id: String(meta.imdb_id), kp: false });
  if (!ids.length) return [];

  var apiData = null;
  var i;
  for (i = 0; i < ids.length; i++) {
    apiData = await fetchApi(cfg.allohaToken, ids[i].id, ids[i].kp).catch(function(){ return null; });
    if (apiData && apiData.data && apiData.data.iframe) break;
  }

  if (!(apiData && apiData.data && apiData.data.iframe)) return [];

  var iframeUrl = String(apiData.data.iframe || '');
  if (!iframeUrl) return [];

  var iframeHtml = await network.requestPreferProxy(iframeUrl, {
    type: 'text',
    timeout: 5000,
    retries: 0
  }).catch(function(){ return ''; });
  if (!iframeHtml) return [];

  var sourceMap = parseIframeSources(iframeHtml);
  if (!Object.keys(sourceMap).length) return [];

  return [{
    id: 'alloha|' + iframeUrl,
    provider: 'alloha',
    providerLabel: 'Alloha',
    voice: shared.clean((apiData.data.translation || '') || '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'),
    season: 0,
    episode: 0,
    maxQuality: Object.keys(sourceMap)[0] || '1080p',
    sourceMap: sourceMap,
    embedUrl: iframeUrl
  }];
}

mod.providers = mod.providers || {};
mod.providers.alloha = {
  key: 'alloha',
  title: 'Alloha',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});

// ---- kodik.js ----
(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

var streamCache = {};

function decodeKodikLink(str){
  var value = String(str || '');
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || /^\/\//.test(value)) return value;
  try {
    return atob(value.replace(/[a-zA-Z]/g, function(ch){
      var code = ch.charCodeAt(0) + 18;
      var max = ch <= 'Z' ? 90 : 122;
      if (code > max) code -= 26;
      return String.fromCharCode(code);
    }));
  } catch (e) {
    return '';
  }
}

function parseJsonSafe(text){
  try { return JSON.parse(text); }
  catch (e) { return null; }
}

function toLabel(quality){
  var q = parseInt(quality, 10);
  return isNaN(q) ? 'Auto' : String(q) + 'p';
}

function buildSourceMapFromLinks(links){
  var pairs = [];
  Object.keys(links || {}).forEach(function(key){
    var row = links[key];
    var raw = row && row[0] ? row[0].src : '';
    var url = decodeKodikLink(raw);
    if (!url) return;
    pairs.push({ quality: parseInt(key, 10), label: toLabel(key), url: url });
  });
  pairs.sort(function(a, b){
    var aq = isNaN(a.quality) ? -1 : a.quality;
    var bq = isNaN(b.quality) ? -1 : b.quality;
    return bq - aq;
  });
  var map = {};
  pairs.forEach(function(item){
    if (!map[item.label]) map[item.label] = network.proxifyStream(item.url);
  });
  return map;
}

async function resolveKodikSourceMap(link){
  var cacheKey = String(link || '');
  if (!cacheKey) return {};
  if (streamCache[cacheKey]) return streamCache[cacheKey];

  var linkMatch = cacheKey.match(/^(?:https?:)?(\/\/[^\/]+)\//i);
  var origin = 'https:' + (linkMatch ? linkMatch[1] : '//kodik.info');
  var pageUrl = /^https?:/i.test(cacheKey) ? cacheKey : ('https:' + cacheKey);

  var pageHtml = await network.requestPreferProxy(pageUrl, { type: 'text', timeout: 5000, retries: 0 });
  var compact = String(pageHtml || '').replace(/\n/g, ' ');

  var urlParamsMatch = compact.match(/\burlParams\s*=\s*'([^']+)'/);
  var typeMatch = compact.match(/\b(?:videoInfo|vInfo)\.type\s*=\s*'([^']+)'/);
  var hashMatch = compact.match(/\b(?:videoInfo|vInfo)\.hash\s*=\s*'([^']+)'/);
  var idMatch = compact.match(/\b(?:videoInfo|vInfo)\.id\s*=\s*'([^']+)'/);
  var playerMatch = compact.match(/<script[^>]*\bsrc="(\/assets\/js\/app\.player_single[^"]+)"/i);
  if (!urlParamsMatch || !typeMatch || !hashMatch || !idMatch || !playerMatch) return {};

  var urlParams = parseJsonSafe(urlParamsMatch[1]);
  if (!urlParams) return {};

  var postData = '';
  postData += 'd=' + encodeURIComponent(urlParams.d || '');
  postData += '&d_sign=' + encodeURIComponent(urlParams.d_sign || '');
  postData += '&pd=' + encodeURIComponent(urlParams.pd || '');
  postData += '&pd_sign=' + encodeURIComponent(urlParams.pd_sign || '');
  postData += '&ref=' + encodeURIComponent(urlParams.ref || '');
  postData += '&ref_sign=' + encodeURIComponent(urlParams.ref_sign || '');
  postData += '&bad_user=true';
  postData += '&cdn_is_working=true';
  postData += '&type=' + encodeURIComponent(typeMatch[1]);
  postData += '&hash=' + encodeURIComponent(hashMatch[1]);
  postData += '&id=' + encodeURIComponent(idMatch[1]);
  postData += '&info=%7B%7D';

  var playerUrl = origin + playerMatch[1];
  var playerScript = await network.requestPreferProxy(playerUrl, { type: 'text', timeout: 5000, retries: 0 });
  var infoMatch = String(playerScript || '').match(/\$\.ajax\(\{type:\s*"POST",\s*url:\s*atob\("([^"]+)"\)/);
  if (!infoMatch) return {};

  var infoPath = '';
  try { infoPath = atob(infoMatch[1]); }
  catch (e) { infoPath = ''; }
  if (!infoPath) return {};

  var infoUrl = infoPath.indexOf('http') === 0 ? infoPath : (origin + infoPath);
  var info = await network.requestPreferProxy(infoUrl, {
    method: 'POST',
    body: postData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    type: 'json',
    timeout: 5000,
    retries: 0,
    proxyReferer: pageUrl
  });

  var sourceMap = buildSourceMapFromLinks(info && info.links ? info.links : {});
  streamCache[cacheKey] = sourceMap;
  return sourceMap;
}

function appendTitleParams(params, title){
  var words = shared.clean(title || '').replace(/[\s\-+]+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return params;
  words.sort(function(a, b){ return b.length - a.length; });
  params.push(['title', words[0]]);
  return params;
}

async function apiSearch(params){
  var query = params.map(function(pair){
    return encodeURIComponent(pair[0]) + '=' + encodeURIComponent(String(pair[1] || ''));
  }).join('&');
  return await network.requestPreferProxy('https://kodikapi.com/search?' + query, {
    type: 'json',
    timeout: 5000,
    retries: 0
  });
}

function resultVoice(result){
  if (result && result.translation && result.translation.title) return shared.clean(result.translation.title);
  return shared.clean(result && (result.title_orig || result.title) || '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b');
}

function scoreResult(meta, result){
  return shared.matchScore(meta, {
    title: result && (result.title || result.title_orig || result.other_title || ''),
    year: shared.year(result && result.year)
  }).total;
}

function toEntries(meta, results){
  var entries = [];
  (results || []).forEach(function(result){
    var voice = resultVoice(result);
    if (result && result.seasons && typeof result.seasons === 'object') {
      Object.keys(result.seasons).forEach(function(seasonId){
        var seasonData = result.seasons[seasonId] || {};
        var episodes = seasonData.episodes || {};
        Object.keys(episodes).forEach(function(episodeId){
          var link = episodes[episodeId];
          if (!link) return;
          entries.push({
            id: ['kodik', seasonId, episodeId, voice, link].join('|'),
            provider: 'kodik',
            providerLabel: 'Kodik',
            voice: voice,
            season: parseInt(seasonId, 10) || 0,
            episode: parseInt(episodeId, 10) || 0,
            maxQuality: shared.clean(result.quality || '1080p'),
            link: link,
            loadSourceMap: function(){ return resolveKodikSourceMap(link); }
          });
        });
      });
    } else if (result && result.link) {
      var linkMovie = result.link;
      entries.push({
        id: ['kodik', 'movie', voice, linkMovie].join('|'),
        provider: 'kodik',
        providerLabel: 'Kodik',
        voice: voice,
        season: 0,
        episode: 0,
        maxQuality: shared.clean(result.quality || '1080p'),
        link: linkMovie,
        loadSourceMap: function(){ return resolveKodikSourceMap(linkMovie); }
      });
    }
  });
  return entries;
}

async function search(meta){
  var cfg = shared.getConfig();
  if (!cfg.kodikToken) return [];

  var baseParams = [
    ['token', cfg.kodikToken],
    ['limit', 100],
    ['with_episodes', 'true'],
    ['translation_type', 'voice']
  ];

  var attempts = [];
  if (meta && meta.kinopoisk_id) {
    attempts.push(baseParams.concat([['kinopoisk_id', meta.kinopoisk_id]]));
  }
  if (meta && meta.imdb_id) {
    attempts.push(baseParams.concat([['imdb_id', meta.imdb_id]]));
  }

  if (!attempts.length) {
    attempts.push(appendTitleParams(baseParams.slice(), meta.title || meta.original_title || ''));
  }

  var best = [];
  var i;
  for (i = 0; i < attempts.length; i++) {
    var json = await apiSearch(attempts[i]).catch(function(){ return null; });
    var rows = json && Array.isArray(json.results) ? json.results.slice() : [];
    if (!rows.length) continue;
    rows.sort(function(a, b){ return scoreResult(meta, b) - scoreResult(meta, a); });
    best = rows.slice(0, 8);
    if (best.length) break;
  }

  if (!best.length) return [];
  return toEntries(meta, best).slice(0, 120);
}

mod.providers = mod.providers || {};
mod.providers.kodik = {
  key: 'kodik',
  title: 'Kodik',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});

// ---- cdnvideohub.js ----
(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

var QMAP = [
  { key: 'mpeg4kUrl', label: '2160p' },
  { key: 'mpeg2kUrl', label: '1440p' },
  { key: 'mpegQhdUrl', label: '1080p QHD' },
  { key: 'mpegFullHdUrl', label: '1080p' },
  { key: 'mpegHighUrl', label: '720p' },
  { key: 'mpegMediumUrl', label: '480p' },
  { key: 'mpegLowUrl', label: '360p' },
  { key: 'mpegLowestUrl', label: '240p' },
  { key: 'mpegTinyUrl', label: '144p' }
];

function sourceMapFromSources(sources){
  var map = {};
  if (sources && sources.hlsUrl) map['Auto HLS'] = network.proxifyStream(sources.hlsUrl);
  if (sources && sources.dashUrl) map['Auto DASH'] = network.proxifyStream(sources.dashUrl);
  QMAP.forEach(function(def){
    if (sources && sources[def.key]) map[def.label] = network.proxifyStream(sources[def.key]);
  });
  return map;
}

async function loadVideo(vkId){
  return await network.requestPreferProxy('https://plapi.cdnvideohub.com/api/v1/player/sv/video/' + encodeURIComponent(vkId), { type: 'json', timeout: 5000, retries: 0 });
}

async function search(meta){
  if (!meta || !meta.kinopoisk_id || isNaN(parseInt(meta.kinopoisk_id, 10))) return [];

  var playlistUrl = 'https://plapi.cdnvideohub.com/api/v1/player/sv/playlist?pub=12&id=' + encodeURIComponent(parseInt(meta.kinopoisk_id, 10)) + '&aggr=kp';
  var playlist = await network.requestPreferProxy(playlistUrl, { type: 'json', timeout: 5000, retries: 0 });
  if (!playlist || !Array.isArray(playlist.items) || !playlist.items.length) return [];

  return playlist.items.map(function(item, idx){
    var season = (typeof item.season !== 'undefined') ? parseInt(item.season, 10) : 0;
    var episode = (typeof item.episode !== 'undefined') ? parseInt(item.episode, 10) : 0;
    var voice = shared.clean(item.voiceStudio || item.voiceType || '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b');
    return {
      id: 'cdnvideohub|' + (item.vkId || idx),
      provider: 'cdnvideohub',
      providerLabel: 'CDNVideoHub',
      voice: voice,
      season: isNaN(season) ? 0 : season,
      episode: isNaN(episode) ? 0 : episode,
      maxQuality: '1080p',
      vkId: item.vkId || '',
      loadSourceMap: async function(){
        if (!item.vkId) return {};
        var info = await loadVideo(item.vkId);
        return sourceMapFromSources((info || {}).sources || {});
      }
    };
  });
}

mod.providers = mod.providers || {};
mod.providers.cdnvideohub = {
  key: 'cdnvideohub',
  title: 'CDNVideoHub',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});

// ---- rezka.js ----
(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

function parseItem(raw, idx){
  var sourceMap = {};
  if (raw && raw.qualities && typeof raw.qualities === 'object') {
    Object.keys(raw.qualities).forEach(function(label){
      var url = raw.qualities[label];
      if (url) sourceMap[label] = network.proxifyStream(url);
    });
  }
  if (!Object.keys(sourceMap).length && raw && raw.source_map && typeof raw.source_map === 'object') {
    Object.keys(raw.source_map).forEach(function(label){
      var u = raw.source_map[label];
      if (u) sourceMap[label] = network.proxifyStream(u);
    });
  }
  if (!Object.keys(sourceMap).length && raw && raw.url) {
    sourceMap = network.sourceMapFromUrl(raw.url);
  }

  return {
    id: 'rezka|' + (raw.id || idx),
    provider: 'rezka',
    providerLabel: 'HDRezka',
    voice: shared.clean(raw.voice || raw.translation || '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'),
    season: parseInt(raw.season, 10) || 0,
    episode: parseInt(raw.episode, 10) || 0,
    maxQuality: String(raw.max_quality || raw.quality || Object.keys(sourceMap)[0] || '1080p'),
    sourceMap: sourceMap
  };
}

async function search(meta){
  var cfg = shared.getConfig();
  if (!cfg.rezkaWorkerUrl) return [];
  var endpoint = cfg.rezkaWorkerUrl + '/rezka';
  var query = [];
  if (meta && meta.kinopoisk_id) query.push('kinopoisk_id=' + encodeURIComponent(meta.kinopoisk_id));
  if (meta && meta.imdb_id) query.push('imdb_id=' + encodeURIComponent(meta.imdb_id));
  if (meta && meta.title) query.push('title=' + encodeURIComponent(meta.title));
  if (meta && meta.original_title) query.push('original_title=' + encodeURIComponent(meta.original_title));
  if (meta && meta.year) query.push('year=' + encodeURIComponent(meta.year));
  if (!query.length) return [];

  var cookie = String(shared.sget('lordfilm_rezka_cookie', '') || '').trim();
  var json = await network.requestPreferProxy(endpoint + '?' + query.join('&'), {
    type: 'json',
    timeout: 5000,
    retries: 0,
    cookie: cookie,
    proxyReferer: 'https://hdrezka.ag/'
  }).catch(function(){ return null; });

  var items = json && Array.isArray(json.items) ? json.items : [];
  return items.map(parseItem).filter(function(item){
    return item && item.sourceMap && Object.keys(item.sourceMap).length;
  });
}

mod.providers = mod.providers || {};
mod.providers.rezka = {
  key: 'rezka',
  title: 'HDRezka',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});

// ---- filmix.js ----
(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

function parseItem(raw, idx){
  var sourceMap = {};
  if (raw && raw.qualities && typeof raw.qualities === 'object') {
    Object.keys(raw.qualities).forEach(function(label){
      var url = raw.qualities[label];
      if (url) sourceMap[label] = network.proxifyStream(url);
    });
  }
  if (!Object.keys(sourceMap).length && raw && raw.url) {
    sourceMap = network.sourceMapFromUrl(raw.url);
  }
  return {
    id: 'filmix|' + (raw.id || idx),
    provider: 'filmix',
    providerLabel: 'Filmix',
    voice: shared.clean(raw.voice || raw.translation || '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'),
    season: parseInt(raw.season, 10) || 0,
    episode: parseInt(raw.episode, 10) || 0,
    maxQuality: String(raw.max_quality || raw.quality || Object.keys(sourceMap)[0] || '1080p'),
    sourceMap: sourceMap
  };
}

async function search(meta){
  var cfg = shared.getConfig();
  if (!cfg.filmixWorkerUrl) return [];

  var endpoint = cfg.filmixWorkerUrl + '/filmix';
  var query = [];
  if (meta && meta.kinopoisk_id) query.push('kinopoisk_id=' + encodeURIComponent(meta.kinopoisk_id));
  if (meta && meta.imdb_id) query.push('imdb_id=' + encodeURIComponent(meta.imdb_id));
  if (meta && meta.title) query.push('title=' + encodeURIComponent(meta.title));
  if (meta && meta.year) query.push('year=' + encodeURIComponent(meta.year));
  if (!query.length) return [];

  var json = await network.requestPreferProxy(endpoint + '?' + query.join('&'), {
    type: 'json',
    timeout: 5000,
    retries: 0
  }).catch(function(){ return null; });

  var items = json && Array.isArray(json.items) ? json.items : [];
  return items.map(parseItem).filter(function(item){
    return item && item.sourceMap && Object.keys(item.sourceMap).length;
  });
}

mod.providers = mod.providers || {};
mod.providers.filmix = {
  key: 'filmix',
  title: 'Filmix',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});

// ---- kinobase.js ----
(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

function parseItem(raw, idx){
  var sourceMap = {};
  if (raw && raw.qualities && typeof raw.qualities === 'object') {
    Object.keys(raw.qualities).forEach(function(label){
      var url = raw.qualities[label];
      if (url) sourceMap[label] = network.proxifyStream(url);
    });
  }
  if (!Object.keys(sourceMap).length && raw && raw.url) {
    sourceMap = network.sourceMapFromUrl(raw.url);
  }
  return {
    id: 'kinobase|' + (raw.id || idx),
    provider: 'kinobase',
    providerLabel: 'Kinobase',
    voice: shared.clean(raw.voice || raw.translation || '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b'),
    season: parseInt(raw.season, 10) || 0,
    episode: parseInt(raw.episode, 10) || 0,
    maxQuality: String(raw.max_quality || raw.quality || Object.keys(sourceMap)[0] || '1080p'),
    sourceMap: sourceMap
  };
}

async function search(meta){
  var cfg = shared.getConfig();
  if (!cfg.kinobaseWorkerUrl) return [];

  var endpoint = cfg.kinobaseWorkerUrl + '/kinobase';
  var query = [];
  if (meta && meta.kinopoisk_id) query.push('kinopoisk_id=' + encodeURIComponent(meta.kinopoisk_id));
  if (meta && meta.imdb_id) query.push('imdb_id=' + encodeURIComponent(meta.imdb_id));
  if (meta && meta.title) query.push('title=' + encodeURIComponent(meta.title));
  if (meta && meta.year) query.push('year=' + encodeURIComponent(meta.year));
  if (!query.length) return [];

  var json = await network.requestPreferProxy(endpoint + '?' + query.join('&'), {
    type: 'json',
    timeout: 5000,
    retries: 0
  }).catch(function(){ return null; });

  var items = json && Array.isArray(json.items) ? json.items : [];
  return items.map(parseItem).filter(function(item){
    return item && item.sourceMap && Object.keys(item.sourceMap).length;
  });
}

mod.providers = mod.providers || {};
mod.providers.kinobase = {
  key: 'kinobase',
  title: 'Kinobase',
  search: search
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});

// ---- providers.js ----
(function(mod){
'use strict';

var shared = mod.shared;
var network = mod.network;

function listActiveProviders(){
  var cfg = shared.getConfig();
  var out = [];
  shared.PROVIDERS.forEach(function(def){
    var instance = mod.providers && mod.providers[def.key];
    if (!instance) return;
    if (!cfg.providerEnabled[def.key]) return;
    out.push(instance);
  });
  return out;
}

async function runProviders(meta, onUpdate){
  var cfg = shared.getConfig();
  var active = listActiveProviders();
  if (!active.length) return [];

  var timeout = Math.max(1000, parseInt(cfg.timeoutMs, 10) || 5000);
  var tasks = active.map(function(provider){
    return network.withTimeout(Promise.resolve().then(function(){
      return provider.search(meta, {
        config: cfg,
        shared: shared,
        network: network
      });
    }), timeout, provider.key || provider.title || 'provider');
  });

  tasks.forEach(function(task, index){
    var provider = active[index];
    task.then(function(items){
      if (!onUpdate) return;
      onUpdate({
        status: 'fulfilled',
        provider: provider,
        items: Array.isArray(items) ? items : []
      });
    }).catch(function(error){
      if (!onUpdate) return;
      onUpdate({
        status: 'rejected',
        provider: provider,
        reason: error
      });
    });
  });

  var settled = await Promise.allSettled(tasks);
  return settled.map(function(result, index){
    return result.status === 'fulfilled'
      ? { status: 'fulfilled', provider: active[index], items: Array.isArray(result.value) ? result.value : [] }
      : { status: 'rejected', provider: active[index], reason: result.reason };
  });
}

mod.core = mod.core || {};
mod.core.providers = {
  listActiveProviders: listActiveProviders,
  runProviders: runProviders
};

})(window.__LORDFILM_AGG__ = window.__LORDFILM_AGG__ || {});


// ---- index.js ----
(function(){
'use strict';

if (window.reyohoho_plugin_ready) return;
window.reyohoho_plugin_ready = true;

var mod = window.__LORDFILM_AGG__ || {};
if (!mod.shared || !mod.network || !mod.core || !mod.core.providers) {
  console.error('[ReYohohoAggregator] modules are not loaded');
  return;
}

var shared = mod.shared;
var network = mod.network;
var providerCore = mod.core.providers;

var COMPONENT_NAME = 'reyohoho_aggregator';
var PLUGIN_NAME = 'ReYohoho Aggregator';
var BUTTON_LABEL = 'ReYohoho+';
var BTN_CLASS = 'lordfilm-aggregator-start-btn';
var TEMPLATE_NAME = 'lordfilm_aggregator_item';

function ensureStyles(){
  if (!window.Lampa || !Lampa.Template) return;

  if (!document.getElementById('lordfilm-aggregator-style')) {
    var style = document.createElement('style');
    style.id = 'lordfilm-aggregator-style';
    style.innerHTML = [
      '.lordfilm-agg-item{position:relative;padding-left:1.8em;min-height:58px}',
      '.lordfilm-agg-item__title{font-size:1.03em;line-height:1.2}',
      '.lordfilm-agg-item__meta{opacity:.85;padding-top:.25em;font-size:.92em}',
      '.lordfilm-agg-item__badge{position:absolute;right:0;top:.1em;font-size:.9em;opacity:.95}',
      '.lordfilm-agg-item--error .lordfilm-agg-item__title{color:#ff6f6f}',
      '.lordfilm-agg-item.selector.focus,.lordfilm-agg-item.selector.hover{outline:2px solid rgba(255,255,255,.75);outline-offset:2px}'
    ].join('');
    document.head.appendChild(style);
  }

  var templates = Lampa.Template.all ? Lampa.Template.all() : null;
  if (!templates || !templates[TEMPLATE_NAME]) {
    Lampa.Template.add(TEMPLATE_NAME, '<div class="lordfilm-agg-item selector {error_class}"><div class="lordfilm-agg-item__title">{title}</div><div class="lordfilm-agg-item__meta">{meta}</div><div class="lordfilm-agg-item__badge">{badge}</div></div>');
  }
}

function maxQualityFromMap(map){
  var best = '';
  var bestNum = -1;
  Object.keys(map || {}).forEach(function(label){
    var m = String(label || '').match(/(\d{3,4})p/i);
    if (!m) return;
    var value = parseInt(m[1], 10);
    if (isNaN(value)) return;
    if (value > bestNum) {
      bestNum = value;
      best = m[1] + 'p';
    }
  });
  if (best) return best;
  if (map && map['Auto HLS']) return 'HLS';
  return '';
}

function timelineDetailsString(timeline){
  if (!timeline || !window.Lampa || !Lampa.Timeline || !Lampa.Timeline.details) return '';
  try {
    var details = Lampa.Timeline.details(timeline, ' / ');
    if (typeof details === 'string') return details;
    if (details && typeof details.text === 'function') return details.text() || '';
  } catch (e) {}
  return '';
}

function entryHash(meta, item){
  return shared.hash([
    'reyohoho_aggregator',
    meta.id || meta.imdb_id || meta.kinopoisk_id || shared.norm(meta.title || meta.original_title || ''),
    item.provider || 'unknown',
    item.season || 0,
    item.episode || 0,
    shared.norm(item.voice || ''),
    item.id || shared.firstMapUrl(item.sourceMap || {}) || ''
  ]);
}

function buildEntry(meta, item){
  var provider = item.providerLabel || item.provider || 'Provider';
  var voice = shared.clean(item.voice || '\u041e\u0440\u0438\u0433\u0438\u043d\u0430\u043b');
  var quality = item.maxQuality || maxQualityFromMap(item.sourceMap || {}) || 'Auto';
  var serial = item.season > 0 && item.episode > 0;
  var title = serial
    ? ('S' + item.season + 'E' + item.episode + ' | ' + quality + ' | ' + voice + ' (' + provider + ')')
    : (quality + ' | ' + voice + ' (' + provider + ')');

  return {
    id: item.id || shared.hash([provider, item.season || 0, item.episode || 0, voice, quality]),
    provider: item.provider,
    providerLabel: provider,
    voice: voice,
    season: item.season || 0,
    episode: item.episode || 0,
    maxQuality: quality,
    sourceMap: item.sourceMap || {},
    loadSourceMap: item.loadSourceMap,
    hash: entryHash(meta, item),
    title: title,
    meta: serial ? ('\u0421\u0435\u0437\u043e\u043d ' + item.season + ', \u0441\u0435\u0440\u0438\u044f ' + item.episode) : '\u0424\u0438\u043b\u044c\u043c',
    badge: provider,
    isError: false
  };
}

function buildErrorEntry(providerName, message){
  return {
    id: 'error|' + providerName,
    title: '\u041e\u0448\u0438\u0431\u043a\u0430 ' + providerName,
    meta: message,
    badge: 'debug',
    hash: 'error|' + providerName,
    isError: true
  };
}

function resolveSourceMap(entry){
  return Promise.resolve().then(async function(){
    if (entry.sourceMap && Object.keys(entry.sourceMap).length) return entry.sourceMap;
    if (entry.loadSourceMap && typeof entry.loadSourceMap === 'function') {
      var map = await entry.loadSourceMap();
      entry.sourceMap = map || {};
      if (!entry.maxQuality) entry.maxQuality = maxQualityFromMap(entry.sourceMap);
      return entry.sourceMap;
    }
    return {};
  });
}

function sortEntries(entries){
  return entries.slice().sort(function(a, b){
    if (!!a.isError !== !!b.isError) return a.isError ? 1 : -1;
    if ((a.season || 0) !== (b.season || 0)) return (a.season || 0) - (b.season || 0);
    if ((a.episode || 0) !== (b.episode || 0)) return (a.episode || 0) - (b.episode || 0);
    return String(a.title || '').localeCompare(String(b.title || ''), 'ru');
  });
}

function mergeEntries(existing, additions){
  var merged = [];
  var seen = {};
  existing.concat(additions).forEach(function(entry){
    if (!entry) return;
    var key = [
      entry.provider || 'error',
      entry.season || 0,
      entry.episode || 0,
      shared.norm(entry.voice || ''),
      entry.id || '',
      shared.firstMapUrl(entry.sourceMap || {})
    ].join('|');
    if (seen[key]) return;
    seen[key] = 1;
    merged.push(entry);
  });
  return sortEntries(merged);
}

function makeComponent(object){
  var _this = this;
  var meta = shared.cardMeta(object);
  var files = new Lampa.Explorer(object);
  var scroll = new Lampa.Scroll({ mask: true, over: true });
  var st = {
    entries: [],
    finished: false,
    last: null,
    loading: false,
    loadingEntries: {},
    providerStates: {}
  };

  scroll.body().addClass('torrent-list');
  scroll.minus(files.render().find('.explorer__files-head'));

  function loading(value){
    st.loading = !!value;
    if (_this.activity) _this.activity.loader(!!value);
    if (!value && _this.activity && Lampa.Activity.active().activity === _this.activity) {
      _this.activity.toggle();
    }
  }

  function empty(message){
    scroll.clear();
    var cell = Lampa.Template.get('list_empty');
    if (message) cell.find('.empty__descr').text(message);
    scroll.append(cell);
    loading(false);
  }

  function append(item){
    item.on('hover:focus', function(event){
      st.last = event.target;
      scroll.update($(event.target), true);
    });
    scroll.append(item);
  }

  function renderEntries(){
    scroll.render().find('.empty').remove();
    scroll.clear();
    scroll.reset();

    if (!st.entries.length) {
      if (st.finished) empty('\u041a\u043e\u043d\u0442\u0435\u043d\u0442 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d \u043d\u0438 \u0432 \u043e\u0434\u043d\u043e\u0439 \u0431\u0430\u0437\u0435');
      return;
    }

    st.entries.forEach(function(entry){
      var timeline = entry.isError ? null : Lampa.Timeline.view(entry.hash);
      var metaText = entry.meta || '';
      if (timeline && timeline.time) {
        metaText += (metaText ? ' / ' : '') + '\u041f\u043e\u0437\u0438\u0446\u0438\u044f: ' + Lampa.Utils.secondsToTime(timeline.time);
      }

      var item = Lampa.Template.get(TEMPLATE_NAME, {
        title: entry.title,
        meta: metaText,
        badge: entry.badge || '',
        error_class: entry.isError ? 'lordfilm-agg-item--error' : ''
      });

      if (!entry.isError && timeline) {
        item.append(Lampa.Timeline.render(timeline));
        var details = timelineDetailsString(timeline);
        if (details) item.find('.lordfilm-agg-item__meta').append(' / ' + details);
      }

      item.on('hover:enter', function(){
        if (entry.isError) return;
        playEntry(entry);
      });

      append(item);
    });

    _this.start(true);
  }

  function buildEpisodeQueue(entry){
    if (!(entry.season > 0 && entry.episode > 0)) return [entry];
    var list = st.entries.filter(function(row){
      return !row.isError &&
        row.provider === entry.provider &&
        row.season === entry.season &&
        row.voice === entry.voice;
    }).sort(function(a, b){ return a.episode - b.episode; });
    var startIndex = list.findIndex(function(row){ return row.episode === entry.episode; });
    if (startIndex < 0) startIndex = 0;
    return list.slice(startIndex);
  }

  async function buildPlayerCell(entry){
    var map = await resolveSourceMap(entry);
    var picked = network.pickQuality(map, '');
    if (!picked.url) throw new Error('\u041d\u0435\u0432\u0430\u043b\u0438\u0434\u043d\u044b\u0439 \u043f\u043e\u0442\u043e\u043a');
    var timeline = Lampa.Timeline.view(entry.hash);
    return {
      url: picked.url,
      quality: map,
      timeline: timeline,
      title: entry.title
    };
  }

  async function playEntry(entry){
    if (st.loadingEntries[entry.id]) return;
    st.loadingEntries[entry.id] = true;

    try {
      if (meta.movie && meta.movie.id) Lampa.Favorite.add('history', meta.movie, 100);
      loading(true);

      var queue = buildEpisodeQueue(entry);
      var first = await buildPlayerCell(queue[0]);
      var playlist = [first];

      if (queue.length > 1) {
        queue.slice(1).forEach(function(next){
          var cell = {
            url: function(call){
              buildPlayerCell(next).then(function(data){
                cell.url = data.url;
                cell.quality = data.quality;
                cell.timeline = data.timeline;
                call();
              }).catch(function(){
                cell.url = '';
                call();
              });
            },
            timeline: Lampa.Timeline.view(next.hash),
            title: next.title
          };
          playlist.push(cell);
        });
      }

      Lampa.Player.play(first);
      Lampa.Player.playlist(playlist);
    } catch (err) {
      Lampa.Noty.show(network.errMessage(err));
    } finally {
      st.loadingEntries[entry.id] = false;
      loading(false);
    }
  }

  function providerStatusText(){
    var names = [];
    Object.keys(st.providerStates).forEach(function(key){
      var state = st.providerStates[key];
      if (state === 'ok') names.push(key + ': ok');
      else if (state === 'error') names.push(key + ': err');
    });
    return names.join(' / ');
  }

  async function bootstrap(){
    if (!meta.title && !meta.original_title) {
      empty('\u0412 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0435 \u043e\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435');
      return;
    }

    st.finished = false;
    st.entries = [];
    st.providerStates = {};
    loading(true);

    await providerCore.runProviders(meta, function(update){
      var providerName = update.provider && update.provider.title ? update.provider.title : (update.provider && update.provider.key ? update.provider.key : 'provider');
      if (update.status === 'fulfilled') {
        st.providerStates[providerName] = 'ok';
        var entries = (update.items || []).map(function(item){ return buildEntry(meta, item); });
        if (entries.length) {
          st.entries = mergeEntries(st.entries, entries);
          renderEntries();
        }
      } else {
        st.providerStates[providerName] = 'error';
        shared.log('provider failed', providerName, update.reason && update.reason.message ? update.reason.message : update.reason);
        if (shared.getConfig().debug) {
          st.entries = mergeEntries(st.entries, [buildErrorEntry(providerName, network.errMessage(update.reason))]);
          renderEntries();
        }
      }
    });

    st.finished = true;
    if (!st.entries.length) {
      empty('\u041a\u043e\u043d\u0442\u0435\u043d\u0442 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d \u043d\u0438 \u0432 \u043e\u0434\u043d\u043e\u0439 \u0431\u0430\u0437\u0435');
    } else {
      var status = providerStatusText();
      if (status && shared.getConfig().debug) Lampa.Noty.show(status);
      loading(false);
      renderEntries();
    }
  }

  this.create = function(){
    ensureStyles();
    files.appendFiles(scroll.render());
    bootstrap();
    return this.render();
  };

  this.render = function(){ return files.render(); };

  this.start = function(first){
    if (Lampa.Activity.active().activity !== this.activity) return;
    if (first && !st.last) st.last = scroll.render().find('.selector').eq(0)[0];

    Lampa.Background.immediately(Lampa.Utils.cardImgBackground(meta.movie));
    Lampa.Controller.add('content', {
      toggle: function(){
        Lampa.Controller.collectionSet(scroll.render(), files.render());
        Lampa.Controller.collectionFocus(st.last || false, scroll.render());
      },
      up: function(){ if (Navigator.canmove('up')) Navigator.move('up'); else Lampa.Controller.toggle('head'); },
      down: function(){ Navigator.move('down'); },
      right: function(){ if (Navigator.canmove('right')) Navigator.move('right'); else Lampa.Controller.toggle('menu'); },
      left: function(){ if (Navigator.canmove('left')) Navigator.move('left'); else Lampa.Controller.toggle('menu'); },
      back: this.back
    });
    Lampa.Controller.toggle('content');
  };

  this.back = function(){ Lampa.Activity.backward(); };
  this.pause = function(){};
  this.stop = function(){};
  this.destroy = function(){ files.destroy(); scroll.destroy(); st.entries = []; };
}

function openFromCard(movie){
  Lampa.Component.add(COMPONENT_NAME, makeComponent);
  Lampa.Activity.push({
    url: '',
    title: PLUGIN_NAME,
    component: COMPONENT_NAME,
    search: (movie && movie.title) || '',
    search_one: (movie && movie.title) || '',
    search_two: (movie && movie.original_title) || '',
    movie: movie || {},
    page: 1
  });
}

function appendSourceButton(root, movie){
  if (!root || !root.find) return;
  if (root.find('.' + BTN_CLASS).length) return;

  var icon = '<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><circle cx="64" cy="64" r="56" stroke="currentColor" stroke-width="12" fill="none"/><path d="M88 64L48 88V40z" fill="currentColor"/></svg>';
  var button = $('<div class="full-start__button selector ' + BTN_CLASS + '" data-subtitle="' + PLUGIN_NAME + ' ' + shared.VERSION + '">' + icon + '<span>' + BUTTON_LABEL + '</span></div>');
  button.on('hover:enter', function(){ openFromCard(movie || {}); });

  var target = root.find('.buttons--container .view--torrent');
  if (target.length) { target.after(button); return; }

  var container = root.find('.buttons--container');
  if (container.length) container.append(button);
}

function addSourceButtonWatcher(){
  Lampa.Listener.follow('full', function(event){
    if (event.type !== 'complite') return;
    var root = event.object.activity.render();
    appendSourceButton(root, event.data && event.data.movie ? event.data.movie : {});
  });

  try {
    var active = Lampa.Activity.active && Lampa.Activity.active();
    if (active && active.component === 'full' && active.activity && active.activity.render) {
      appendSourceButton(active.activity.render(), active.card || active.movie || {});
    }
  } catch (e) {}
}

function registerSettings(){
  if (window.reyohoho_aggregator_settings_ready) return;
  window.reyohoho_aggregator_settings_ready = true;

  if (!Lampa.SettingsApi || !Lampa.SettingsApi.addParam) return;

  shared.PROVIDERS.forEach(function(provider){
    var key = shared.STORAGE.providerPrefix + provider.key;
    var current = shared.sget(key, null);
    if (current === null || typeof current === 'undefined' || current === '') {
      shared.sset(key, provider.enabled ? 'true' : 'false');
    }

    Lampa.SettingsApi.addParam({
      component: 'plugins',
      param: {
        name: key,
        type: 'select',
        values: {
          'true': '\u0412\u043a\u043b',
          'false': '\u0412\u044b\u043a\u043b'
        },
        "default": provider.enabled ? 'true' : 'false'
      },
      field: {
        name: PLUGIN_NAME + ': ' + provider.title
      },
      onChange: function(value){
        shared.sset(key, String(value));
      }
    });
  });

  Lampa.SettingsApi.addParam({
    component: 'plugins',
    param: {
      name: shared.STORAGE.debug,
      type: 'select',
      values: {
        'false': '\u041e\u0431\u044b\u0447\u043d\u044b\u0439',
        'true': 'Debug'
      },
      "default": 'false'
    },
    field: {
      name: PLUGIN_NAME + ': Debug mode'
    },
    onChange: function(value){
      shared.sset(shared.STORAGE.debug, String(value));
    }
  });
}

function init(){
  if (window.reyohoho_plugin_inited) return;
  ensureStyles();
  registerSettings();
  Lampa.Component.add(COMPONENT_NAME, makeComponent);

  Lampa.Manifest.plugins = {
    type: 'video',
    version: shared.VERSION,
    name: PLUGIN_NAME + ' - ' + shared.VERSION,
    description: 'ReYohoho + online balancers',
    component: COMPONENT_NAME,
    onContextMenu: function(){
      return {
        name: '\u0421\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0447\u0435\u0440\u0435\u0437 ' + PLUGIN_NAME,
        description: ''
      };
    },
    onContextLauch: function(object){
      openFromCard(object || {});
    }
  };

  addSourceButtonWatcher();
  window.reyohoho_plugin_inited = true;
  shared.log('initialized', shared.VERSION);
}

function bootstrap(){
  if (window.reyohoho_plugin_bootstrapped) return;
  window.reyohoho_plugin_bootstrapped = true;

  var start = function(){
    try { init(); }
    catch (e) { console.error('[ReYohohoAggregator] init error', e); }
  };

  if (window.appready) start();
  else if (window.Lampa && Lampa.Listener) {
    Lampa.Listener.follow('app', function(event){ if (event.type === 'ready') start(); });
    setTimeout(start, 2500);
  }
  else setTimeout(start, 1500);
}

bootstrap();

})();

