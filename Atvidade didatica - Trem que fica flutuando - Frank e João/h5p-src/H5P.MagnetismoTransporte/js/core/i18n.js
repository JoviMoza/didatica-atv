(function (H5P) {
  'use strict';

  /* Interface language: Brazilian Portuguese (default), US English or
   * Spanish (Spain).
   *
   * Strings stay next to the markup that uses them: L('Próxima', 'Next',
   * 'Siguiente') returns the text of the current language. The sealed bank
   * carries all three languages: plain fields have an "En" and an "Es" twin
   * (question / questionEn / questionEs) and sealed payloads join both texts
   * with PAYLOAD_SEPARATOR (see scripts/gerar-banco.ps1). The controller
   * calls set() from the saved state and re-renders the whole shell when the
   * student switches.
   *
   * Every language falls back to Portuguese, never to the previous language:
   * a missing translation shows the original, which is always complete. */

  const LANGUAGES = [
    { code: 'pt-BR', short: 'PT-BR', name: 'Português (Brasil)', flag: 'br' },
    { code: 'en-US', short: 'EN-US', name: 'English (US)', flag: 'us' },
    { code: 'es-ES', short: 'ES-ES', name: 'Español (España)', flag: 'es' }
  ];
  const DEFAULT_LANGUAGE = 'pt-BR';
  // Must match $PayloadSeparator in scripts/gerar-banco.ps1.
  const PAYLOAD_SEPARATOR = '\u001e';

  let current = DEFAULT_LANGUAGE;

  function isSupported(code) {
    return LANGUAGES.some((language) => language.code === code);
  }

  function set(code) {
    current = isSupported(code) ? code : DEFAULT_LANGUAGE;
    return current;
  }

  function get() {
    return current;
  }

  function isEnglish() {
    return current === 'en-US';
  }

  function isSpanish() {
    return current === 'es-ES';
  }

  // Index of the running language inside a [pt, en, es] triple. Portuguese
  // is 0, English 1, Spanish 2.
  function index() {
    return current === 'en-US' ? 1 : current === 'es-ES' ? 2 : 0;
  }

  // Picks the text of the running language, falling back to Portuguese.
  function pick(values) {
    const chosen = values[index()];
    return chosen === undefined || chosen === null || chosen === '' ? values[0] : chosen;
  }

  // Inline translation. Portuguese and English are positional for backwards
  // compatibility with every existing call site; Spanish is third.
  function L(pt, en, es) {
    return pick([pt, en, es]);
  }

  // Marker that scripts/gerar-banco.ps1 puts at the start of every sealed
  // payload and that answer-key.js uses to verify the key (open() only
  // decodes when the marker comes out right). Stripped here so no sealed text
  // ever shows it.
  const SEAL_MARK = 'ok|';

  // Sealed payload "pt<sep>en<sep>es" -> part of the current language.
  function payload(text) {
    const parts = String(text === undefined || text === null ? '' : text).split(PAYLOAD_SEPARATOR);
    return stripMark(pick(parts));
  }

  function stripMark(value) {
    const text = String(value === undefined || value === null ? '' : value);
    return text.startsWith(SEAL_MARK) ? text.slice(SEAL_MARK.length).replace(/\u0000+$/, '') : text;
  }

  // Bank item field in the current language: item.question / questionEn /
  // questionEs. Missing translations fall back down to Portuguese.
  function field(item, name) {
    if (!item) {
      return '';
    }
    return pick([item[name], item[`${name}En`], item[`${name}Es`]]);
  }

  H5P.MagnetismoTransporte = H5P.MagnetismoTransporte || {};
  H5P.MagnetismoTransporte.I18n = {
    LANGUAGES,
    DEFAULT_LANGUAGE,
    PAYLOAD_SEPARATOR,
    SEAL_MARK,
    stripMark,
    isSupported,
    set,
    get,
    isEnglish,
    isSpanish,
    L,
    payload,
    field
  };
})(window.H5P = window.H5P || {});