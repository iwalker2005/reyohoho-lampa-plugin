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
