(function (H5P) {
  'use strict';

  /* Shared helpers with no DOM state: HTML escaping, formatting, seeded
   * randomness and the string hash used by the answer key and by the
   * storage signature. Loaded first; every other module depends on it. */

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Plain text from the H5P editor: blank lines split paragraphs.
  function plainMarkup(value) {
    return String(value || '')
      .split(/\n\s*\n/g)
      .filter(Boolean)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || min));
  }

  function getPercent(raw, max) {
    if (!Number.isFinite(Number(max)) || Number(max) <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round((Number(raw) / Number(max)) * 100)));
  }

  // Date in the interface language. I18n loads after this file, so it is
  // looked up at call time on `ns` (app.js later replaces the global
  // H5P.MagnetismoTransporte with the class, which has no I18n).
  function formatTimestamp(value) {
    const I18n = ns.I18n;
    const locale = I18n ? I18n.get() : 'pt-BR';
    const date = new Date(value || '');
    if (!value || Number.isNaN(date.getTime())) {
      return I18n ? I18n.L('Sem data', 'No date') : 'Sem data';
    }
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date);
    } catch (error) {
      return date.toLocaleString(locale);
    }
  }

  function createSeed() {
    try {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return (values[0] % 2147483646) + 1;
    } catch (error) {
      return Math.floor(Math.random() * 2147483646) + 1;
    }
  }

  // Small deterministic hash, only used to derive per-question shuffle seeds.
  function hashString(value) {
    let hash = 7;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) % 2147483647;
    }
    return hash;
  }

  function seededShuffle(array, seed) {
    const values = array.slice();
    let state = Number(seed) || 1;
    for (let index = values.length - 1; index > 0; index -= 1) {
      state = (state * 1664525 + 1013904223) % 4294967296;
      const target = state % (index + 1);
      const temporary = values[index];
      values[index] = values[target];
      values[target] = temporary;
    }
    return values;
  }

  // cyrb53 core, returning both 32-bit halves. scripts/gerar-banco.ps1 has
  // a C# port of this function and of keystream(): keep them identical.
  function cyrb(text, seed) {
    let h1 = 0xdeadbeef ^ (seed >>> 0);
    let h2 = 0x41c6ce57 ^ (seed >>> 0);
    for (let i = 0; i < text.length; i += 1) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return [h1 >>> 0, h2 >>> 0];
  }

  function hashHex(text, seed) {
    const [h1, h2] = cyrb(String(text), seed || 0);
    return h2.toString(16).padStart(8, '0') + h1.toString(16).padStart(8, '0');
  }

  // mulberry32: 32-bit pseudo-random stream.
  function keystream(seed) {
    let a = seed >>> 0;
    return function next() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (t ^ (t >>> 14)) >>> 0;
    };
  }

  const ns = H5P.MagnetismoTransporte = H5P.MagnetismoTransporte || {};
  ns.Util = {
    escapeHtml,
    plainMarkup,
    clamp,
    getPercent,
    formatTimestamp,
    createSeed,
    hashString,
    seededShuffle,
    cyrb,
    hashHex,
    keystream
  };
})(window.H5P = window.H5P || {});
