/* JS/SFX.JS - Small interface sounds, synthesized in the browser (no audio files).
   Sfx.play('good' | 'bad' | 'tick' | 'drop' | 'cash' | 'open' | 'week'); Sfx.muted toggles. */
window.Sfx = (function () {
  let ac = null, muted = false;
  try { muted = localStorage.getItem('bts-muted') === '1'; } catch (e) { /* storage blocked */ }
  const NOTES = {
    good: [[660, 0, 0.07], [880, 0.07, 0.1]],
    bad: [[300, 0, 0.09], [220, 0.09, 0.14]],
    tick: [[1200, 0, 0.03]],
    drop: [[180, 0, 0.08], [120, 0.04, 0.08]],
    cash: [[1320, 0, 0.05], [1760, 0.05, 0.12]],
    open: [[520, 0, 0.05], [780, 0.05, 0.06]],
    week: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.18]],
  };
  let lastAt = 0;
  function play(name) {
    if (muted || !NOTES[name]) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const now = ac.currentTime;
      if (name === 'tick' && now - lastAt < 0.25) return;
      lastAt = now;
      NOTES[name].forEach(([freq, at, len]) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = name === 'bad' ? 'square' : 'triangle';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, now + at);
        g.gain.exponentialRampToValueAtTime(name === 'bad' ? 0.035 : 0.06, now + at + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + at + len);
        o.connect(g).connect(ac.destination);
        o.start(now + at); o.stop(now + at + len + 0.02);
      });
    } catch (e) { /* no audio available */ }
  }
  function setMuted(m) { muted = m; try { localStorage.setItem('bts-muted', m ? '1' : '0'); } catch (e) { /* ignore */ } }
  return { play, setMuted, get muted() { return muted; } };
})();
