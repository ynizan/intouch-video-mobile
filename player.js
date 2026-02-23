// ===============================================================
// PLAYER STATE
// ===============================================================
let elapsed=0, playing=false, speed=1.0, lastTs=null, rafId=null;
let voVisible=false;

// ===============================================================
// AUDIO ENGINE
// ===============================================================
const audioEls = {};
SCENES.forEach(sc => {
  if(!sc.audio) return;
  const a = new Audio(sc.audio);
  a.preload = 'auto';
  audioEls[sc.id] = a;
});

let currentAudio = null;

// Background music -- continuous across all scenes
// Drop audio/music.mp3 into place to enable
const musicEl = new Audio('music.mp3');
musicEl.loop = true;
musicEl.volume = 0;

const MUSIC_MAX_VOL = 0.25;
const MUSIC_FADE_MS = 1000; // 1s fade in/out

function updateMusicVolume() {
  let vol = MUSIC_MAX_VOL;
  if (elapsed < MUSIC_FADE_MS) {
    vol = MUSIC_MAX_VOL * (elapsed / MUSIC_FADE_MS);
  } else if (elapsed > TOTAL - MUSIC_FADE_MS) {
    vol = MUSIC_MAX_VOL * ((TOTAL - elapsed) / MUSIC_FADE_MS);
  }
  musicEl.volume = Math.max(0, Math.min(MUSIC_MAX_VOL, vol));
}

function stopAllAudio() {
  Object.values(audioEls).forEach(a => { a.pause(); a.currentTime = 0; });
  currentAudio = null;
}

function playSceneAudio(sc) {
  stopAllAudio();
  if(!sc.audio || !audioEls[sc.id]) return;
  const a = audioEls[sc.id];
  a.currentTime = 0;
  a.play().catch(()=>{});
  currentAudio = a;
}

// ===============================================================
const canvas = document.getElementById('canvas');
const controls = document.getElementById('controls');
const voBar = document.getElementById('vo-bar');

function scale() {
  const vw = window.innerWidth;
  const ctrlH = controls.offsetHeight + (voVisible ? 60 : 0) + 2;
  const vh = window.innerHeight - ctrlH - 8;
  const s = Math.min(vw/720, vh/1280, 1);
  canvas.style.transform = `scale(${s})`;
  canvas.style.marginBottom = `${-(1280*(1-s))}px`;
  const W = Math.min(720, Math.round(720*s));
  controls.style.width = W+'px';
  voBar.style.width = W+'px';
}
window.addEventListener('resize', scale);

// ===============================================================
// BUILD THUMBNAILS + MARKERS
// ===============================================================
const strip = document.getElementById('thumb-strip');
const markerContainer = document.getElementById('scene-markers');
const THUMB_COLORS = ['#DEDAD2','#EEEAE2','#E4E0D8','#E8E4DC','#0D0D0D','#EEF0F5','#F0EDE8','#F6F8FC','#F6F8FC','#0D0D0D','#0D0D0D'];

SCENES.forEach((sc,i) => {
  // thumb
  const t = document.createElement('div');
  t.className = 'thumb'+(i===0?' on':'');
  t.style.background = THUMB_COLORS[i];
  t.innerHTML = `<div style="width:100%;height:calc(100% - 16px);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:${i>=4&&i!==5&&i!==6&&i!==7?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.3)'};letter-spacing:0.06em;">${sc.label.split('--')[0].trim()}</div><div class="thumb-lbl">${sc.label.replace('S','').split('--')[0].trim()}</div>`;
  t.addEventListener('click',()=>jumpTo(i));
  strip.appendChild(t);
  // marker
  if(i>0){
    const m = document.createElement('div');
    m.className='s-mark';
    m.style.left=`${(START_TIMES[i]/TOTAL)*100}%`;
    markerContainer.appendChild(m);
  }
});

// ===============================================================
// RENDER
// ===============================================================
function sceneIndexAt(t) {
  let si=0;
  for(let i=SCENES.length-1;i>=0;i--){ if(t>=START_TIMES[i]){si=i;break;} }
  return si;
}

function setWordState(id, state) {
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.remove('future','active','past');
  el.classList.add(state);
}

