// Animate elements into view on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.show-card, .about-card, .team-card, .join-item, .award-card, .video-card, .podcast-card, .sports-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});

// ─── Hero badge: three-state display ───
// Priority order (live always wins over Thursday):
// 1. Live stream → "ON AIR"     (red, default styling)
// 2. Thursday    → "RECORDING"  (red, default styling)
// 3. Otherwise   → "WEEKLY NEWS" brand idle (gold/green)
//
// State 3 uses the brand-mode class which styles.css overrides to
// gold background + BBN green text/dot.
// Uses the visitor's local timezone — fine for BBN's Chandler-based audience.
var _onAirFadeTimeout = null;

function updateOnAirBadge(isLive) {
  var badge = document.querySelector('.on-air-badge');
  if (!badge) return;
  var textEl = badge.querySelector('.on-air-text');

  var RECORDING_DAY = 4; // Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
  var isRecordingDay = new Date().getDay() === RECORDING_DAY;

  // Reset: cancel any pending fade, clear brand class
  if (_onAirFadeTimeout) {
    clearTimeout(_onAirFadeTimeout);
    _onAirFadeTimeout = null;
  }
  badge.classList.remove('brand-mode');
  badge.style.display = '';

  function setText(newText) {
    if (!textEl) return;
    textEl.style.transition = '';
    textEl.style.opacity = '1';
    textEl.textContent = newText;
  }

  if (isLive) {
    // Live wins regardless of day — just "ON AIR"
    setText('ON AIR');
  } else if (isRecordingDay) {
    setText('RECORDING');
  } else {
    badge.classList.add('brand-mode');
    setText('WEEKLY NEWS');
  }
}
// Initial state: assume not live; the status fetch below flips it on
updateOnAirBadge(false);

// ─── Broadcast status: single fetch from our own status.json ───
// status.json lives in this repo and is updated by the "Broadcast Status"
// GitHub Action (manual live on/off trigger + daily latest-episode refresh).
// No third-party proxies: visitors only ever talk to bashabearnetwork.org.
//
// The ?t= cache-buster matters — GitHub Pages' CDN caches files for up to
// 10 minutes, and a unique query string forces a fresh copy each poll.
(function broadcastStatus() {
  var CHANNEL_ID = 'UCWQG8OvkNCZ3405ZMXgZ3dA';
  var PLAYLIST_ID = 'PLk3YT4kiAMWmCY2ZQiKBitpF5NP2DAilZ';
  var VALID_ID = /^[A-Za-z0-9_-]{11}$/;
  var POLL_MS = 60000;

  var _lastApplied = ''; // avoid re-touching the DOM when nothing changed

  // Safe note builder: bold title + plain suffix, all via textContent —
  // nothing from the network is ever parsed as HTML.
  function setNote(el, boldText, suffix) {
    if (!el) return;
    var strong = document.createElement('strong');
    strong.style.color = 'var(--text)';
    strong.textContent = boldText;
    el.replaceChildren(strong, document.createTextNode(suffix || ''));
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function applyLatestEpisode(ep) {
    var iframe = document.getElementById('latest-episode-embed');
    var note = document.getElementById('latest-episode-title');

    if (ep && VALID_ID.test(ep.videoId || '')) {
      var src = 'https://www.youtube-nocookie.com/embed/' + ep.videoId;
      if (iframe && iframe.src !== src) iframe.src = src;
      var date = formatDate(ep.published);
      setNote(note, ep.title || 'Latest episode', date ? ' \u00B7 ' + date : '');
    } else {
      // Fallback: playlist embed so visitors still get current content
      if (iframe) iframe.src = 'https://www.youtube-nocookie.com/embed/videoseries?list=' + PLAYLIST_ID;
      if (note) {
        var link = document.createElement('a');
        link.href = 'https://www.youtube.com/playlist?list=' + PLAYLIST_ID;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'the Weekly Episodes playlist';
        note.replaceChildren(document.createTextNode('Watch the latest from '), link, document.createTextNode('.'));
      }
    }
  }

  function showLive(videoId, title) {
    var offline = document.getElementById('live-offline');
    var iframe = document.getElementById('live-embed');
    var label = document.getElementById('live-status-label');
    var indicator = document.getElementById('live-indicator');

    if (indicator) indicator.classList.remove('offline');
    if (offline) offline.style.display = 'none';
    if (iframe) {
      // Specific video ID if one was provided, otherwise YouTube's
      // channel live embed automatically shows the current stream.
      var src = VALID_ID.test(videoId || '')
        ? 'https://www.youtube-nocookie.com/embed/' + videoId + '?autoplay=0'
        : 'https://www.youtube-nocookie.com/embed/live_stream?channel=' + CHANNEL_ID;
      if (iframe.src !== src) iframe.src = src;
      iframe.style.display = 'block';
    }
    if (label) label.textContent = 'LIVE NOW';
    setNote(document.getElementById('live-note'), title || 'BBN Live', ' \u00B7 Live now on the Basha Bear Network');
    updateOnAirBadge(true);
  }

  function showOffline() {
    var offline = document.getElementById('live-offline');
    var iframe = document.getElementById('live-embed');
    var label = document.getElementById('live-status-label');
    var indicator = document.getElementById('live-indicator');

    if (indicator) indicator.classList.add('offline');
    if (iframe) {
      iframe.style.display = 'none';
      iframe.removeAttribute('src');
    }
    if (offline) offline.style.display = '';
    if (label) label.textContent = 'Off Air';
    updateOnAirBadge(false);
  }

  function refresh() {
    fetch('status.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(status) {
        var key = JSON.stringify(status);
        if (key === _lastApplied) return; // nothing changed since last poll
        _lastApplied = key;

        applyLatestEpisode(status.latestEpisode);
        if (status.live) {
          showLive(status.videoId, status.title);
        } else {
          showOffline();
        }
      })
      .catch(function(err) {
        console.warn('Status fetch failed:', err);
        if (!_lastApplied) { // only force fallbacks if we never got a good read
          applyLatestEpisode(null);
          showOffline();
        }
      });
  }

  refresh();
  setInterval(refresh, POLL_MS); // viewers with the tab open see the flip within ~1 min
})();
