// Covers the blank page at launch with the studio logo.
(function () {
  var inflight = 0;

  // Counted so the cover can wait for the first requests to finish.
  var nativeFetch = window.fetch;
  if (nativeFetch)
    window.fetch = function () {
      inflight++;
      var request = nativeFetch.apply(this, arguments);
      var done = function () {
        inflight--;
      };
      request.then(done, done);
      return request;
    };

  // Pictures on screen still loading, or not given a source yet by the app's image cache.
  function pending() {
    var imgs = document.images;
    for (var i = 0; i < imgs.length; i++) {
      var r = imgs[i].getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight)
        continue;
      if (r.right < 0 || r.left > innerWidth) continue;
      if (!imgs[i].getAttribute('src') || !imgs[i].complete) return true;
    }
    return false;
  }

  var shown = Date.now();
  var cover = document.createElement('div');
  cover.style.cssText =
    'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483000;' +
    // The app's sea (tvos ambient.css), as splash.png has it.
    'background:radial-gradient(70vw 60vh at 50% 110%,rgba(12,110,140,.17),transparent 70%),' +
    'linear-gradient(170deg,#010208 0%,#020818 40%,#04132a 72%,#062436 100%);' +
    'display:flex;align-items:center;justify-content:center;overflow:hidden;transition:opacity .4s;pointer-events:none';
  var style = document.createElement('style');
  // The app's two sea currents (tvos ambient.css), started mid-swell so they already move: slow drift hides the frames a TV busy drawing the app underneath drops.
  style.textContent =
    '@keyframes studio-current-a{0%{transform:translate3d(-14%,6%,0) rotate(-7deg) scale(1.1,.95)}' +
    '50%{transform:translate3d(4%,-6%,0) rotate(2deg) scale(1.25,.85)}' +
    '100%{transform:translate3d(15%,4%,0) rotate(8deg) scale(1,1.15)}}' +
    '@keyframes studio-current-b{0%{transform:translate3d(14%,-6%,0) rotate(5deg) scale(1.2,.9)}' +
    '50%{transform:translate3d(-6%,5%,0) rotate(-4deg) scale(1,1.15)}' +
    '100%{transform:translate3d(-15%,-3%,0) rotate(-8deg) scale(1.15,.95)}}' +
    '@keyframes studio-settle{0%{opacity:0;transform:scale3d(.94,.94,1)}100%{opacity:1;transform:none}}';
  // Each spot as radial-gradient(rx ry at x y, colour, transparent 70%): radii and centre as shares of the box.
  var currents = [
    [
      [0.4, 0.24, 0.32, 0.58, '34,211,238', 0.26],
      [0.44, 0.28, 0.7, 0.34, '37,99,235', 0.35],
      [0.32, 0.2, 0.58, 0.82, '14,165,233', 0.23],
    ],
    [
      [0.48, 0.17, 0.4, 0.3, '56,189,248', 0.18],
      [0.42, 0.21, 0.78, 0.7, '45,212,191', 0.2],
      [0.36, 0.19, 0.18, 0.76, '29,78,216', 0.28],
    ],
  ];
  var drifts = [
    'studio-current-a 18s ease-in-out -6s',
    'studio-current-b 24s ease-in-out -8s',
  ];
  cover.appendChild(style);
  for (var c = 0; c < currents.length; c++) {
    // Drawn small into a canvas the GPU stretches, as the app's sea (parts.tsx): as CSS gradients 1.7 screens wide, the TV redrew them each frame.
    var canvas = document.createElement('canvas');
    canvas.width = 408;
    canvas.height = 230;
    var ctx = canvas.getContext('2d');
    // CSS paints the first gradient on top.
    for (var i = currents[c].length - 1; i >= 0; i--) {
      var s = currents[c][i];
      ctx.setTransform(s[0] * 408, 0, 0, s[1] * 230, s[2] * 408, s[3] * 230);
      var glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      glow.addColorStop(0, 'rgba(' + s[4] + ',' + s[5] + ')');
      glow.addColorStop(0.7, 'rgba(' + s[4] + ',0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-s[2] / s[0], -s[3] / s[1], 1 / s[0], 1 / s[1]);
    }
    // Larger than the screen, so the drift never shows an edge.
    canvas.style.cssText =
      'position:absolute;left:-35%;top:-35%;width:170%;height:170%;will-change:transform;' +
      'animation:' +
      drifts[c] +
      ' infinite alternate';
    cover.appendChild(canvas);
  }
  var logo = document.createElement('img');
  logo.src = 'loader-logo.png';
  // Settles in once, then holds still over the moving sea.
  logo.style.cssText =
    'position:relative;height:42.6vh;will-change:opacity,transform;backface-visibility:hidden;' +
    'animation:studio-settle .9s cubic-bezier(.2,.8,.2,1) both';
  cover.appendChild(logo);
  document.documentElement.appendChild(cover);

  var settledAt = 0;
  var timer = setInterval(function () {
    var root = document.getElementById('root');
    var now = Date.now();
    // Held 2 s at least, so it never just flashes.
    if (!root || !root.childNodes.length || now - shown < 2000) return;
    // The first screen's pictures are fetched and saved under the cover, not under a click; 5 s at most.
    if (now - shown < 5000) {
      if (inflight > 0 || pending()) return void (settledAt = 0);
      // A moment for the saves that follow each load.
      if (!settledAt) return void (settledAt = now);
      if (now - settledAt < 500) return;
    }
    clearInterval(timer);
    cover.style.opacity = '0';
    setTimeout(function () {
      cover.parentNode.removeChild(cover);
    }, 450);
  }, 100);
})();
