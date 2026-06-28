// Injected on demand into an open Instagram tab. Runs entirely in the page so it
// can reuse the logged-in session (cookies) and call Instagram's own web API.
// Nothing is sent anywhere except chrome.storage.local and the extension popup.

(() => {
  if (window.__IGNF_EXTENSION_LOADED__) {
    return;
  }
  window.__IGNF_EXTENSION_LOADED__ = true;

  const state = { running: false };

  const DEFAULT_IG_APP_ID = '936619743392459';
  const DEFAULT_ASBD_ID = '129477';
  const PAGE_SIZE = 100;
  const MAX_PAGES = 5000; // safety valve against an infinite pagination loop
  const STORAGE_KEY_LAST_RESULT = 'lastResult'; // keep in sync with lib/storage.js

  const RESERVED_PATHS = new Set([
    'accounts',
    'about',
    'api',
    'developer',
    'direct',
    'explore',
    'p',
    'reel',
    'reels',
    'stories',
    'tv',
    'challenge',
    'directory',
    'privacy',
    'legal',
    'press',
    'web',
    'emails',
    'graphql'
  ]);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // Error carrying a stable `code` so the popup can localize the message.
  function fail(code, message) {
    const error = new Error(message || code);
    error.code = code;
    return error;
  }

  function send(type, payload) {
    chrome.runtime.sendMessage({ type, ...payload }).catch(() => {});
  }
  const sendProgress = (payload) => send('IGNF_PROGRESS', payload);

  // --- Page / session helpers -------------------------------------------------

  function isProfilePage() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts.length === 1 && !RESERVED_PATHS.has((parts[0] || '').toLowerCase());
  }

  function getProfileUsername() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const candidate = parts[0] || null;
    if (!candidate || RESERVED_PATHS.has(candidate.toLowerCase())) return null;
    return candidate;
  }

  function getCookie(name) {
    const prefix = `${name}=`;
    const cookies = document.cookie ? document.cookie.split(';') : [];
    for (const rawCookie of cookies) {
      const cookie = rawCookie.trim();
      if (cookie.startsWith(prefix)) {
        return decodeURIComponent(cookie.slice(prefix.length));
      }
    }
    return null;
  }

  function getMetaContent(name) {
    return document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || null;
  }

  function extractValueFromInlineScripts(pattern) {
    for (const script of document.querySelectorAll('script')) {
      const match = (script.textContent || '').match(pattern);
      if (match?.[1]) return match[1];
    }
    return null;
  }

  function getInstagramAppId() {
    return (
      getMetaContent('instagram-app-id') ||
      extractValueFromInlineScripts(/["']instagramWebFBAppId["']\s*:\s*["'](\d+)["']/i) ||
      extractValueFromInlineScripts(/["']X-IG-App-ID["']\s*[:,]\s*["'](\d+)["']/i) ||
      DEFAULT_IG_APP_ID
    );
  }

  function getAsbdId() {
    return (
      getMetaContent('x-asbd-id') ||
      extractValueFromInlineScripts(/["']ASBD_ID["']\s*[:,]\s*["'](\d+)["']/i) ||
      DEFAULT_ASBD_ID
    );
  }

  function buildApiHeaders() {
    const csrfToken = getCookie('csrftoken');
    const headers = {
      Accept: '*/*',
      'X-IG-App-ID': getInstagramAppId(),
      'X-ASBD-ID': getAsbdId(),
      'X-Requested-With': 'XMLHttpRequest'
    };
    if (csrfToken) headers['X-CSRFToken'] = csrfToken;
    return headers;
  }

  // --- Networking with retry / backoff ---------------------------------------

  function backoff(attempt, rateLimited = false) {
    const base = rateLimited ? 4000 : 600;
    const cap = rateLimited ? 30000 : 4000;
    return Math.min(base * 2 ** (attempt - 1), cap) + randomBetween(0, 400);
  }

  async function fetchJson(url, { label, phase } = {}) {
    const MAX_ATTEMPTS = 4;

    for (let attempt = 1; ; attempt += 1) {
      let response;
      try {
        response = await fetch(url, {
          credentials: 'include',
          headers: buildApiHeaders(),
          method: 'GET'
        });
      } catch {
        if (attempt < MAX_ATTEMPTS) {
          const waitMs = backoff(attempt);
          sendProgress({ phase, note: 'retry', waitMs });
          await sleep(waitMs);
          continue;
        }
        throw fail('NETWORK', `Falha de rede ao carregar ${label}.`);
      }

      // Instagram throttles aggressive reads — back off and retry a few times.
      if (response.status === 429 || response.status === 503) {
        if (attempt < MAX_ATTEMPTS) {
          const waitMs = backoff(attempt, true);
          sendProgress({ phase, note: 'rate_limited', waitMs });
          await sleep(waitMs);
          continue;
        }
        throw fail('RATE_LIMITED', `O Instagram limitou as requisições (HTTP ${response.status}).`);
      }

      const rawText = await response.text();
      let data = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        const detail =
          data?.message || data?.status || rawText.slice(0, 180) || `HTTP ${response.status}`;
        throw fail('HTTP', `Falha ao carregar ${label} (HTTP ${response.status}). ${detail}`);
      }

      if (!data || typeof data !== 'object') {
        throw fail(
          'BLOCKED',
          `A resposta de ${label} não veio em JSON. O Instagram pode ter bloqueado a requisição ou mudado o endpoint.`
        );
      }

      if (data.status && data.status !== 'ok' && !data?.data?.user) {
        const detail = data.message || data.feedback_message || data.status;
        throw fail('BLOCKED', `O Instagram recusou a requisição de ${label}. ${detail}`);
      }

      return data;
    }
  }

  // --- Data shaping -----------------------------------------------------------

  function mapUser(raw) {
    const pk = raw?.pk ?? raw?.id;
    return {
      id: pk != null ? String(pk) : '',
      username: typeof raw?.username === 'string' ? raw.username : '',
      fullName: typeof raw?.full_name === 'string' ? raw.full_name : '',
      isVerified: Boolean(raw?.is_verified),
      isPrivate: Boolean(raw?.is_private),
      profilePicUrl: typeof raw?.profile_pic_url === 'string' ? raw.profile_pic_url : ''
    };
  }

  function sortByUsername(users) {
    return users
      .slice()
      .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }));
  }

  async function fetchCurrentPageProfile() {
    const username = getProfileUsername();
    if (!username) {
      throw fail(
        'OPEN_PROFILE',
        'Abra a página principal do seu perfil do Instagram e tente novamente.'
      );
    }

    sendProgress({ phase: 'profile' });
    const data = await fetchJson(
      `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      { label: `perfil @${username}`, phase: 'profile' }
    );
    const user = data?.data?.user;
    if (!user?.id || !user?.username) {
      throw fail('PROFILE_FETCH', 'Não consegui identificar o perfil aberto.');
    }

    return {
      id: String(user.id),
      username: String(user.username),
      fullName: typeof user.full_name === 'string' ? user.full_name : '',
      followersCount: Number(user?.edge_followed_by?.count || 0),
      followingCount: Number(user?.edge_follow?.count || 0)
    };
  }

  async function fetchFriendshipList(listType, userId, expected, phase) {
    const byId = new Map();
    let nextMaxId = '';

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const params = new URLSearchParams({ count: String(PAGE_SIZE) });
      if (nextMaxId) params.set('max_id', nextMaxId);

      const url = `/api/v1/friendships/${encodeURIComponent(userId)}/${listType}/?${params.toString()}`;
      const data = await fetchJson(url, { label: `${listType} (página ${page})`, phase });

      for (const raw of Array.isArray(data?.users) ? data.users : []) {
        const user = mapUser(raw);
        if (user.id && user.username) byId.set(user.id, user);
      }

      sendProgress({ phase, page, loaded: byId.size, expected });

      const newNextMaxId = data?.next_max_id || '';
      if (!newNextMaxId || newNextMaxId === nextMaxId) {
        return { users: Array.from(byId.values()), pages: page };
      }

      nextMaxId = String(newNextMaxId);
      await sleep(randomBetween(400, 800));
    }

    throw fail(
      'SAFETY_LIMIT',
      `O Instagram continuou retornando páginas de ${listType} além do limite de segurança.`
    );
  }

  // --- Orchestration ----------------------------------------------------------

  async function analyze() {
    if (state.running) {
      throw fail('ALREADY_RUNNING', 'Já existe uma análise em andamento.');
    }
    state.running = true;

    try {
      if (!/instagram\.com$/i.test(window.location.hostname)) {
        throw fail('OPEN_INSTAGRAM', 'Abra o Instagram antes de iniciar.');
      }
      if (!isProfilePage()) {
        throw fail(
          'OPEN_PROFILE',
          'Abra o seu perfil do Instagram, na página principal do perfil, e tente novamente.'
        );
      }

      const currentUserId = getCookie('ds_user_id');
      if (!currentUserId) {
        throw fail(
          'NO_SESSION',
          'Não consegui ler sua sessão do Instagram. Verifique se você está logado no site.'
        );
      }

      const profile = await fetchCurrentPageProfile();
      if (profile.id !== String(currentUserId)) {
        throw fail('OWN_PROFILE', 'Abra o seu próprio perfil do Instagram antes de analisar.');
      }

      const following = await fetchFriendshipList(
        'following',
        profile.id,
        profile.followingCount,
        'following'
      );
      const followers = await fetchFriendshipList(
        'followers',
        profile.id,
        profile.followersCount,
        'followers'
      );

      sendProgress({ phase: 'computing' });

      const followerIds = new Set(followers.users.map((user) => user.id));
      const followingIds = new Set(following.users.map((user) => user.id));
      const nonFollowers = sortByUsername(
        following.users.filter((user) => !followerIds.has(user.id))
      );
      const fans = sortByUsername(followers.users.filter((user) => !followingIds.has(user.id)));
      const mutualCount = following.users.length - nonFollowers.length;

      const result = {
        version: 3,
        analyzedAt: Date.now(),
        source: 'instagram-api-web',
        profile: {
          id: profile.id,
          username: profile.username,
          fullName: profile.fullName,
          followersExpected: profile.followersCount,
          followingExpected: profile.followingCount
        },
        counts: {
          following: following.users.length,
          followers: followers.users.length,
          mutual: mutualCount,
          nonFollowers: nonFollowers.length,
          fans: fans.length
        },
        pages: { following: following.pages, followers: followers.pages },
        nonFollowers,
        fans
      };

      try {
        await chrome.storage.local.set({ [STORAGE_KEY_LAST_RESULT]: result });
      } catch {
        /* storage is best-effort; the popup still receives the live result */
      }

      return result;
    } finally {
      state.running = false;
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') return;

    if (message.type === 'IGNF_START') {
      analyze()
        .then((result) => send('IGNF_RESULT', { result }))
        .catch((error) =>
          send('IGNF_ERROR', {
            code: error?.code || 'GENERIC',
            message: error?.message || String(error)
          })
        );

      sendResponse({ ok: true, started: true });
      return true;
    }
  });
})();
