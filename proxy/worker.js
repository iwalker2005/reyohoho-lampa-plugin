const VERSION = '2.1.0';

const PLUGIN_SOURCE_URL = 'https://raw.githubusercontent.com/iwalker2005/lampa-lordfilm-plugin/main/reyohoho.js';

const DEFAULT_ALLOWED_HOSTS = [
  'lordfilm-2026.org',
  'www.lordfilm-2026.org',
  'lordfilmpuq.study',
  'www.lordfilmpuq.study',
  'gentalmen-lordfilm.ru',
  'www.gentalmen-lordfilm.ru',
  '12-angry-men-lordfilm.ru',
  'www.12-angry-men-lordfilm.ru',
  'spongebob-squarepants-lordfilms.ru',
  'www.spongebob-squarepants-lordfilms.ru',
  'html.duckduckgo.com',
  '*.lordfilm.ru',
  'plapi.cdnvideohub.com',
  'player.cdnvideohub.com',
  'kinobd.net',
  '*.kbd.so',
  'api.kinobox.tv',
  'tapeop.dev',
  'api.namy.ws',
  'api.zenithjs.ws',
  '*.videoframe2.com',
  '*.flixcdn.space',
  '*.obrut.show',
  'kinovibe.cc',
  '*.kvb.cool',
  'ashdi.vip',
  '*.fotpro135alto.com',
  'api.videoseed.tv',
  'vibix.org',
  'portal.lumex.host',
  'api.lumex.space',
  'p.lumex.space',
  'kvk.zone',
  'redheadsound.studio',
  'anilib.me',
  'api2.mangalib.me',
  'api.kinogram.best',
  'api.apbugall.org',
  'kodikapi.com',
  'kodik.info',
  'kodik.biz',
  'rezka.ag',
  'hdrezka.ag',
  'filmix.my',
  'kinobase.org',
  'api.rstprgapipt.com',
  '*.okcdn.ru',
  '*.allarknow.online',
  '*.stloadi.live'
];

const DEFAULT_VIDEO_HOSTS = [
  '*.okcdn.ru',
  '*.vkuser.net',
  '*.interkh.com',
  '*.stloadi.live',
  '*.flixcdn.space',
  '*.videoseed.tv',
  '*.kinovibe.cc',
  '*.kvb.cool',
  'ashdi.vip',
  '*.fotpro135alto.com',
  '*.kodik.info',
  '*.kodik.biz',
  '*.kodikapi.com',
  '*.kinobase.org',
  '*.filmix.my',
  '*.rezka.ag',
  '*.rezka.pub',
  'plapi.cdnvideohub.com',
  'player.cdnvideohub.com'
];

function splitHosts(value, fallback) {
  if (!value) return fallback.slice();
  return value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
}

function hostAllowed(hostname, rules) {
  hostname = String(hostname || '').toLowerCase();
  return rules.some((rule) => {
    if (!rule) return false;
    if (rule.startsWith('*.')) {
      const suffix = rule.slice(1);
      const root = rule.slice(2);
      return hostname === root || hostname.endsWith(suffix);
    }
    return hostname === rule;
  });
}

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Proxy-Token, X-Proxy-Cookie, Range, X-Requested-With, Borth, DLE-API-TOKEN, Iframe-Request-Id, Authorization',
    'Access-Control-Expose-Headers': 'Content-Type, Content-Length, Content-Range, Accept-Ranges, Cache-Control, ETag, Set-Cookie',
    'Vary': 'Origin',
    ...extra
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' })
  });
}

function getSetCookies(headers) {
  try {
    if (typeof headers.getSetCookie === 'function') {
      const list = headers.getSetCookie();
      if (Array.isArray(list)) return list;
    }
  } catch (e) {}
  const out = [];
  headers.forEach((value, key) => {
    if (String(key || '').toLowerCase() === 'set-cookie') out.push(value);
  });
  return out;
}

function toStreamUrl(proxyBase, target, token = '') {
  const proxied = new URL('/stream', proxyBase);
  proxied.searchParams.set('url', target.toString());
  if (token) proxied.searchParams.set('token', token);
  return proxied.toString();
}

