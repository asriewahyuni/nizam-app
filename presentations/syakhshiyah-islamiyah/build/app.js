(function () {
  var NOTES = __NOTES_DATA__;
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var dots = Array.prototype.slice.call(document.querySelectorAll('.dot'));
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var notesToggle = document.getElementById('notesToggle');
  var notesPanel = document.getElementById('notesPanel');
  var notesText = document.getElementById('notesText');
  var notesIndex = document.getElementById('notesIndex');
  var current = 0;

  function render() {
    slides.forEach(function (s, i) { s.classList.toggle('active', i === current); });
    dots.forEach(function (d, i) { d.classList.toggle('active', i === current); });
    if (!notesPanel.hidden) updateNotes();
    var hash = slides[current].id;
    if (history.replaceState) history.replaceState(null, '', '#' + hash);
  }

  function updateNotes() {
    notesIndex.textContent = current + 1;
    notesText.textContent = NOTES[current] || '';
  }

  function goto(i) {
    current = Math.max(0, Math.min(slides.length - 1, i));
    render();
  }

  prevBtn.addEventListener('click', function () { goto(current - 1); });
  nextBtn.addEventListener('click', function () { goto(current + 1); });
  dots.forEach(function (d, i) { d.addEventListener('click', function () { goto(i); }); });

  notesToggle.addEventListener('click', function () {
    var open = notesPanel.hidden;
    notesPanel.hidden = !open;
    notesToggle.setAttribute('aria-expanded', String(open));
    if (open) updateNotes();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); goto(current + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goto(current - 1); }
    else if (e.key === 'Home') { goto(0); }
    else if (e.key === 'End') { goto(slides.length - 1); }
    else if (e.key.toLowerCase() === 'n') { notesToggle.click(); }
  });

  // click left/right thirds of a slide to navigate (desktop convenience)
  document.getElementById('deck').addEventListener('click', function (e) {
    if (e.target.closest('a, button')) return;
    var x = e.clientX, w = window.innerWidth;
    if (x < w * 0.28) goto(current - 1);
    else if (x > w * 0.72) goto(current + 1);
  });

  // touch swipe
  var touchStartX = null;
  document.addEventListener('touchstart', function (e) { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (touchStartX === null) return;
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 60) goto(current + (dx < 0 ? 1 : -1));
    touchStartX = null;
  }, { passive: true });

  var byId = slides.findIndex(function (s) { return s.id === (location.hash || '').replace('#', ''); });
  if (byId >= 0) current = byId;
  render();
})();
