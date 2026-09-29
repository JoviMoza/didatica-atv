(function (H5P) {
  'use strict';

  /* Interface language: Brazilian Portuguese (default) or US English.
   *
   * Strings stay next to the markup that uses them: L('Próxima', 'Next')
   * returns the text of the current language. The sealed bank carries both
   * languages: plain fields have an "En" twin (question / questionEn) and
   * sealed payloads join both texts with PAYLOAD_SEPARATOR (see
   * scripts/gerar-banco.ps1). The controller calls set() from the saved
   * state and re-renders the whole shell when the student switches. */

  const LANGUAGES = [
    { code: 'pt-BR', short: 'PT-BR', name: 'Português (Brasil)' },
    { code: 'en-US', short: 'EN-US', name: 'English (US)' }
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

  // Inline translation. Falls back to Portuguese when no English is given.
  function L(pt, en) {
    return isEnglish() && en !== undefined && en !== null ? en : pt;
  }

  // Sealed payload "pt<sep>en" -> part of the current language.
  function payload(text) {
    const parts = String(text === undefined || text === null ? '' : text).split(PAYLOAD_SEPARATOR);
    return isEnglish() && parts[1] ? parts[1] : parts[0];
  }

  // Bank item field in the current language: item.question / item.questionEn.
  function field(item, name) {
    if (!item) {
      return '';
    }
    const english = item[`${name}En`];
    return isEnglish() && english ? english : item[name];
  }

  H5P.MagnetismoTransporte = H5P.MagnetismoTransporte || {};
  H5P.MagnetismoTransporte.I18n = {
    LANGUAGES,
    DEFAULT_LANGUAGE,
    PAYLOAD_SEPARATOR,
    isSupported,
    set,
    get,
    isEnglish,
    L,
    payload,
    field
  };
})(window.H5P = window.H5P || {});
