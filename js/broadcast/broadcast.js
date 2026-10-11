/* Local, fact-based host discussions with Animalese voices. */
(() => {
  'use strict';
  const ids = [
    'tvMute',
    'tvLineNext',
    'tvVoice',
    'tvDiscussionStatus',
    'tvLiveHosts',
    'tvBubbles',
    'tvTranscript',
    'tvStage',
    'tvStagePlay',
    'tvIntro',
  ];
  const el = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  const pitches = [1.25, 0.83, 0.65, 1.45];
  const introSrc = 'assets/brand/hoopwire-tv-intro.mp3',
    introLeadMs = 8500;
  let turns = [],
    hosts = [],
    line = 0,
    running = false,
    audio = null,
    introAudio = null,
    outroAudio = null,
    timer = null,
    epoch = 0,
    samples = null,
    needsIntro = true,
    completed = false;
  let introElapsed = 0,
    introDuration = introLeadMs,
    introFrame = null,
    introAnimations = [],
    outroActive = false;
  let paused = false,
    lineRemaining = null,
    lineDue = 0,
    sweepAnimation = null;
  // The same red wipe that closes the opening sequence carries every cut
  // between the studio and the title card, so nothing snaps into place.
  const sweepPanel = document.createElement('div');
  sweepPanel.className = 'tv-transition';
  sweepPanel.hidden = true;
  sweepPanel.setAttribute('aria-hidden', 'true');
  el.tvStage.appendChild(sweepPanel);
  const stillMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Highlights: a few seconds of the story's play (HoopWireReplay), between the opening and the desk.
  // They run once the hosts have introduced themselves, before highlightLine, the first line about the story.
  // highlightDue says the episode has yet to show them; highlightAt is how far in a paused clip got.
  let highlight = null,
    highlightLine = 0,
    highlightDue = false,
    highlightAt = 0,
    highlightPlayer = null;
  const highlightCanvas = document.createElement('canvas');
  highlightCanvas.className = 'tv-highlight';
  highlightCanvas.width = 768;
  highlightCanvas.height = 432;
  highlightCanvas.hidden = true;
  highlightCanvas.setAttribute('role', 'img');
  el.tvStage.appendChild(highlightCanvas);
  function highlightAssets() {
    highlight.assets ||= window.HoopWireReplay.prepare(highlight.scene, highlight.clip, { label: 'HIGHLIGHTS' });
    return highlight.assets;
  }
  function hideHighlight() {
    highlightCanvas.hidden = true;
  }
  function sweep(phase) {
    sweepAnimation?.cancel();
    sweepAnimation = null;
    if (stillMotion()) {
      sweepPanel.hidden = true;
      return Promise.resolve(true);
    }
    const at = x => ({ transform: `translateX(${x}%) skewX(-18deg)` });
    sweepPanel.hidden = false;
    const animation = (sweepAnimation = sweepPanel.animate(phase === 'cover' ? [at(-130), at(0)] : [at(0), at(130)], {
      duration: phase === 'cover' ? 420 : 560,
      easing: phase === 'cover' ? 'cubic-bezier(.55,0,.85,.35)' : 'cubic-bezier(.2,.65,.3,1)',
      fill: 'forwards',
    }));
    return animation.finished.then(
      () => {
        if (phase === 'reveal' && sweepAnimation === animation) {
          sweepPanel.hidden = true;
          animation.cancel();
          sweepAnimation = null;
        }
        return true;
      },
      () => false
    );
  }
  function clearSweep() {
    sweepAnimation?.cancel();
    sweepAnimation = null;
    sweepPanel.hidden = true;
  }
  function introVisible(value) {
    el.tvIntro.hidden = !value;
    el.tvStage.classList.toggle('is-intro', value);
  }
  function settleLogo() {
    cancelAnimationFrame(introFrame);
    introFrame = null;
    introAnimations.forEach(a => a.cancel());
    introAnimations = [];
    introElapsed = 0;
    introDuration = introLeadMs;
    outroActive = false;
    updateStagePlay();
  }
  function clearIntro() {
    settleLogo();
    el.tvIntro.classList.remove('is-outro');
    el.tvIntro.querySelector('.tv-intro-eyebrow').textContent = 'THE DAILY DESK';
    el.tvIntro.querySelector('.tv-intro-tagline').textContent = 'THE GAME. THE STORIES. THE CONVERSATION.';
    introVisible(false);
  }
  function animateIntro() {
    if (introAnimations.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animate = (selector, frames) => {
      const a = el.tvIntro.querySelector(selector).animate(frames, { duration: 10000, fill: 'both', easing: 'linear' });
      a.pause();
      a.currentTime = 0;
      introAnimations.push(a);
    };
    animate('.tv-intro-grid', [{ transform: 'rotate(-12deg) scale(1.1)' }, { transform: 'rotate(-12deg) scale(1)' }]);
    animate('.tv-intro-orbit', [
      { opacity: 0, transform: 'scale(.7)', offset: 0 },
      { opacity: 0.5, transform: 'scale(1)', offset: 0.3 },
      { opacity: 0.25, transform: 'scale(1.1)', offset: 1 },
    ]);
    animate('.slash-one', [
      { transform: 'translateX(-160%) skewX(-20deg)', offset: 0 },
      { transform: 'translateX(0) skewX(-20deg)', offset: 0.18 },
      { transform: 'translateX(0) skewX(-20deg)', offset: 0.9 },
      { transform: 'translateX(350%) skewX(-20deg)', offset: 1 },
    ]);
    animate('.slash-two', [
      { transform: 'translateX(160%) skewX(-20deg)', offset: 0 },
      { transform: 'translateX(0) skewX(-20deg)', offset: 0.22 },
      { transform: 'translateX(0) skewX(-20deg)', offset: 0.9 },
      { transform: 'translateX(-350%) skewX(-20deg)', offset: 1 },
    ]);
    animate('.tv-intro-brand', [
      { opacity: 0, transform: 'translateY(20px) scale(1.12)', offset: 0 },
      { opacity: 0, transform: 'translateY(20px) scale(1.12)', offset: 0.1 },
      { opacity: 1, transform: 'translateY(0) scale(1)', offset: 0.3 },
      { opacity: 1, transform: 'translateY(0) scale(1)', offset: 0.92 },
      { opacity: 0, transform: 'translateY(0) scale(.96)', offset: 1 },
    ]);
    animate('.tv-intro-logo', [
      { clipPath: 'inset(0 100% 0 0)', offset: 0 },
      { clipPath: 'inset(0 100% 0 0)', offset: 0.14 },
      { clipPath: 'inset(0 0% 0 0)', offset: 0.34 },
      { clipPath: 'inset(0 0% 0 0)', offset: 1 },
    ]);
    animate('.tv-intro-tagline', [
      { opacity: 0, transform: 'translateY(8px)', offset: 0 },
      { opacity: 0, transform: 'translateY(8px)', offset: 0.34 },
      { opacity: 1, transform: 'translateY(0)', offset: 0.46 },
      { opacity: 1, transform: 'translateY(0)', offset: 1 },
    ]);
    animate('.tv-intro-wipe', [
      { transform: 'translateX(-130%) skewX(-18deg)', offset: 0 },
      { transform: 'translateX(-130%) skewX(-18deg)', offset: 0.9 },
      { transform: 'translateX(0%) skewX(-18deg)', offset: 1 },
    ]);
    animate('.tv-intro-progress', [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }]);
  }
  function introTick(token, media = null, closing = false) {
    const started = performance.now(),
      resumeAt = introElapsed;
    const tick = () => {
      if (token !== epoch || (closing ? !completed || paused : !running || !needsIntro)) return;
      if (media && Number.isFinite(media.duration) && media.duration > 0) introDuration = media.duration * 1000;
      introElapsed = media ? media.currentTime * 1000 : resumeAt + performance.now() - started;
      const progress = Math.min(1, introElapsed / introDuration);
      introAnimations.forEach(a => {
        a.currentTime = progress * 10000;
      });
      if (!media && progress >= 1) {
        if (closing) finishOutro();
        else beginHosts(token);
        return;
      }
      introFrame = requestAnimationFrame(tick);
    };
    tick();
  }
  function discussion(story, context) {
    if (!story) return [];
    const scripted = window.HoopWireBroadcastContent?.episode(
      story,
      hosts.length ? hosts.map(h => HoopWireCore.playerDisplay(h)) : undefined,
      context
    ) || [{ speaker: 0, text: story.headline }];
    const result = [];
    for (const turn of scripted) {
      const chunks = window.HoopWireBroadcastContent?.chunkDialogue(turn.text) || [turn.text];
      chunks.forEach((text, i) =>
        result.push({ speaker: turn.speaker, text, continuation: i > 0, ...(turn.intro ? { intro: true } : {}) })
      );
    }
    return result;
  }
  function spoken(text) {
    const ones = [
      'zero',
      'one',
      'two',
      'three',
      'four',
      'five',
      'six',
      'seven',
      'eight',
      'nine',
      'ten',
      'eleven',
      'twelve',
      'thirteen',
      'fourteen',
      'fifteen',
      'sixteen',
      'seventeen',
      'eighteen',
      'nineteen',
    ];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const number = n =>
      n < 20
        ? ones[n]
        : n < 100
          ? tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
          : n < 1000
            ? ones[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + number(n % 100) : '')
            : String(n)
                .split('')
                .map(d => ones[Number(d)])
                .join(' ');
    return text.replace(/(\d+)[–-](\d+)/g, '$1 to $2').replace(/\d+/g, n => number(Number(n)));
  }
  function voiceSamples() {
    if (!samples)
      samples = new Promise((resolve, reject) => {
        let synth;
        synth = new Animalese('assets/voice/samples.wav', () => resolve(synth), reject);
      }).catch(error => {
        samples = null;
        throw error;
      });
    return samples;
  }
  function talking(value) {
    for (const host of el.tvLiveHosts.children)
      host.classList.toggle('is-speaking', value && Number(host.dataset.host) === turns[line]?.speaker);
    el.tvStage.classList.toggle('is-talking', value);
  }
  function updateStagePlay() {
    if (!el.tvStagePlay) return;
    const available = turns.length > 0;
    let label = 'Play episode';
    if (available && completed) label = outroActive ? 'Resume episode' : 'Replay episode';
    else if (available && (!needsIntro || introElapsed > 0)) label = 'Resume episode';
    el.tvStagePlay.disabled = !available;
    el.tvStagePlay.hidden = running || !available || (outroActive && !paused);
    el.tvStagePlay.setAttribute('aria-label', label.replace('episode', 'HoopWire TV episode'));
    const text = el.tvStagePlay.querySelector('.tv-stage-play-label');
    if (text) text.textContent = label;
  }
  function stop(resetIntro = true) {
    if (!resetIntro && running && lineDue) lineRemaining = Math.max(0, lineDue - performance.now());
    if (resetIntro) {
      lineRemaining = null;
      lineDue = 0;
    }
    paused = !resetIntro;
    epoch++;
    running = false;
    clearTimeout(timer);
    timer = null;
    cancelAnimationFrame(introFrame);
    introFrame = null;
    if (audio) {
      audio.onended = audio.onerror = null;
      audio.pause();
      if (resetIntro) {
        audio.removeAttribute('src');
        audio = null;
      }
    }
    if (outroAudio) {
      introElapsed = outroAudio.currentTime * 1000;
      outroAudio.onended = outroAudio.onerror = null;
      outroAudio.pause();
      if (resetIntro) {
        outroAudio.removeAttribute('src');
        outroAudio = null;
      }
    }
    if (introAudio) {
      introElapsed = introAudio.currentTime * 1000;
      introAudio.onended = introAudio.onerror = null;
      introAudio.pause();
      if (resetIntro) {
        introAudio.removeAttribute('src');
        introAudio = null;
      }
    }
    if (highlightPlayer) {
      highlightAt = highlightPlayer.elapsed();
      highlightPlayer.stop();
      highlightPlayer = null;
    }
    if (resetIntro) {
      highlightDue = !!highlight;
      highlightAt = 0;
    }
    // A paused clip stays up under the play button; otherwise the desk shows.
    if (resetIntro || !highlightDue) hideHighlight();
    clearSweep();
    if (resetIntro) clearIntro();
    talking(false);
    updateStagePlay();
  }
  function beginHosts(token) {
    if (token !== epoch || !running || !needsIntro) return;
    clearTimeout(timer);
    timer = null;
    if (introAudio) {
      introAudio.onended = introAudio.onerror = null;
      introAudio.pause();
      introAudio = null;
    }
    sweep('reveal');
    clearIntro();
    needsIntro = false;
    if (highlightDue && line === highlightLine) return playHighlight(token);
    show();
    playLine();
  }
  // The highlights run full screen, then the same wipe takes the show back to the desk.
  async function playHighlight(token) {
    highlightCanvas.hidden = false;
    show();
    try {
      const assets = await highlightAssets();
      if (token !== epoch || !running) return;
      const player = (highlightPlayer = window.HoopWireReplay.play(highlightCanvas, assets, { from: highlightAt }));
      const finished = await player.done;
      if (highlightPlayer === player) highlightPlayer = null;
      if (!finished) return;
    } catch {
      // Without the clip the episode goes straight to the desk.
    }
    if (token !== epoch || !running) return;
    highlightDue = false;
    highlightAt = 0;
    await sweep('cover');
    if (token !== epoch || !running) return;
    hideHighlight();
    sweep('reveal');
    show();
    playLine();
  }
  async function playIntro() {
    const token = epoch;
    talking(false);
    introVisible(true);
    animateIntro();
    el.tvDiscussionStatus.textContent = 'Opening theme…';
    try {
      introAudio ||= new Audio(introSrc);
      const media = introAudio;
      introAudio.volume = 0.55;
      introAudio.muted = !el.tvVoice.checked;
      media.onended = () => beginHosts(token);
      media.onerror = () => {
        if (token !== epoch || !running) return;
        media.pause();
        media.onended = media.onerror = null;
        introAudio = null;
        cancelAnimationFrame(introFrame);
        introTick(token);
      };
      await media.play();
      if (token !== epoch || !running) return;
      introTick(token, media);
    } catch (error) {
      if (token !== epoch || !running) return;
      if (introAudio) {
        introAudio.pause();
        introAudio.onended = introAudio.onerror = null;
        introAudio = null;
      }
      cancelAnimationFrame(introFrame);
      introTick(token);
    }
  }
  function outroCard() {
    introVisible(true);
    el.tvIntro.classList.add('is-outro');
    el.tvIntro.querySelector('.tv-intro-eyebrow').textContent = 'THANKS FOR WATCHING';
    el.tvIntro.querySelector('.tv-intro-tagline').textContent = 'SEE YOU NEXT TIME ON THE DAILY DESK';
  }
  function finishOutro() {
    sweep('reveal');
    settleLogo();
  }
  async function playOutro() {
    const token = epoch,
      media = outroAudio || new Audio(introSrc);
    outroActive = true;
    updateStagePlay();
    outroCard();
    animateIntro();
    outroAudio = media;
    media.volume = 0.55;
    media.muted = !el.tvVoice.checked;
    const release = () => {
      media.onended = media.onerror = null;
      media.pause();
      outroAudio = null;
    };
    media.onended = () => {
      if (token !== epoch || outroAudio !== media) return;
      release();
      finishOutro();
    };
    const fallback = () => {
      if (token !== epoch || outroAudio !== media) return;
      release();
      cancelAnimationFrame(introFrame);
      introTick(token, null, true);
    };
    media.onerror = fallback;
    try {
      await media.play();
      if (token === epoch && outroAudio === media) introTick(token, media, true);
    } catch {
      fallback();
    }
  }
  function startPlayback() {
    if (!turns.length) return;
    paused = false;
    if (completed && outroActive) {
      playOutro();
      return;
    }
    if (completed) {
      stop();
      line = 0;
      needsIntro = true;
      completed = false;
    }
    running = true;
    updateStagePlay();
    show();
    if (needsIntro) playIntro();
    else if (highlightDue && line === highlightLine) playHighlight(epoch);
    else playLine();
  }
  function show() {
    el.tvBubbles.replaceChildren();
    el.tvBubbles.hidden = needsIntro || completed || (highlightDue && !highlightCanvas.hidden);
    const turn = turns[line];
    if (turn) {
      if (!needsIntro && !completed) {
        const bubble = document.createElement('div');
        bubble.className = `tv-speech host-${turn.speaker}`;
        const name = document.createElement('strong');
        name.textContent = HoopWireCore.playerDisplay(hosts[turn.speaker]);
        const text = document.createElement('span');
        text.textContent = turn.text;
        bubble.append(name, text);
        el.tvBubbles.appendChild(bubble);
      }
      el.tvDiscussionStatus.textContent = `Line ${line + 1} of ${turns.length}`;
    } else el.tvDiscussionStatus.textContent = 'Choose a story to start the discussion.';
    el.tvLineNext.disabled = !turn || needsIntro || line === turns.length - 1;
    if (needsIntro && !el.tvIntro.hidden)
      el.tvDiscussionStatus.textContent = running
        ? 'Opening theme…'
        : introElapsed > 0
          ? 'Opening theme paused.'
          : 'Play episode to start the show.';
    if (highlightDue && !highlightCanvas.hidden)
      el.tvDiscussionStatus.textContent = running ? highlightCanvas.getAttribute('aria-label') : 'Highlights paused.';
    if (completed) el.tvDiscussionStatus.textContent = 'Episode complete. Replay or choose the next story.';
    for (const [i, p] of [...el.tvTranscript.children].entries()) p.classList.toggle('current-line', i === line);
    updateStagePlay();
  }
  function advance(token) {
    if (token !== epoch || !running) return;
    lineRemaining = null;
    lineDue = 0;
    talking(false);
    if (line >= turns.length - 1) {
      completed = true;
      stop();
      outroActive = true;
      updateStagePlay();
      el.tvDiscussionStatus.textContent = 'Episode complete. Replay or choose the next story.';
      // Wipe the desk away, then pull the wipe off the closing card.
      const closing = epoch;
      sweep('cover').then(covered => {
        if (!covered || closing !== epoch || !completed) return;
        el.tvBubbles.replaceChildren();
        el.tvBubbles.hidden = true;
        outroCard();
        sweep('reveal');
        playOutro();
      });
      return;
    }
    timer = setTimeout(
      () => {
        if (token !== epoch || !running) return;
        line++;
        if (highlightDue && line === highlightLine) return playHighlight(token);
        show();
        playLine();
      },
      turns[line + 1]?.continuation ? 0 : 450
    );
  }
  async function playLine() {
    const token = epoch,
      turn = turns[line];
    try {
      if (audio || el.tvVoice.checked) {
        el.tvDiscussionStatus.textContent = 'Preparing voice…';
        if (!audio) {
          const synth = await voiceSamples();
          if (token !== epoch || !running) return;
          const wav = synth.Animalese(spoken(turn.text), true, pitches[turn.speaker]);
          audio = new Audio(wav.dataURI);
          audio.volume = 0.38;
          audio.playbackRate = 0.9;
          audio.preservesPitch = true;
        }
        audio.muted = !el.tvVoice.checked;
        audio.onended = () => {
          audio = null;
          advance(token);
        };
        audio.onerror = () => {
          if (token !== epoch) return;
          stop();
          el.tvDiscussionStatus.textContent =
            'Voice playback failed. Turn off Animalese voices to continue with speech bubbles.';
        };
        await audio.play();
        if (token !== epoch || !running) return;
        el.tvDiscussionStatus.textContent = `Line ${line + 1} of ${turns.length}`;
        talking(true);
      } else holdLine(turn, token);
    } catch (error) {
      if (token !== epoch || !running) return;
      audio?.pause();
      audio = null;
      el.tvDiscussionStatus.textContent = 'Voice unavailable; continuing with speech bubbles.';
      holdLine(turn, token);
    }
  }
  function holdLine(turn, token) {
    const delay = lineRemaining ?? Math.max(2800, Math.min(9800, turn.text.length * 52));
    lineRemaining = null;
    lineDue = performance.now() + delay;
    talking(true);
    timer = setTimeout(() => advance(token), delay);
  }
  // options.shots: the featured player's made shots from the save, for highlights of the real play.
  function mount(story, studio, autoplay = false, context, options = {}) {
    highlight = null;
    const R = window.HoopWireReplay,
      scene = story?.sceneInputs,
      clip = R?.available(scene) && !stillMotion() ? R.plan(scene, story, options.shots || []) : null;
    if (clip) {
      highlight = { scene, clip, assets: null };
      highlightCanvas.setAttribute('aria-label', R.caption(scene, clip).replace(/^Replay:/, 'Highlights:'));
    }
    stop();
    line = 0;
    needsIntro = true;
    completed = false;
    hosts = studio?.inputs.announcers || HoopWireTV.inputs({ teams: [] }).announcers;
    turns = discussion(story, context);
    highlightLine = Math.max(
      0,
      turns.findIndex(turn => !turn.intro)
    );
    el.tvLiveHosts.replaceChildren();
    el.tvTranscript.replaceChildren();
    if (studio?.backdropBlob)
      hosts.forEach((person, i) => {
        const slot = document.createElement('div');
        slot.className = 'tv-live-host';
        slot.dataset.host = i;
        slot.style.left = `${((70 + i * 220) / 960) * 100}%`;
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 168;
        const draw = () => {
          HoopWirePlayer.draw(canvas, person, null, 0, 0, 'idle');
          if (i < 2) {
            const copy = document.createElement('canvas');
            copy.width = 128;
            copy.height = 168;
            copy.getContext('2d').drawImage(canvas, 0, 0);
            const c = canvas.getContext('2d');
            c.clearRect(0, 0, 128, 168);
            c.save();
            c.translate(128, 0);
            c.scale(-1, 1);
            c.drawImage(copy, 0, 0);
            c.restore();
          }
        };
        HoopWirePlayer.ready().then(() => {
          if (slot.isConnected) draw();
        });
        slot.appendChild(canvas);
        el.tvLiveHosts.appendChild(slot);
      });
    turns.forEach(turn => {
      const p = document.createElement('p');
      const name = document.createElement('strong');
      name.textContent = HoopWireCore.playerDisplay(hosts[turn.speaker]) + ': ';
      p.append(name, document.createTextNode(turn.text));
      el.tvTranscript.appendChild(p);
    });
    introVisible(turns.length > 0);
    show();
    if (autoplay && turns.length) startPlayback();
  }
  function togglePlayback() {
    if (running || (outroActive && !paused)) {
      stop(false);
      show();
    } else startPlayback();
  }
  el.tvStage.addEventListener('click', event => {
    if (event.composedPath().some(node => node instanceof Element && node.matches('button,input,a'))) return;
    togglePlayback();
  });
  el.tvStage.addEventListener('keydown', event => {
    if (event.target !== el.tvStage || ![' ', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    togglePlayback();
  });
  el.tvStagePlay.addEventListener('click', startPlayback);
  el.tvLineNext.addEventListener('click', () => {
    stop();
    completed = false;
    needsIntro = false;
    line = Math.min(turns.length - 1, line + 1);
    // Stepping past the story's first line skips the highlights.
    highlightDue &&= line <= highlightLine;
    show();
  });
  function muteLabel() {
    const label = el.tvVoice.checked ? 'Mute voices' : 'Unmute voices';
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = el.tvVoice.checked ? '🔊' : '🔇';
    el.tvMute.replaceChildren(icon);
    el.tvMute.setAttribute('aria-label', label);
    el.tvMute.title = label;
    el.tvMute.setAttribute('aria-pressed', String(!el.tvVoice.checked));
  }
  el.tvMute.addEventListener('click', event => {
    event.stopPropagation();
    el.tvVoice.checked = !el.tvVoice.checked;
    try {
      localStorage.setItem('hoopwire.voices.muted', String(!el.tvVoice.checked));
    } catch {}
    if (audio) audio.muted = !el.tvVoice.checked;
    if (introAudio) introAudio.muted = !el.tvVoice.checked;
    if (outroAudio) outroAudio.muted = !el.tvVoice.checked;
    if (!audio && !introAudio && running && el.tvVoice.checked && !needsIntro) {
      clearTimeout(timer);
      epoch++;
      playLine();
    }
    muteLabel();
  });
  el.tvVoice.addEventListener('change', () => {
    stop();
    muteLabel();
    show();
  });
  try {
    el.tvVoice.checked = localStorage.getItem('hoopwire.voices.muted') !== 'true';
  } catch {}
  muteLabel();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop(false);
      show();
    }
  });
  window.addEventListener('pagehide', () => stop());
  window.HoopWireBroadcast = {
    mount,
    stop,
    discussion,
    voiceSamples,
    voicePitches: [...pitches],
  };
})();