function setPhraseState(id, state, isLegend, isEvent) {
  const el = document.getElementById(id);
  if(!el) return;
  if(isLegend) {
    if(state==='active'||state==='past') el.classList.add('vis');
    else el.classList.remove('vis');
    return;
  }
  if(isEvent) {
    el.classList.toggle('ev-hi', state==='active');
    return;
  }
  el.classList.remove('future','active','past');
  el.classList.add(state);
}

function render() {
  const si = sceneIndexAt(elapsed);
  const sc = SCENES[si];
  const scElapsed = elapsed - START_TIMES[si];

  // Scene visibility
  document.querySelectorAll('.scene').forEach((el,i)=>{
    el.classList.toggle('active', i===si);
  });

  // Type A -- words
  if(sc.type==='A' && sc.words.length) {
    sc.words.forEach(w=>{
      if(scElapsed < w.start)     setWordState(w.id,'future');
      else if(scElapsed <= w.end) setWordState(w.id,'active');
      else                        setWordState(w.id,'past');
    });
  }

  // Type B -- phrases
  if(sc.type==='B' && sc.phrases) {
    sc.phrases.forEach(p=>{
      if(scElapsed < p.start)     setPhraseState(p.id,'future',p.isLegend,p.isEvent);
      else if(scElapsed <= p.end) setPhraseState(p.id,'active',p.isLegend,p.isEvent);
      else                        setPhraseState(p.id,'past',p.isLegend,p.isEvent);
    });
  }

  // Type C -- card + phrases (supports isLegend and isEvent)
  if(sc.type==='C') {
    const card = document.getElementById(sc.card);
    if(card) {
      if(scElapsed >= sc.cardIn && scElapsed < sc.cardOut) {
        card.classList.remove('nc-out'); card.classList.add('nc-in');
      } else if(scElapsed >= sc.cardOut) {
        card.classList.remove('nc-in'); card.classList.add('nc-out');
      } else {
        card.classList.remove('nc-in','nc-out');
      }
    }
    if(sc.phrases) sc.phrases.forEach(p=>{
      if(scElapsed < p.start)     setPhraseState(p.id,'future',p.isLegend,p.isEvent);
      else if(scElapsed <= p.end) setPhraseState(p.id,'active',p.isLegend,p.isEvent);
      else                        setPhraseState(p.id,'past',p.isLegend,p.isEvent);
    });
  }

  // S4 zoom — zoom into desperation text, hold at max for last 0.5s
  if(sc.id === 's4') {
    const zw = document.querySelector('.s4-zoom-wrap');
    if(zw) {
      const zoomStart = 2750;
      const zoomEnd = sc.duration - 500; // reach max 500ms before end, then hold
      if(scElapsed > zoomStart) {
        const p = Math.min((scElapsed - zoomStart) / (zoomEnd - zoomStart), 1);
        const eased = p * p; // ease-in: builds tension
        zw.style.transform = 'scale(' + (1 + eased * 1.28) + ') translateY(' + (eased * -256) + 'px)';
      } else {
        zw.style.transform = 'scale(1)';
      }
    }
  }

  // S6 custom animations -- counter, scan line, big text, results
  if(sc.id === 's6') renderS6(scElapsed);

  // S8 custom animations -- meetings pop in gradually
  if(sc.id === 's8') renderS8(scElapsed);

  // S9 custom animations -- gradual event appearance
  if(sc.id === 's9') renderS9(scElapsed);

  // S10 custom animation -- counting up to 30
  if(sc.id === 's10') renderS10(scElapsed);

  // Progress
  const pct = (elapsed/TOTAL)*100;
  document.getElementById('progress-fill').style.width = pct+'%';

  // Time
  const fmt = ms => { const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
  document.getElementById('time-disp').textContent = `${fmt(elapsed)} / ${fmt(TOTAL)}`;

  // Scene info
  document.getElementById('scene-lbl').textContent = sc.label;
  document.getElementById('scene-ctr').textContent = `${si+1} / ${SCENES.length}`;

  // Thumbs
  document.querySelectorAll('.thumb').forEach((t,i)=>t.classList.toggle('on',i===si));

  // VO bar
  if(voVisible) {
    const vt = document.getElementById('vo-text');
    vt.textContent = sc.vo || '-- (title card)';
  }
}

// ===============================================================
// ANIMATION LOOP
// ===============================================================
let lastSceneIndex = -1;

function tick(ts) {
  if(!playing) return;
  if(lastTs!==null) elapsed = Math.min(elapsed + (ts-lastTs)*speed, TOTAL);
  lastTs = ts;

  const si = sceneIndexAt(elapsed);
  // Scene just changed -- start its audio
  if(si !== lastSceneIndex) {
    // Seamless (no-fade) transition from s8 to s9
    const s8El = document.getElementById('s8');
    const s9El = document.getElementById('s9');
    if(lastSceneIndex === 7 && si === 8 && s8El && s9El) {
      s8El.classList.add('no-fade');
      s9El.classList.add('no-fade');
      // Make s9 narrator card appear instantly (no slide-up animation)
      const s9Card = document.getElementById('s9-card');
      if(s9Card) {
        s9Card.style.transition = 'none';
        s9Card.classList.add('nc-in');
      }
      // Reset swipe state instantly so calendars don't "un-swipe" on re-entry
      const oldCal = document.getElementById('s9-old');
      const newCal = document.getElementById('s9-new');
      if(oldCal) { oldCal.style.transition = 'none'; oldCal.classList.remove('s9-swiped'); }
      if(newCal) { newCal.style.transition = 'none'; newCal.classList.remove('s9-swiped'); }
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        s8El.classList.remove('no-fade');
        s9El.classList.remove('no-fade');
        if(s9Card) s9Card.style.transition = '';
        if(oldCal) oldCal.style.transition = '';
        if(newCal) newCal.style.transition = '';
      }));
    }
    lastSceneIndex = si;
    playSceneAudio(SCENES[si]);
  }

  updateMusicVolume();
  render();
  if(elapsed>=TOTAL){ stop(); return; }
  rafId = requestAnimationFrame(tick);
}

