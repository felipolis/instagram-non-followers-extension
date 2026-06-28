// Lightweight wrapper around chrome.i18n with graceful fallbacks.

/**
 * Returns a localized message, falling back to the key itself when the message
 * is missing so the UI never renders an empty string.
 * @param {string} key
 * @param {string|string[]} [substitutions]
 * @returns {string}
 */
export function t(key, substitutions) {
  const message = chrome.i18n.getMessage(key, substitutions);
  return message || key;
}

/**
 * Replaces text/placeholder/title content for every element that declares a
 * `data-i18n*` attribute. The HTML keeps a readable default text, which is only
 * overwritten when a translation is actually available.
 * @param {ParentNode} [root]
 */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const message = chrome.i18n.getMessage(el.dataset.i18n);
    if (message) el.textContent = message;
  });

  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const message = chrome.i18n.getMessage(el.dataset.i18nPlaceholder);
    if (message) el.setAttribute('placeholder', message);
  });

  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const message = chrome.i18n.getMessage(el.dataset.i18nTitle);
    if (message) el.setAttribute('title', message);
  });
}

/**
 * Best-effort BCP-47 UI language for Intl formatters.
 * @returns {string}
 */
export function uiLang() {
  return chrome.i18n.getUILanguage?.() || 'pt-BR';
}
