// Locale-aware formatting helpers.

import { uiLang } from './i18n.js';

/**
 * Formats an integer using the UI locale (e.g. 1234 -> "1.234" in pt-BR).
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
  try {
    return new Intl.NumberFormat(uiLang()).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Formats a past timestamp as a relative time string (e.g. "há 5 minutos").
 * @param {number} epochMs
 * @returns {string}
 */
export function formatRelativeTime(epochMs) {
  const diffSeconds = Math.round((epochMs - Date.now()) / 1000);
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1]
  ];

  try {
    const rtf = new Intl.RelativeTimeFormat(uiLang(), { numeric: 'auto' });
    for (const [unit, secondsInUnit] of units) {
      if (Math.abs(diffSeconds) >= secondsInUnit || unit === 'second') {
        return rtf.format(Math.round(diffSeconds / secondsInUnit), unit);
      }
    }
  } catch {
    /* falls through */
  }

  return new Date(epochMs).toLocaleString(uiLang());
}
