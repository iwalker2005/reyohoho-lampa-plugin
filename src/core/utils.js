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