function rewriteM3u8Body(body, sourceUrl, proxyBase, token = '') {
  return String(body || '')
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        let out = line.replace(/URI="([^"]+)"/g, (_, uri) => {
          const absolute = new URL(uri, sourceUrl);
          return `URI="${toStreamUrl(proxyBase, absolute, token)}"`;
        });
        out = out.replace(/URI='([^']+)'/g, (_, uri) => {
          const absolute = new URL(uri, sourceUrl);
          return `URI='${toStreamUrl(proxyBase, absolute, token)}'`;
        });
        return out;
      }

      if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:/i.test(trimmed)) return line;
      const absolute = new URL(trimmed, sourceUrl);
      return toStreamUrl(proxyBase, absolute, token);
    })
    .join('\n');
}

function getToken(request, url) {
  return request.headers.get('X-Proxy-Token') || url.searchParams.get('token') || '';
}

function authOk(request, url, env) {
  const required = String(env.PROXY_TOKEN || '').trim();
  if (!required) return true;
  return getToken(request, url) === required;
}

async function forwardRequest(request, targetUrl, {
  timeoutMs = 12000,
  wrapJson = false,
  streamMode = false,
  proxyBase = '',
  streamToken = '',
  refererOverride = '',
  originOverride = '',
  cookieOverride = ''
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const sourceMethod = String(request.method || 'GET').toUpperCase();
    const method = streamMode
      ? (sourceMethod === 'HEAD' ? 'HEAD' : 'GET')
      : sourceMethod;
    const headers = new Headers();

    const copy = [
      'user-agent',
      'accept',
      'accept-language',
      'if-none-match',
      'if-modified-since',
      'range',
      'content-type',
      'cookie',
      'x-requested-with',
      'borth',
      'dle-api-token',
      'iframe-request-id',
      'authorization'
    ];
    copy.forEach((h) => {
      const v = request.headers.get(h);
      if (v) headers.set(h, v);
    });
    if (cookieOverride) headers.set('Cookie', String(cookieOverride));

    let rf = '';
    if (refererOverride) {
      try {
        rf = new URL(refererOverride).toString();
      } catch (e) {
        rf = '';
      }
    }

    const forceOriginHeaders = !/^(?:.*\.)?api\.namy\.ws$/i.test(targetUrl.hostname);
    let of = '';
    if (originOverride) {
      try {
        of = new URL(originOverride).origin;
      } catch (e) {
        of = '';
      }
    }
    if (rf) {
      headers.set('Referer', rf);
      if (of) {
        headers.set('Origin', of);
      } else if (forceOriginHeaders) {
        try {
          headers.set('Origin', new URL(rf).origin);
        } catch (e) {
          headers.set('Origin', targetUrl.origin);
        }
      }
    } else if (of) {
      headers.set('Origin', of);
      headers.set('Referer', of + '/');
    } else if (forceOriginHeaders) {
      headers.set('Origin', targetUrl.origin);
      headers.set('Referer', targetUrl.origin + '/');
    }

    let body;
    if (method !== 'GET' && method !== 'HEAD') {
      body = await request.clone().arrayBuffer();
    }

    const upstream = await fetch(targetUrl.toString(), {
      method,
      headers,
      body,
      redirect: 'follow',
      signal: controller.signal
    });

    if (wrapJson) {
      const body = await upstream.text();
      const setCookie = getSetCookies(upstream.headers);
      const headerDump = {};
      upstream.headers.forEach((v, k) => {
        if (String(k).toLowerCase() === 'set-cookie') return;
        headerDump[k] = v;
      });
      return json({
        status: upstream.status,
        content_type: upstream.headers.get('content-type') || 'text/plain; charset=utf-8',
        body,
        headers: headerDump,
        set_cookie: setCookie
      }, upstream.ok ? 200 : upstream.status);
    }

    const passHeaders = new Headers();
    const copyResponseHeaders = streamMode
      ? ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control', 'etag']
      : ['content-type', 'cache-control', 'etag'];

    copyResponseHeaders.forEach((h) => {
      const v = upstream.headers.get(h);
      if (v) passHeaders.set(h, v);
    });
    getSetCookies(upstream.headers).forEach((cookie) => {
      passHeaders.append('Set-Cookie', cookie);
    });

    Object.entries(corsHeaders()).forEach(([k, v]) => passHeaders.set(k, v));

    const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
    const isM3u8 = streamMode && (
      contentType.includes('mpegurl') ||
      contentType.includes('vnd.apple.mpegurl') ||
      /\.m3u8(?:$|\?)/i.test(targetUrl.pathname + targetUrl.search)
    );

    if (isM3u8 && method !== 'HEAD') {
      const manifest = await upstream.text();
      const rewritten = rewriteM3u8Body(manifest, targetUrl, proxyBase || request.url, streamToken);
      return new Response(rewritten, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: passHeaders
      });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: passHeaders
    });
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const timeoutMs = Math.max(5000, parseInt(env.UPSTREAM_TIMEOUT_MS || '12000', 10) || 12000);
    const allowedHosts = splitHosts(env.ALLOWED_HOSTS, DEFAULT_ALLOWED_HOSTS);
    const videoHosts = splitHosts(env.VIDEO_ALLOWED_HOSTS, DEFAULT_VIDEO_HOSTS);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === '/' || url.pathname === '/p' || url.pathname === '/plugin' || url.pathname === '/plugin.js') {
      try {
        const upstream = await fetch(PLUGIN_SOURCE_URL, { method: 'GET', redirect: 'follow' });
        if (!upstream.ok) return json({ status: upstream.status, error: 'Plugin source is unavailable' }, upstream.status);
        const body = await upstream.text();
        return new Response(body, {
          status: 200,
          headers: corsHeaders({
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'public, max-age=300'
          })
        });
      } catch (e) {
        return json({ status: 502, error: 'Plugin endpoint failed' }, 502);
      }
    }

    if (url.pathname === '/health') {
      return json({ ok: true, version: VERSION, time: new Date().toISOString() });
    }

    if (url.pathname === '/proxy') {
      if (!authOk(request, url, env)) return json({ status: 403, error: 'Forbidden' }, 403);
      if (!['GET', 'HEAD', 'POST'].includes(request.method)) {
        return json({ status: 405, error: 'Method not allowed' }, 405);
      }

      const raw = url.searchParams.get('url');
      if (!raw) return json({ status: 400, error: 'Missing `url` query param' }, 400);

      let target;
      try {
        target = new URL(raw);
      } catch (e) {
        return json({ status: 400, error: 'Invalid target URL' }, 400);
      }

      if (!/^https?:$/i.test(target.protocol)) return json({ status: 400, error: 'Only http/https URLs are allowed' }, 400);
      if (!hostAllowed(target.hostname, allowedHosts)) return json({ status: 403, error: 'Target host is not allowed' }, 403);

      const wrap = url.searchParams.get('wrap') === '1';
      const refererOverride = url.searchParams.get('rf') || '';
      const originOverride = url.searchParams.get('of') || '';
      const cookieOverride = request.headers.get('X-Proxy-Cookie') || url.searchParams.get('cookie') || '';
      try {
        return await forwardRequest(request, target, {
          timeoutMs,
          wrapJson: wrap,
          streamMode: false,
          refererOverride,
          originOverride,
          cookieOverride
        });
      } catch (e) {
        if (e.name === 'AbortError') return json({ status: 504, error: 'Upstream timeout' }, 504);
        return json({ status: 502, error: 'Upstream request failed' }, 502);
      }
    }

    if (url.pathname === '/stream') {
      if (!authOk(request, url, env)) return json({ status: 403, error: 'Forbidden' }, 403);
      if (!['GET', 'HEAD'].includes(request.method)) {
        return json({ status: 405, error: 'Method not allowed' }, 405);
      }

      const raw = url.searchParams.get('url');
      if (!raw) return json({ status: 400, error: 'Missing `url` query param' }, 400);

      let target;
      try {
        target = new URL(raw);
      } catch (e) {
        return json({ status: 400, error: 'Invalid target URL' }, 400);
      }

      if (!/^https?:$/i.test(target.protocol)) return json({ status: 400, error: 'Only http/https URLs are allowed' }, 400);
      if (!hostAllowed(target.hostname, videoHosts)) return json({ status: 403, error: 'Video host is not allowed' }, 403);

      const streamToken = url.searchParams.get('token') || '';
      const refererOverride = url.searchParams.get('rf') || '';
      const originOverride = url.searchParams.get('of') || '';
      const cookieOverride = request.headers.get('X-Proxy-Cookie') || url.searchParams.get('cookie') || '';
      try {
        return await forwardRequest(request, target, {
          timeoutMs,
          wrapJson: false,
          streamMode: true,
          proxyBase: url.origin,
          streamToken,
          refererOverride,
          originOverride,
          cookieOverride
        });
      } catch (e) {
        if (e.name === 'AbortError') return json({ status: 504, error: 'Upstream timeout' }, 504);
        return json({ status: 502, error: 'Stream proxy failed' }, 502);
      }
    }

    return json({ status: 404, error: 'Not Found' }, 404);
  }
};
