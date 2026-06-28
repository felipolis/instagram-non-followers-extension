// Thin, typed-ish access layer over chrome.storage.local.
// NOTE: LAST_RESULT_KEY must stay in sync with the key used in content.js,
// which cannot import this module (it is injected as a classic script).

const LAST_RESULT_KEY = 'lastResult';
const IGNORE_LIST_KEY = 'ignoreList';

/**
 * @returns {Promise<object|null>} the most recent analysis result, if any.
 */
export async function getLastResult() {
  const data = await chrome.storage.local.get(LAST_RESULT_KEY);
  return data[LAST_RESULT_KEY] || null;
}

/**
 * @param {object} result
 */
export async function setLastResult(result) {
  await chrome.storage.local.set({ [LAST_RESULT_KEY]: result });
}

/**
 * @returns {Promise<string[]>} usernames the user chose to ignore.
 */
export async function getIgnoreList() {
  const data = await chrome.storage.local.get(IGNORE_LIST_KEY);
  return Array.isArray(data[IGNORE_LIST_KEY]) ? data[IGNORE_LIST_KEY] : [];
}

/**
 * @param {Iterable<string>} usernames
 */
export async function setIgnoreList(usernames) {
  await chrome.storage.local.set({ [IGNORE_LIST_KEY]: Array.from(new Set(usernames)) });
}
