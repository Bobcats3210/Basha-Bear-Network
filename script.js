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
// 3. Otherwise   → rotates EST. 2022 / WEEKLY NEWS in gold/green every 4s
//
// State 3 uses the brand-mode class which styles.css overrides to
// gold background + BBN green text/dot.
// Uses the visitor's local timezone — fine for BBN's Chandler-based audience.
var _onAirRotateInterval = null;
var _onAirFadeTimeout = null;

function updateOnAirBadge(isLive) {
  var badge = document.querySelector('.on-air-badge');
  if (!badge) return;
  var textEl = badge.querySelector('.on-air-text');

  var RECORDING_DAY = 4; // Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
  var isRecordingDay = new Date().getDay() === RECORDING_DAY;

  // Reset: cancel any pending fade + rotation, clear brand class
  if (_onAirFadeTimeout) {
    clearTimeout(_onAirFadeTimeout);
    _onAirFadeTimeout = null;
  }
  if (_onAirRotateInterval) {
    clearInterval(_onAirRotateInterval);
    _onAirRotateInterval = null;
  }
  badge.classList.remove('brand-mode');
  badge.style.display = '';

  // Smooth crossfade when swapping text. Tracks the timeout so it can be
  // cancelled if updateOnAirBadge is called again mid-fade (prevents the
  // pending swap from corrupting fresh state).
  function fadeSwap(newText) {
    if (!textEl) return;
    textEl.style.transition = 'opacity 0.3s ease';
    textEl.style.opacity = '0';
    _onAirFadeTimeout = setTimeout(function() {
      textEl.textContent = newText;
      textEl.style.opacity = '1';
      _onAirFadeTimeout = null;
    }, 300);
  }

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
// Initial state: assume not live; checkLiveStatus will flip it on if a stream is detected
updateOnAirBadge(false);

// ─── Auto-fetch latest BBN episode from the channel uploads feed ───
// Filters for "Basha Bear Network Episode" titles. If the API call fails,
// falls back to the playlist's video-series embed so visitors still get
// current content rather than a hardcoded stale episode.
(function fetchLatestEpisode() {
  var CHANNEL_ID = 'UCWQG8OvkNCZ3405ZMXgZ3dA';
  var PLAYLIST_ID = 'PLk3YT4kiAMWmCY2ZQiKBitpF5NP2DAilZ';
  var rssUrl = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL_ID;
  var apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(rssUrl);

  var iframe = document.getElementById('latest-episode-embed');
  var note = document.getElementById('latest-episode-title');

  fetch(apiUrl)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data || !data.items || !data.items.length) throw new Error('No items returned');

      // Primary filter: "Basha Bear Network Episode #"
      var episodes = data.items.filter(function(item) {
        return /basha bear network episode/i.test(item.title);
      });
      // Fallback 1: anything with "Episode" in the title
      if (!episodes.length) {
        episodes = data.items.filter(function(item) {
          return /episode/i.test(item.title);
        });
      }
      // Fallback 2: just use the newest upload of any kind
      if (!episodes.length) episodes = data.items;

      // Sort newest first, regardless of feed order
      episodes.sort(function(a, b) { return new Date(b.pubDate) - new Date(a.pubDate); });
      var latest = episodes[0];

      var match = latest.link.match(/[?&]v=([^&]+)/);
      if (!match) throw new Error('No video ID in latest item');
      var videoId = match[1];

      if (iframe) iframe.src = 'https://www.youtube-nocookie.com/embed/' + videoId;
      if (note) {
        var date = latest.pubDate ? new Date(latest.pubDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
        note.innerHTML = '<strong style="color:var(--text);">' + latest.title + '</strong>' + (date ? ' &middot; ' + date : '');
      }
    })
    .catch(function(err) {
      console.warn('Latest episode fetch failed:', err);
      if (iframe) iframe.src = 'https://www.youtube-nocookie.com/embed/videoseries?list=' + PLAYLIST_ID;
      if (note) note.innerHTML = 'Watch the latest from <a href="https://www.youtube.com/playlist?list=' + PLAYLIST_ID + '" target="_blank">the Weekly Episodes playlist</a>.';
    });
})();

// ─── Auto-detect BBN livestream status ───
// Uses a public CORS proxy to check the /live URL — if BBN is currently streaming,
// YouTube redirects /live to the actual watch URL. If not, no redirect.
(function checkLiveStatus() {
  var CHANNEL_HANDLE = 'bashabearnetwork';
  var liveCheckUrl = 'https://www.youtube.com/@' + CHANNEL_HANDLE + '/live';
  var proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(liveCheckUrl);

  function showOffline() {
    var indicator = document.getElementById('live-indicator');
    if (indicator) indicator.classList.add('offline');
    var label = document.getElementById('live-status-label');
    if (label) label.textContent = 'Off Air';
    updateOnAirBadge(false); // hero badge falls back to RECORDING (Thursdays) or brand idle rotation
  }

  function showLive(videoId, title) {
    var offline = document.getElementById('live-offline');
    var iframe = document.getElementById('live-embed');
    var label = document.getElementById('live-status-label');
    var indicator = document.getElementById('live-indicator');
    if (indicator) indicator.classList.remove('offline');
    if (offline) offline.style.display = 'none';
    if (iframe) {
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + videoId + '?autoplay=0';
      iframe.style.display = 'block';
    }
    if (label) label.textContent = 'LIVE NOW';
    var note = document.getElementById('live-note');
    if (note && title) note.innerHTML = '<strong style="color:var(--text);">' + title + '</strong> · Live now on the Basha Bear Network';
    updateOnAirBadge(true);
  }

  fetch(proxyUrl)
    .then(function(r) { return r.text(); })
    .then(function(html) {
      // When channel is live, the HTML contains the live video ID in canonical/og:url meta tags.
      // Forward slashes inside the URLs are escaped so the regex literal doesn't terminate early.
      var canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([^"&]+)"/);
      var ogMatch        = html.match(/<meta property="og:url" content="https:\/\/www\.youtube\.com\/watch\?v=([^"&]+)"/);
      var match = canonicalMatch || ogMatch;
      if (match && match[1]) {
        var titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
        var title = titleMatch ? titleMatch[1] : '';
        showLive(match[1], title);
      } else {
        showOffline();
      }
    })
    .catch(function(err) {
      console.log('Live status check failed:', err);
      showOffline();
    });
})();
