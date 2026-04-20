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
