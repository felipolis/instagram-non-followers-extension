import { applyI18n, t } from './lib/i18n.js';
import { formatNumber, formatRelativeTime } from './lib/format.js';
import { getIgnoreList, getLastResult, setIgnoreList } from './lib/storage.js';

// Maps content-script error codes (and popup-side ones) to i18n keys.
const ERROR_KEYS = {
  OPEN_INSTAGRAM: 'errOpenInstagram',
  OPEN_PROFILE: 'errOpenProfile',
  OWN_PROFILE: 'errOwnProfile',
  NO_SESSION: 'errNoSession',
  PROFILE_FETCH: 'errProfileFetch',
  RATE_LIMITED: 'errRateLimited',
  BLOCKED: 'errBlocked',
  HTTP: 'errHttp',
  NETWORK: 'errNetwork',
  SAFETY_LIMIT: 'errSafetyLimit',
  ALREADY_RUNNING: 'errAlreadyRunning',
  NO_TAB: 'errNoTab',
  NOT_INSTAGRAM: 'errNotInstagram',
  GENERIC: 'errGeneric'
};

const els = {
  analyzeBtn: document.getElementById('analyzeBtn'),
  lastRun: document.getElementById('lastRun'),
  progress: document.getElementById('progress'),
  progressFill: document.getElementById('progressFill'),
  progressLabel: document.getElementById('progressLabel'),
  alert: document.getElementById('alert'),
  summary: document.getElementById('summary'),
  statFollowing: document.getElementById('statFollowing'),
  statFollowers: document.getElementById('statFollowers'),
  statMutual: document.getElementById('statMutual'),
  statNonFollowers: document.getElementById('statNonFollowers'),
  results: document.getElementById('results'),
  tabs: Array.from(document.querySelectorAll('.tab')),
  countNonFollowers: document.getElementById('countNonFollowers'),
  countFans: document.getElementById('countFans'),
  search: document.getElementById('search'),
  ignoredToggleWrap: document.getElementById('ignoredToggleWrap'),
  showIgnored: document.getElementById('showIgnored'),
  list: document.getElementById('list'),
  copyBtn: document.getElementById('copyBtn'),
  csvBtn: document.getElementById('csvBtn'),
  jsonBtn: document.getElementById('jsonBtn'),
  toast: document.getElementById('toast')
};

const state = {
  result: null,
  view: 'nonFollowers',
  search: '',
  showIgnored: false,
  ignore: new Set(),
  busy: false
};

let toastTimer = null;

// --- Utilities --------------------------------------------------------------

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function localizedError(code, fallback) {
  const key = ERROR_KEYS[code];
  const message = key ? chrome.i18n.getMessage(key) : '';
  return message || fallback || t('errGeneric');
}

function initialsOf(user) {
  const source = (user.fullName || user.username || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return initials.toUpperCase();
}

function colorFor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i += 1) {
    hash = (hash << 5) - hash + username.charCodeAt(i);
    hash |= 0;
  }
  return `hsl(${Math.abs(hash) % 360}, 55%, 42%)`;
}

function profileUrl(username) {
  return `https://www.instagram.com/${encodeURIComponent(username)}/`;
}

// --- State views ------------------------------------------------------------

function getActiveList() {
  if (!state.result) return [];
  return state.view === 'fans' ? state.result.fans : state.result.nonFollowers;
}

function getVisibleList() {
  let list = getActiveList();

  if (state.view === 'nonFollowers' && !state.showIgnored) {
    list = list.filter((user) => !state.ignore.has(user.username));
  }

  const query = state.search.trim().toLowerCase();
  if (query) {
    list = list.filter(
      (user) =>
        user.username.toLowerCase().includes(query) ||
        (user.fullName || '').toLowerCase().includes(query)
    );
  }

  return list;
}

// --- Rendering --------------------------------------------------------------

