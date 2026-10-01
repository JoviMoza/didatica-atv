(function (H5P) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Magnet lab: bar magnets laid out equidistantly on a circle around
   * the stage, from MAGNET_MIN to MAGNET_MAX of them (the student adds
   * one at a time). Angles are in degrees, clockwise, 0° = north pole
   * pointing up. Each magnet is modelled as a pair of magnetic
   * "charges" (N = +1, S = −1) with 1/r² falloff, which is enough to
   * draw textbook field lines and to evaluate the superposition at the
   * centre of the stage. Pure functions only: the page module
   * (pages/03-magnet-lab.js) draws.
   * ------------------------------------------------------------------ */

  const Storage = H5P.MagnetismoTransporte.Storage;
  const normalizeAngle = Storage.normalizeAngle;
  const MAGNET_MIN = Storage.MAGNET_MIN;
  const MAGNET_MAX = Storage.MAGNET_MAX;
  const I18n = H5P.MagnetismoTransporte.I18n;
  const L = I18n.L;

  const LAB = {
    width: 800,
    height: 520,
    center: { x: 400, y: 260 },
    // The magnets sit on this ellipse: equidistant by angle, which keeps
    // them clear of each other and of the centre probe at any count.
    radiusX: 268,
    radiusY: 172,
    poleOffset: 40,
    magnetLength: 116,
    magnetWidth: 44,
    step: 15,
    min: MAGNET_MIN,
    max: MAGNET_MAX
  };

  const DIRECTION_NAMES = {
    'pt-BR': ['para cima', 'para cima e à direita', 'para a direita', 'para baixo e à direita', 'para baixo', 'para baixo e à esquerda', 'para a esquerda', 'para cima e à esquerda'],
    'en-US': ['up', 'up and to the right', 'to the right', 'down and to the right', 'down', 'down and to the left', 'to the left', 'up and to the left'],
    'es-ES': ['hacia arriba', 'hacia arriba y a la derecha', 'hacia la derecha', 'hacia abajo y a la derecha', 'hacia abajo', 'hacia abajo y a la izquierda', 'hacia la izquierda', 'hacia arriba y a la izquierda']
  };

  function angleToDirection(angle) {
    const names = DIRECTION_NAMES[I18n.get()] || DIRECTION_NAMES['pt-BR'];
    return names[Math.round(normalizeAngle(angle) / 45) % 8];
  }

  /* Positions of `count` magnets, always equidistant.
   *
   * Two layouts, because 4 is the default and 4 is also the count that wants
   * to look like the old picture:
   *   - 4 magnets: one in each corner of the stage, which is the arrangement
   *     the activity shipped with until the lab became variable-size. The
   *     corners of a rectangle centred on the stage are equidistant from its
   *     centre, so the "equidistant" promise still holds.
   *   - any other count: equidistant by angle on the ellipse, so nothing
   *     collides with the centre probe at 2..10.
   *
   * Index 0 is always the top-left / top position and then clockwise, so the
   * picture never depends on the order the magnets were added.
   *
   * CORNER_INSET is the half-diagonal of a magnet plus a margin: a magnet is
   * 116x44, so a corner inset of half its length (58) would let it stick out
   * once rotated; the diagonal covers every rotation. */
  const CORNER_INSET = Math.round(
    Math.sqrt(Math.pow(LAB.magnetLength / 2, 2) + Math.pow(LAB.magnetWidth / 2, 2)
  ) + 8
  );
  const CORNER = 4;

  function positions(count) {
    const total = Math.max(MAGNET_MIN, Math.min(MAGNET_MAX, Math.round(Number(count) || MAGNET_MIN)));
    if (total === CORNER) {
      const left = CORNER_INSET;
      const right = LAB.width - CORNER_INSET;
      const top = CORNER_INSET;
      const bottom = LAB.height - CORNER_INSET;
      return [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom }
      ].map((point, index) => ({ x: point.x, y: point.y, index }));
    }
    return Array.from({ length: total }, (_, index) => {
      const degrees = (360 / total) * index - 90;
      const radians = degrees * Math.PI / 180;
      return {
        x: LAB.center.x + Math.cos(radians) * LAB.radiusX,
        y: LAB.center.y + Math.sin(radians) * LAB.radiusY,
        index
      };
    });
  }

  function magnetPoles(angles) {
    const placed = positions((angles || []).length);
    const poles = [];
    angles.forEach((degrees, index) => {
      const position = placed[index];
      if (!position) {
        return;
      }
      const radians = degrees * Math.PI / 180;
      const dx = Math.sin(radians);
      const dy = -Math.cos(radians);
      poles.push({ x: position.x + dx * LAB.poleOffset, y: position.y + dy * LAB.poleOffset, q: 1 });
      poles.push({ x: position.x - dx * LAB.poleOffset, y: position.y - dy * LAB.poleOffset, q: -1 });
    });
    return poles;
  }

  function fieldAt(poles, x, y) {
    let bx = 0;
    let by = 0;
    for (let i = 0; i < poles.length; i += 1) {
      const dx = x - poles[i].x;
      const dy = y - poles[i].y;
      const d2 = dx * dx + dy * dy + 36;
      const factor = poles[i].q / (d2 * Math.sqrt(d2));
      bx += dx * factor;
      by += dy * factor;
    }
    return { x: bx, y: by };
  }

  // Integrates field lines (RK2) from a fan of seeds around each north pole
  // until they reach a south pole, leave the stage or hit a null point.
  function traceFieldLines(angles) {
    const poles = magnetPoles(angles);
    const southPoles = poles.filter((pole) => pole.q < 0);
    const lines = [];
    const seeds = 9;
    const step = 5;
    const margin = 24;
    angles.forEach((degrees, index) => {
      const north = poles[index * 2];
      if (!north) {
        return;
      }
      const heading = (degrees - 90) * Math.PI / 180;
      for (let k = 0; k < seeds; k += 1) {
        const spread = -1.45 + (2.9 * k) / (seeds - 1);
        let x = north.x + Math.cos(heading + spread) * 10;
        let y = north.y + Math.sin(heading + spread) * 10;
        const points = [[x, y]];
        for (let s = 0; s < 480; s += 1) {
          const b1 = fieldAt(poles, x, y);
          const m1 = Math.hypot(b1.x, b1.y);
          if (m1 < 1e-11) {
            break;
          }
          const mx = x + (b1.x / m1) * step * 0.5;
          const my = y + (b1.y / m1) * step * 0.5;
          const b2 = fieldAt(poles, mx, my);
          const m2 = Math.hypot(b2.x, b2.y);
          if (m2 < 1e-11) {
            break;
          }
          x += (b2.x / m2) * step;
          y += (b2.y / m2) * step;
          points.push([x, y]);
          if (x < -margin || y < -margin || x > LAB.width + margin || y > LAB.height + margin) {
            break;
          }
          if (southPoles.some((pole) => (x - pole.x) * (x - pole.x) + (y - pole.y) * (y - pole.y) < 81)) {
            break;
          }
        }
        lines.push(points);
      }
    });
    return lines;
  }

  function centerField(angles) {
    return fieldAt(magnetPoles(angles), LAB.center.x, LAB.center.y);
  }

  // Reference field for the qualitative meter. With every N pole pointing
  // the same way, the centre field grows with the number of magnets, so
  // each count is measured against its own reference: the meter then means
  // "strong for this many magnets" at any count.
  const REFERENCE_FIELDS = {};
  function referenceField(count) {
    const total = Math.max(MAGNET_MIN, Math.min(MAGNET_MAX, Math.round(Number(count) || MAGNET_MIN)));
    if (REFERENCE_FIELDS[total] === undefined) {
      const field = centerField(new Array(total).fill(0));
      REFERENCE_FIELDS[total] = Math.hypot(field.x, field.y) || 1;
    }
    return REFERENCE_FIELDS[total];
  }

  function angularDistance(a, b) {
    const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
    return Math.min(diff, 360 - diff);
  }

  function isAligned(angles) {
    return angles.length > 1 && angles.every((angle) => angularDistance(angle, angles[0]) <= 8);
  }

  function alignmentPercent(angles) {
    if (!angles.length) {
      return 0;
    }
    let x = 0;
    let y = 0;
    angles.forEach((angle) => {
      x += Math.sin(angle * Math.PI / 180);
      y += Math.cos(angle * Math.PI / 180);
    });
    return Math.round((Math.hypot(x, y) / angles.length) * 100);
  }

  function centerFieldPercent(angles) {
    const field = centerField(angles);
    return Math.round((Math.hypot(field.x, field.y) / referenceField(angles.length)) * 100);
  }

  // Below this share of the reference field, the centre counts as "Nulo".
  const NULL_PERCENT = 8;

  H5P.MagnetismoTransporte.Physics = {
    LAB,
    NULL_PERCENT,
    positions,
    angleToDirection,
    magnetPoles,
    fieldAt,
    traceFieldLines,
    centerField,
    isAligned,
    alignmentPercent,
    centerFieldPercent
  };
})(window.H5P = window.H5P || {});