(function (H5P) {
  'use strict';

  /* Sealed answer key.
   *
   * The package never contains the answers in plain text. For each question,
   * scripts/gerar-banco.ps1 encrypts the feedback text with a key derived
   * from the CORRECT answer (salt | question | answer). At runtime:
   *   open(seal, [...parts, choice]) returns the feedback when the choice is
   *   right and null when it is wrong. There is no stored "correct" field
   *   to read in the source, the DOM or localStorage.
   *
   * This is obfuscation, not server-grade security: a determined student
   * with DevTools can still try every option. See docs/seguranca.md. */

  const Util = H5P.MagnetismoTransporte.Util;
  const MARK = 'ok|';

  function create(salt) {
    const prefix = String(salt || '');

    function open(seal, parts) {
      if (typeof seal !== 'string' || !seal || seal.length % 4 !== 0 || !/^[0-9a-f]+$/.test(seal)) {
        return null;
      }
      const next = Util.keystream(Util.cyrb(`${prefix}|${parts.join('|')}`, 0)[0]);
      let text = '';
      for (let i = 0; i < seal.length; i += 4) {
        text += String.fromCharCode(parseInt(seal.slice(i, i + 4), 16) ^ (next() & 0xffff));
        // Stop early on a wrong key: the marker does not decode.
        if (text.length === MARK.length && text !== MARK) {
          return null;
        }
      }
      // The generator pads every seal with NUL chars to a fixed block size.
      return text.startsWith(MARK) ? text.slice(MARK.length).replace(/\u0000+$/, '') : null;
    }

    // Finds which candidate opens the seal. Used only after the student has
    // answered, to highlight the right option and show the explanation.
    function reveal(seal, parts, candidates) {
      for (let i = 0; i < candidates.length; i += 1) {
        const payload = open(seal, parts.concat([candidates[i]]));
        if (payload !== null) {
          return { answer: candidates[i], payload };
        }
      }
      return null;
    }

    return { open, reveal };
  }

  H5P.MagnetismoTransporte.AnswerKey = { create };
})(window.H5P = window.H5P || {});
