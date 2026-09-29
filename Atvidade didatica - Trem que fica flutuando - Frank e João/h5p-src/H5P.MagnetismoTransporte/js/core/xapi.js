(function (H5P) {
  'use strict';

  /* Outgoing xAPI "completed" statements, one per graded activity.
   * Since v2.2 the activity no longer accepts results from outside
   * (postMessage / externalDispatcher): any page script could forge them. */

  const LIBRARY = 'H5P.MagnetismoTransporte-2.2.1';
  const Activities = H5P.MagnetismoTransporte.Activities;

  function normalize(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function isoDuration(startedAt, endedAt) {
    const start = Number(startedAt) || Date.now();
    const end = Number(endedAt) || Date.now();
    const seconds = Math.max(0, Math.round((end - start) / 100) / 10);
    return `PT${seconds}S`;
  }

  function buildStatement(activityId, rawScore, maxScore, startedAt, options) {
    const meta = Activities.ACTIVITIES[activityId];
    const settings = options || {};
    const min = 0;
    const safeMax = Math.max(1, normalize(maxScore, meta.max));
    const raw = Math.max(min, Math.min(safeMax, normalize(rawScore, 0)));
    const contentId = settings.contentId ? String(settings.contentId) : 'preview';
    const objectId = `https://h5p.local/activities/${encodeURIComponent(contentId)}/${encodeURIComponent(activityId)}`;

    return {
      actor: {
        objectType: 'Agent',
        account: {
          name: 'h5p-magnetismo-transporte-learner',
          homePage: window.location.origin
        }
      },
      verb: {
        id: 'http://adlnet.gov/expapi/verbs/completed',
        display: { 'pt-BR': 'completou' }
      },
      result: {
        score: {
          raw,
          min,
          max: safeMax,
          scaled: raw / safeMax
        },
        completion: true,
        success: raw >= safeMax,
        duration: isoDuration(startedAt, Date.now()),
        extensions: {
          'https://w3id.org/xapi/h5p/maglev-activity': activityId
        }
      },
      object: {
        objectType: 'Activity',
        id: objectId,
        definition: {
          name: { 'pt-BR': meta.xapiTitle },
          description: { 'pt-BR': meta.description || meta.xapiTitle },
          type: 'http://adlnet.org/expapi/activities/interaction',
          interactionType: meta.interactionType,
          extensions: {
            'http://h5p.org/x-api/h5p-local-content-id': contentId,
            'https://w3id.org/xapi/h5p/maglev-activity': activityId,
            'https://w3id.org/xapi/h5p/maglev-page': String(meta.page)
          }
        }
      },
      context: {
        extensions: {
          'http://h5p.org/x-api/h5p-library': LIBRARY,
          'https://w3id.org/xapi/h5p/maglev-activity': activityId
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  // Builds the event that is triggered on the H5P instance: a real
  // H5P.XAPIEvent inside H5P (so externalDispatcher forwards it to the LMS),
  // or a minimal stand-in in the local preview.
  function createEvent(instance, statement) {
    const score = statement.result.score;
    if (!H5P.XAPIEvent) {
      return {
        type: 'xAPI',
        data: { statement },
        preventBubbling() {},
        getBubbles() { return true; },
        getVerb() { return 'completed'; },
        getScore() { return score.raw; },
        getMaxScore() { return score.max; },
        scheduleForExternal() { return false; }
      };
    }
    const event = new H5P.XAPIEvent();
    event.setActor();
    event.setVerb('completed');
    event.setScoredResult(score.raw, score.max, instance, true, score.raw >= score.max);
    event.setObject(instance);
    event.setContext(instance);
    const target = event.data.statement;
    target.object.definition.name = statement.object.definition.name;
    target.object.definition.interactionType = statement.object.definition.interactionType;
    target.object.definition.extensions = Object.assign(
      {},
      target.object.definition.extensions || {},
      statement.object.definition.extensions
    );
    target.result.duration = statement.result.duration;
    target.result.extensions = statement.result.extensions;
    target.context.extensions = statement.context.extensions;
    target.timestamp = statement.timestamp;
    return event;
  }

  H5P.MagnetismoTransporte.XAPI = {
    LIBRARY,
    buildStatement,
    createEvent
  };
})(window.H5P = window.H5P || {});