const VERIFIED_BADGE =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l2.6 1.9 3.2-.3 1 3 2.7 1.7-1 3 1 3-2.7 1.7-1 3-3.2-.3L12 23l-2.6-1.9-3.2.3-1-3L2.5 15l1-3-1-3 2.7-1.7 1-3 3.2.3z"/><path d="M10.6 14.6l-2.1-2.1-1.4 1.4 3.5 3.5 6-6-1.4-1.4z" fill="#0e0f14"/></svg>';

function buildAvatar(user) {
  const wrap = document.createElement('div');
  wrap.className = 'avatar';

  const showInitials = () => {
    wrap.replaceChildren(document.createTextNode(initialsOf(user)));
    wrap.style.background = colorFor(user.username);
  };

  if (user.profilePicUrl) {
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.src = user.profilePicUrl;
    img.addEventListener('error', showInitials);
    wrap.appendChild(img);
  } else {
    showInitials();
  }

  return wrap;
}

function buildUserRow(user, { ignorable }) {
  const row = document.createElement('div');
  row.className = 'user';
  const isIgnored = state.ignore.has(user.username);
  if (isIgnored) row.classList.add('is-ignored');

  row.appendChild(buildAvatar(user));

  const main = document.createElement('div');
  main.className = 'user-main';

  const handleLink = document.createElement('a');
  handleLink.className = 'user-handle';
  handleLink.href = profileUrl(user.username);
  handleLink.target = '_blank';
  handleLink.rel = 'noreferrer';
  handleLink.textContent = `@${user.username}`;
  handleLink.title = t('linkOpenProfile');

  if (user.fullName) {
    const top = document.createElement('div');
    top.className = 'user-top';

    const name = document.createElement('span');
    name.className = 'user-fullname';
    name.textContent = user.fullName;
    top.appendChild(name);

    appendBadges(top, user, isIgnored);
    main.appendChild(top);
    main.appendChild(handleLink);
  } else {
    handleLink.classList.add('is-primary');
    const top = document.createElement('div');
    top.className = 'user-top';
    top.appendChild(handleLink);
    appendBadges(top, user, isIgnored);
    main.appendChild(top);
  }

  row.appendChild(main);

  if (ignorable) {
    const ignoreBtn = document.createElement('button');
    ignoreBtn.className = 'ignore-btn';
    ignoreBtn.type = 'button';
    ignoreBtn.textContent = isIgnored ? t('actionUnignore') : t('actionIgnore');
    ignoreBtn.addEventListener('click', () => toggleIgnore(user.username));
    row.appendChild(ignoreBtn);
  }

  return row;
}

function appendBadges(container, user, isIgnored) {
  if (user.isVerified) {
    const badge = document.createElement('span');
    badge.className = 'badge-verified';
    badge.title = t('badgeVerified');
    badge.innerHTML = VERIFIED_BADGE;
    container.appendChild(badge);
  }
  if (user.isPrivate) {
    const badge = document.createElement('span');
    badge.className = 'badge-private';
    badge.title = t('badgePrivate');
    badge.textContent = '🔒';
    container.appendChild(badge);
  }
  if (isIgnored) {
    const badge = document.createElement('span');
    badge.className = 'badge-ignored';
    badge.textContent = t('badgeIgnored');
    container.appendChild(badge);
  }
}

function renderEmpty(messageKey) {
  const empty = document.createElement('div');
  empty.className = 'empty';
  empty.textContent = t(messageKey);
  return empty;
}

function renderList() {
  const fragment = document.createDocumentFragment();
  const visible = getVisibleList();
  const ignorable = state.view === 'nonFollowers';

  if (getActiveList().length === 0) {
    fragment.appendChild(renderEmpty(state.view === 'fans' ? 'emptyFans' : 'emptyNonFollowers'));
  } else if (visible.length === 0) {
    fragment.appendChild(renderEmpty('emptyFiltered'));
  } else {
    for (const user of visible) {
      fragment.appendChild(buildUserRow(user, { ignorable }));
    }
  }

  els.list.replaceChildren(fragment);
}

