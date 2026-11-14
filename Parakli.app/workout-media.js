/* Стороны и варианты одного упражнения не создают дополнительные этапы. */
(function (root) {
  'use strict';
  function select(exercise, variantIndex, elapsedSeconds, exerciseSeconds) {
    var variants = exercise.variants || [];
    var variant = variants[variantIndex] || exercise;
    var half = (exerciseSeconds || 50) / 2;
    var elapsed = Math.max(0, Number(elapsedSeconds) || 0);
    var side = exercise.bilateral && elapsed >= half ? 1 : 0;
    var sides = variant.sideVideos || (variant === exercise ? exercise.sideVideos : null) || [];
    var media = sides[side] || sides[0] || variant;
    return {
      video: media.video || '',
      image: media.image || variant.image || exercise.image || '',
      text: variant.text || exercise.text || '',
      side: side,
      hint: !exercise.bilateral ? '' : side === 0
        ? 'Первая сторона · смена через ' + Math.max(1, Math.ceil(half - elapsed)) + ' с'
        : 'Другая сторона · смените руку или ногу'
    };
  }
  var api = { select: select };
  root.ParakliWorkoutMedia = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