function play() {
  if(elapsed>=TOTAL) elapsed=0;
  playing=true;
  document.getElementById('btn-play').innerHTML='&#9646;&#9646;';
  lastTs=null;
  const si = sceneIndexAt(elapsed);
  playSceneAudio(SCENES[si]);
  updateMusicVolume();
  musicEl.play().catch(()=>{});
  rafId=requestAnimationFrame(tick);
}
function stop() {
  playing=false;
  document.getElementById('btn-play').innerHTML='&#9654;';
  lastTs=null; lastSceneIndex=-1;
  if(rafId) cancelAnimationFrame(rafId);
  stopAllAudio();
  musicEl.pause();
  musicEl.currentTime=0;
}
function jumpTo(i) {
  const wasPlaying = playing;
  stopAllAudio();
  lastSceneIndex = i;
  elapsed=START_TIMES[i];
  render();
  if(wasPlaying) playSceneAudio(SCENES[i]);
}

// ===============================================================
// CONTROLS
// ===============================================================
document.getElementById('btn-play').addEventListener('click',()=>playing?stop():play());
document.getElementById('btn-prev').addEventListener('click',()=>jumpTo(Math.max(0,sceneIndexAt(elapsed)-1)));
document.getElementById('btn-next').addEventListener('click',()=>jumpTo(Math.min(SCENES.length-1,sceneIndexAt(elapsed)+1)));

document.getElementById('spd-1x').addEventListener('click',()=>setSpeed(1));
document.getElementById('spd-75').addEventListener('click',()=>setSpeed(0.75));
document.getElementById('spd-125').addEventListener('click',()=>setSpeed(1.25));
document.getElementById('vo-toggle').addEventListener('click',toggleVO);

// Click progress bar to seek
document.getElementById('progress-track').addEventListener('click',e=>{
  const r=e.currentTarget.getBoundingClientRect();
  elapsed=((e.clientX-r.left)/r.width)*TOTAL;
  render();
});

document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT') return;
  if(e.code==='Space'){e.preventDefault();playing?stop():play();}
  if(e.code==='ArrowRight'){const si=sceneIndexAt(elapsed);jumpTo(Math.min(SCENES.length-1,si+1));}
  if(e.code==='ArrowLeft'){const si=sceneIndexAt(elapsed);jumpTo(Math.max(0,si-1));}
});

function setSpeed(s) {
  speed=s;
  document.querySelectorAll('.spd-btn').forEach(b=>b.classList.remove('on'));
  const map={1:'spd-1x',0.75:'spd-75',1.25:'spd-125'};
  if(map[s]) document.getElementById(map[s]).classList.add('on');
}