function renderSummary() {
  const { counts } = state.result;
  els.statFollowing.textContent = formatNumber(counts.following);
  els.statFollowers.textContent = formatNumber(counts.followers);
  els.statMutual.textContent = formatNumber(counts.mutual);
  els.statNonFollowers.textContent = formatNumber(counts.nonFollowers);
  els.summary.hidden = false;
}

function renderTabsCounts() {
  els.countNonFollowers.textContent = formatNumber(state.result.counts.nonFollowers);
  els.countFans.textContent = formatNumber(state.result.counts.fans);
}

function renderToolbar() {
  els.ignoredToggleWrap.hidden = state.view !== 'nonFollowers';
}

function renderLastRun() {
  if (!state.result?.analyzedAt) {
    els.lastRun.hidden = true;
    return;
  }
  els.lastRun.textContent = t('lastRun', [formatRelativeTime(state.result.analyzedAt)]);
  els.lastRun.hidden = false;
}

function renderAll() {
  if (!state.result) return;
  renderSummary();
  renderTabsCounts();
  renderToolbar();
  renderList();
  renderLastRun();
  els.results.hidden = false;
}

// --- Actions ----------------------------------------------------------------

async function toggleIgnore(username) {
  if (state.ignore.has(username)) {
    state.ignore.delete(username);
  } else {
    state.ignore.add(username);
  }
  await setIgnoreList(state.ignore);
  renderSummary();
  renderList();
}

