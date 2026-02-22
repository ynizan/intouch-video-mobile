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
  const s = Math.min(vw/1280, vh/720, 1);
  canvas.style.transform = `scale(${s})`;
  canvas.style.marginBottom = `${-(720*(1-s))}px`;
  const W = Math.min(1280, Math.round(1280*s));
  controls.style.width = W+'px';
  voBar.style.width = W+'px';
  const ml = Math.max(0, (vw-1280*s)/2);
  canvas.style.marginLeft = ml+'px';
  controls.style.marginLeft = ml+'px';
  voBar.style.marginLeft = ml+'px';
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

  // S4 zoom — zoom into desperation text midway through
  if(sc.id === 's4') {
    const zw = document.querySelector('.s4-zoom-wrap');
    if(zw) {
      const zoomStart = 3250;
      if(scElapsed > zoomStart) {
        const p = Math.min((scElapsed - zoomStart) / (sc.duration - zoomStart), 1);
        const eased = p * p; // ease-in: builds tension
        zw.style.transform = 'scale(' + (1 + eased * 2.2) + ')';
      } else {
        zw.style.transform = 'scale(1)';
      }
    }
  }

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

// INIT
scale();
render();