function toggleVO() {
  voVisible = !voVisible;
  const btn = document.getElementById('vo-toggle');
  const bar = document.getElementById('vo-bar');
  if(voVisible) {
    btn.textContent='VO ON'; btn.classList.add('on');
    bar.classList.add('open');
  } else {
    btn.textContent='VO OFF'; btn.classList.remove('on');
    bar.classList.remove('open');
  }
  setTimeout(scale, 350);
  render();
}

// ===============================================================
// S6 -- SCANNING ANIMATION
// ===============================================================
function renderS6(t) {
  // Timeline:
  //   0-4600      Phase 1: LinkedIn window visible, gentle scan starts
  //   4600-8400   Phase 2: Active scanning, big text "Looking for strategic intros", counter runs 0->350
  //   8400-12360  Phase 3: Big text "Evaluating who will respond to Jake", counter 350->500, results appear

  const counterEl   = document.getElementById('s6-counter');
  const progressEl  = document.getElementById('s6-progress-fill');
  const scanLine    = document.getElementById('s6-scan-line');
  const bigtext0    = document.getElementById('s6-bigtext0');
  const bigtext1    = document.getElementById('s6-bigtext1');
  const filteredEl  = document.getElementById('s6-filtered');
  const statusBadge = document.getElementById('s6-status-badge');
  const scanStatus  = document.getElementById('s6-scan-status');

  if(!counterEl) return;

  // --- Counter ---
  let count = 0;
  if(t < 4600) {
    // Phase 1: no counting yet
    count = 0;
  } else if(t < 8400) {
    // Phase 2: 0 -> 350
    const p = (t - 4600) / (8400 - 4600);
    count = Math.round(350 * easeOutQuad(p));
  } else if(t < 12360) {
    // Phase 3: 350 -> 500
    const p = (t - 8400) / (12360 - 8400);
    count = 350 + Math.round(150 * easeOutQuad(p));
  } else {
    count = 500;
  }
  counterEl.textContent = count;
  progressEl.style.width = (count / 500 * 100) + '%';

  // --- Scan line ---
  if(t >= 4600 && t < 12000) {
    scanLine.classList.add('active');
    // Oscillate scan line position through the connection rows
    const cycle = ((t - 4600) % 2000) / 2000;
    const rowCount = 8;
    const rowH = 44; // approximate row height
    const topOffset = 36; // header height
    const pos = topOffset + (cycle * rowCount * rowH);
    scanLine.style.top = pos + 'px';
  } else {
    scanLine.classList.remove('active');
  }

  // --- Connection row highlights ---
  const connRows = document.querySelectorAll('.s6-conn-row');
  connRows.forEach(row => {
    const idx = parseInt(row.dataset.idx);
    // Each row "scans" based on counter progress
    const scanThreshold = (idx + 1) * 60; // spread across 0-480
    if(count >= scanThreshold + 30) {
      row.classList.add('scanned');
      row.classList.remove('scanning');
    } else if(count >= scanThreshold) {
      row.classList.add('scanning');
      row.classList.remove('scanned');
    } else {
      row.classList.remove('scanned','scanning');
    }
  });

  // --- Big text overlays ---
  if(t >= 4600 && t < 8200) {
    bigtext0.classList.add('visible');
    bigtext0.classList.remove('exit');
  } else if(t >= 8200 && t < 8600) {
    bigtext0.classList.remove('visible');
    bigtext0.classList.add('exit');
  } else {
    bigtext0.classList.remove('visible','exit');
  }

  if(t >= 8600 && t < 11300) {
    bigtext1.classList.add('visible');
    bigtext1.classList.remove('exit');
  } else if(t >= 11300 && t < 11800) {
    bigtext1.classList.remove('visible');
    bigtext1.classList.add('exit');
  } else {
    bigtext1.classList.remove('visible','exit');
  }

  // --- Result rows ---
  const res0 = document.getElementById('s6-res0');
  const res1 = document.getElementById('s6-res1');
  const res2 = document.getElementById('s6-res2');
  if(res0) res0.classList.toggle('visible', t >= 9200);
  if(res1) res1.classList.toggle('visible', t >= 10200);
  if(res2) res2.classList.toggle('visible', t >= 11200);

  // --- Filtered note ---
  if(filteredEl) filteredEl.style.opacity = t >= 11800 ? '1' : '0';

  // --- Status badge ---
  if(count >= 500) {
    statusBadge.textContent = 'COMPLETE';
    statusBadge.style.background = '#48BB78';
    statusBadge.style.animation = 'none';
    if(scanStatus) scanStatus.innerHTML = '&#9679; Done';
  } else if(count > 0) {
    statusBadge.textContent = 'SCANNING';
    statusBadge.style.background = '#D4A574';
    statusBadge.style.animation = '';
    if(scanStatus) scanStatus.innerHTML = '&#9679; Scanning...';
  } else {
    statusBadge.textContent = 'READY';
    statusBadge.style.background = '#A0AEC0';
    statusBadge.style.animation = 'none';
    if(scanStatus) scanStatus.innerHTML = '&#9679; Ready';
  }
}

