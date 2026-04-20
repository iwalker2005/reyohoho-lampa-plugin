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

  if (!Lampa.Template.get(TEMPLATE_NAME, {}, true)) {
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
