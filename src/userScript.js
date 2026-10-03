/*
 * TizenPrehrajTo – TizenBrew mod pro Samsung TV
 * Vstupní bod injektovaný do https://prehrajto.cz/
 *
 * Vlastní CSS patří do src/userStyles.css, vlastní JS do sekce
 * "VLASTNÍ JS" níže. Po změně spusť `npm run build` a commitni dist/.
 */
(function () {
  'use strict';

  var CUSTOM_CSS = /*__CSS__*/ '';

  // Tizen keyCodes
  var KEY = {
    BACK: 10009,
    MEDIA_PLAY_PAUSE: 10252,
    MEDIA_PLAY: 415,
    MEDIA_PAUSE: 19,
    MEDIA_STOP: 413,
    MEDIA_FAST_FORWARD: 417,
    MEDIA_REWIND: 412,
  };

  var SEEK_STEP_SECONDS = 10;

  function injectCss() {
    if (!CUSTOM_CSS) return;
    var style = document.createElement('style');
    style.id = 'prehrajto-tizen-styles';
    style.textContent = CUSTOM_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function whenDomReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function registerMediaKeys() {
    try {
      var keys = [
        'MediaPlayPause',
        'MediaPlay',
        'MediaPause',
        'MediaStop',
        'MediaFastForward',
        'MediaRewind',
      ];
      keys.forEach(function (name) {
        try {
          window.tizen.tvinputdevice.registerKey(name);
        } catch (e) {
          // klávesa nemusí být na všech modelech dostupná
        }
      });
    } catch (e) {
      // mimo Tizen (vývoj v desktop prohlížeči) tizen API neexistuje
    }
  }

  function activeVideo() {
    var videos = document.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      if (videos[i].readyState > 0) return videos[i];
    }
    return videos[0] || null;
  }

  function onKeyDown(e) {
    var video = activeVideo();

    switch (e.keyCode) {
      case KEY.BACK:
        // Na úvodní stránce nech Back projít (ukončení appky / návrat do TizenBrew),
        // jinde funguje jako "zpět" v historii.
        if (location.pathname !== '/') {
          e.preventDefault();
          e.stopPropagation();
          history.back();
        }
        return;

      case KEY.MEDIA_PLAY_PAUSE:
        if (video) video.paused ? video.play() : video.pause();
        break;

      case KEY.MEDIA_PLAY:
        if (video) video.play();
        break;

      case KEY.MEDIA_PAUSE:
        if (video) video.pause();
        break;

      case KEY.MEDIA_STOP:
        if (video) {
          video.pause();
          video.currentTime = 0;
        }
        break;

      case KEY.MEDIA_FAST_FORWARD:
        if (video) video.currentTime = Math.min(video.duration || Infinity, video.currentTime + SEEK_STEP_SECONDS);
        break;

      case KEY.MEDIA_REWIND:
        if (video) video.currentTime = Math.max(0, video.currentTime - SEEK_STEP_SECONDS);
        break;

      default:
        return;
    }

    e.preventDefault();
    e.stopPropagation();
  }

  // ------------------------------------------------------------------
  // VLASTNÍ JS – sem piš svoje úpravy stránky
  // ------------------------------------------------------------------
  function customJs() {
    // např.: document.querySelector('.search-input').focus();
  }
  // ------------------------------------------------------------------

  injectCss();
  registerMediaKeys();
  window.addEventListener('keydown', onKeyDown, true);
  whenDomReady(customJs);
})();