// ===============================================================
// S8 -- MEETING POP-IN ANIMATION
// ===============================================================
function renderS8(t) {
  // Each "my network" meeting generates 2 new meetings
  // They pop in staggered across the scene duration
  const GEN_TIMINGS = [
    1000,  // s8-gen-0: Ron B. via David
    1600,  // s8-gen-1: Sarah K. via David
    2200,  // s8-gen-2: Enterprise via Maya
    2800,  // s8-gen-3: Lena R. via Maya
    3400,  // s8-gen-4: Guy M. via Tom
    4000,  // s8-gen-5: Nir S. via Tom
    4600,  // s8-gen-6: Sascha M. via Jake
    5400,  // s8-gen-7: * Sequoia Partner (top tier)
  ];

  let introCount = 0;
  let topCount = 0;

  for(let i = 0; i < GEN_TIMINGS.length; i++) {
    const el = document.getElementById('s8-gen-' + i);
    if(!el) continue;
    const vis = t >= GEN_TIMINGS[i];
    el.classList.toggle('s8-visible', vis);
    if(vis) {
      introCount++;
      if(el.classList.contains('gold-ev')) topCount++;
    }
  }

  // Update stats bar counters
  const introEl = document.getElementById('s8-stat-intro');
  const topEl = document.getElementById('s8-stat-top');
  if(introEl) introEl.textContent = introCount;
  if(topEl) topEl.textContent = topCount;
}

// ===============================================================
// S9 -- WEEK SWIPE + RAPID EVENT FILL
// ===============================================================
function renderS9(t) {
  const oldCal = document.getElementById('s9-old');
  const newCal = document.getElementById('s9-new');

  // Swipe at 800ms: old week out left, new week in from right
  const swiped = t >= 800;
  if(oldCal) oldCal.classList.toggle('s9-swiped', swiped);
  if(newCal) newCal.classList.toggle('s9-swiped', swiped);

  // Rapid event appearance on new calendar
  const evs = document.querySelectorAll('#s9-new .s9-ev-anim');
  let count = 0;
  evs.forEach(ev => {
    const delay = parseInt(ev.dataset.appear) || 0;
    const visible = t >= delay;
    ev.classList.toggle('s9-ev-in', visible);
    if(visible) count++;
  });

  // Update counter
  const counterEl = document.getElementById('s9-count');
  if(counterEl) counterEl.textContent = count;
}

// ===============================================================
// S10 -- COUNTER ANIMATION (0 → 30)
// ===============================================================
function renderS10(t) {
  const counterEl = document.getElementById('s10w7');
  if(!counterEl) return;

  // Counter starts immediately and reaches 30 to sync with VO "thirty"
  const countStart = 0;
  const countEnd   = 1700;

  let progress = 0;
  if(t < countStart) {
    counterEl.textContent = '0';
  } else if(t < countEnd) {
    progress = (t - countStart) / (countEnd - countStart);
    const count = Math.round(30 * easeOutQuad(progress));
    counterEl.textContent = count;
  } else {
    counterEl.textContent = '30';
    progress = 1;
  }

  // Pill-chain labels fade in gradually as counter counts up
  const chainEl = document.getElementById('s10-chain');
  if(chainEl) chainEl.style.opacity = easeOutQuad(progress);
}

function easeOutQuad(t) { return t * (2 - t); }

// INIT
scale();
render();