function setView(view) {
  if (state.view === view) return;
  state.view = view;
  els.tabs.forEach((tab) => {
    const active = tab.dataset.view === view;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  renderToolbar();
  renderList();
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function viewSlug() {
  return state.view === 'fans' ? 'voce-nao-segue' : 'nao-seguem-de-volta';
}

function toCsv(users) {
  const rows = [
    ['username', 'full_name', 'profile_url', 'is_verified', 'is_private'],
    ...users.map((user) => [
      user.username,
      user.fullName || '',
      profileUrl(user.username),
      user.isVerified ? 'true' : 'false',
      user.isPrivate ? 'true' : 'false'
    ])
  ];
  return rows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
    .join('\r\n');
}

async function copyList() {
  const users = getVisibleList();
  if (!users.length) return;
  await navigator.clipboard.writeText(users.map((user) => `@${user.username}`).join('\n'));
  showToast(t('toastCopied'));
}

function exportCsv() {
  const users = getVisibleList();
  if (!users.length) return;
  // Prepend a UTF-8 BOM so spreadsheet apps detect the encoding correctly.
  downloadFile(`instagram-${viewSlug()}.csv`, '﻿' + toCsv(users), 'text/csv;charset=utf-8;');
  showToast(t('toastCsv'));
}

function exportJson() {
  const users = getVisibleList();
  if (!users.length) return;
  const payload = {
    profile: state.result.profile.username,
    analyzedAt: new Date(state.result.analyzedAt).toISOString(),
    view: state.view,
    count: users.length,
    users
  };
  downloadFile(
    `instagram-${viewSlug()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json'
  );
  showToast(t('toastJson'));
}

// --- Analysis orchestration -------------------------------------------------

async function getActiveInstagramTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    throw Object.assign(new Error('no tab'), { code: 'NO_TAB' });
  }
  let host = '';
  try {
    host = new URL(tab.url).hostname;
  } catch {
    host = '';
  }
  if (!/instagram\.com$/i.test(host)) {
    throw Object.assign(new Error('not instagram'), { code: 'NOT_INSTAGRAM' });
  }
  return tab;
}

async function startAnalysis() {
  if (state.busy) return;
  hideAlert();
  setBusy(true);
  showProgress();
  setProgress(null, t('progressProfile'));

  try {
    const tab = await getActiveInstagramTab();
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/content.js'] });
    await delay(80);
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'IGNF_START' });
    if (!response?.ok) {
      throw Object.assign(new Error('start failed'), { code: response?.code || 'GENERIC' });
    }
    // From here the content script drives progress/result via runtime messages.
  } catch (error) {
    setBusy(false);
    hideProgress();
    showAlert(localizedError(error.code, error.message));
  }
}

// --- Progress / busy / alert / toast ---------------------------------------

function setBusy(busy) {
  state.busy = busy;
  els.analyzeBtn.disabled = busy;
  els.analyzeBtn.textContent = busy ? t('btnAnalyzing') : t('btnAnalyze');
}

function showProgress() {
  els.progress.hidden = false;
}

function hideProgress() {
  els.progress.hidden = true;
}

function setProgress(percent, label) {
  els.progressLabel.textContent = label || '';
  if (percent == null) {
    els.progressFill.classList.add('indeterminate');
  } else {
    els.progressFill.classList.remove('indeterminate');
    els.progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }
}

function progressPercent(p) {
  if (p.note === 'rate_limited' || p.note === 'retry') return null;
  switch (p.phase) {
    case 'profile':
      return 4;
    case 'following':
      return p.expected ? 4 + 46 * Math.min(p.loaded / p.expected, 1) : null;
    case 'followers':
      return p.expected ? 50 + 46 * Math.min(p.loaded / p.expected, 1) : null;
    case 'computing':
      return 99;
    default:
      return null;
  }
}

function progressLabel(p) {
  if (p.note === 'rate_limited') {
    return t('progressRateLimited', [String(Math.ceil((p.waitMs || 0) / 1000))]);
  }
  if (p.note === 'retry') return t('progressRetry');

  const suffix =
    p.loaded != null
      ? ` (${formatNumber(p.loaded)}${p.expected ? `/${formatNumber(p.expected)}` : ''})`
      : '';

  switch (p.phase) {
    case 'following':
      return t('progressFollowing') + suffix;
    case 'followers':
      return t('progressFollowers') + suffix;
    case 'computing':
      return t('progressComputing');
    case 'profile':
    default:
      return t('progressProfile');
  }
}

function onProgress(p) {
  showProgress();
  setProgress(progressPercent(p), progressLabel(p));
}

function onResult(result) {
  setBusy(false);
  setProgress(100, '');
  state.result = result;
  state.view = 'nonFollowers';
  els.tabs.forEach((tab) => {
    const active = tab.dataset.view === 'nonFollowers';
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  els.search.value = '';
  state.search = '';
  renderAll();
  delay(450).then(hideProgress);
}

function onError(message) {
  setBusy(false);
  hideProgress();
  showAlert(localizedError(message.code, message.message));
}

function showAlert(text) {
  els.alert.textContent = text;
  els.alert.hidden = false;
}

function hideAlert() {
  els.alert.hidden = true;
}

function showToast(text) {
  els.toast.textContent = text;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 1800);
}

// --- Wiring -----------------------------------------------------------------

function bindEvents() {
  els.analyzeBtn.addEventListener('click', startAnalysis);
  els.tabs.forEach((tab) => tab.addEventListener('click', () => setView(tab.dataset.view)));

  els.search.addEventListener('input', () => {
    state.search = els.search.value;
    renderList();
  });

  els.showIgnored.addEventListener('change', () => {
    state.showIgnored = els.showIgnored.checked;
    renderList();
  });

  els.copyBtn.addEventListener('click', copyList);
  els.csvBtn.addEventListener('click', exportCsv);
  els.jsonBtn.addEventListener('click', exportJson);

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'IGNF_PROGRESS') onProgress(message);
    else if (message.type === 'IGNF_RESULT') onResult(message.result);
    else if (message.type === 'IGNF_ERROR') onError(message);
  });
}

async function hydrate() {
  const [result, ignore] = await Promise.all([getLastResult(), getIgnoreList()]);
  state.ignore = new Set(ignore);
  if (result) {
    state.result = result;
    renderAll();
  } else {
    els.lastRun.textContent = t('lastRunNever');
    els.lastRun.hidden = false;
  }
}

function init() {
  applyI18n();
  setBusy(false);
  bindEvents();
  hydrate();
}

init();
