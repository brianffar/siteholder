/* Light / dark switch for the mock-ups. Same behaviour and storage key ('sh-theme') as the main site:
   follows the device until the visitor picks one, and the pick carries over to siteholderrecords.com. */
(function () {
  var root = document.documentElement;
  try { var saved = localStorage.getItem('sh-theme'); if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved); } catch (e) {}
  function effective() { var t = root.getAttribute('data-theme'); return t || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.createElement('button');
    btn.className = 'theme'; btn.type = 'button'; btn.setAttribute('role', 'switch'); btn.setAttribute('aria-label', 'Dark mode');
    btn.innerHTML = '<span class="track"></span><span class="theme-label">Light</span>';
    var label = btn.querySelector('.theme-label');
    function sync() { var d = effective() === 'dark'; btn.setAttribute('aria-checked', d); label.textContent = d ? 'Dark' : 'Light'; }
    btn.addEventListener('click', function () {
      var next = effective() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('sh-theme', next); } catch (e) {}
      sync();
    });
    if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', sync); } catch (e) {} }
    sync();
    var top = document.querySelector('.top .wrap'), bar = document.querySelector('.mockbar');
    if (top) {
      var right = document.createElement('span'); right.className = 'top-right';
      var tag = top.querySelector('.tag'); right.appendChild(btn); if (tag) right.appendChild(tag);
      top.appendChild(right);
    } else if (bar) {
      bar.appendChild(btn);
    }
  });
})();
