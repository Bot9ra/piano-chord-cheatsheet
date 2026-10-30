"use strict";

/* ---------- Данные ---------- */
const NAMES = {
  en: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
  ru: ["До", "До#", "Ре", "Ре#", "Ми", "Фа", "Фа#", "Соль", "Соль#", "Ля", "Ля#", "Си"]
};

// iv — интервалы в полутонах от основной ноты
const TYPES = {
  maj:  { g: "triad", label: "Мажорное",     suf: "",      iv: [0, 4, 7],      info: "Светлое, устойчивое звучание: большая терция + малая терция." },
  min:  { g: "triad", label: "Минорное",     suf: "m",     iv: [0, 3, 7],      info: "Грустное, мягкое звучание: малая терция + большая терция." },
  dim:  { g: "triad", label: "Уменьшённое",  suf: "dim",   iv: [0, 3, 6],      info: "Напряжённое, тревожное звучание: две малые терции." },
  aug:  { g: "triad", label: "Увеличенное",  suf: "aug",   iv: [0, 4, 8],      info: "Неустойчивое, «парящее» звучание: две большие терции." },
  sus2: { g: "triad", label: "Sus2",         suf: "sus2",  iv: [0, 2, 7],      info: "Открытое звучание: вместо терции вторая ступень." },
  sus4: { g: "triad", label: "Sus4",         suf: "sus4",  iv: [0, 5, 7],      info: "Ждёт разрешения: вместо терции четвёртая ступень." },
  dom7: { g: "sev",   label: "Доминантсептаккорд (7)",        suf: "7",     iv: [0, 4, 7, 10], info: "Мажорное трезвучие + малая септима. Неустойчивый, тянется к разрешению в тонику." },
  maj7: { g: "sev",   label: "Большой мажорный (maj7)",       suf: "maj7",  iv: [0, 4, 7, 11], info: "Мажорное трезвучие + большая септима. Нежное, «джазовое» звучание." },
  min7: { g: "sev",   label: "Малый минорный (m7)",           suf: "m7",    iv: [0, 3, 7, 10], info: "Минорное трезвучие + малая септима. Спокойное, задумчивое звучание." },
  mmaj7:{ g: "sev",   label: "Минорный с большой септимой",   suf: "m(maj7)", iv: [0, 3, 7, 11], info: "Минорное трезвучие + большая септима. Загадочное, «киношное» звучание." },
  m7b5: { g: "sev",   label: "Малый уменьшённый (m7♭5)",      suf: "m7♭5",  iv: [0, 3, 6, 10], info: "Уменьшённое трезвучие + малая септима (полууменьшённый). Часто встречается в джазе." },
  dim7: { g: "sev",   label: "Уменьшённый (dim7)",            suf: "dim7",  iv: [0, 3, 6, 9],  info: "Уменьшённое трезвучие + уменьшённая септима. Очень напряжённый, все терции малые." }
};

const INV_TRIAD = ["Основной вид", "Секстаккорд (1-е обр.)", "Квартсекстаккорд (2-е обр.)"];
const INV_SEV = ["Основной вид", "Квинтсекстаккорд (1-е обр.)", "Терцквартаккорд (2-е обр.)", "Секундаккорд (3-е обр.)"];

const KEYS = 37;                    // 3 октавы + верхняя До: C3..C6
const BASE_MIDI = 48;               // C3
const SHIFT = 12;                   // аккорд строится от C4..B4, чтобы влезли обращения
const BLACK = new Set([1, 3, 6, 8, 10]);

/* ---------- Состояние ---------- */
const state = { root: 0, type: "maj", inv: 0, lang: "en" };
const $ = (id) => document.getElementById(id);
const noteName = (n) => NAMES[state.lang][n % 12];

function chordSemitones(root, type, inv) {
  const arr = TYPES[type].iv.map((x) => root + SHIFT + x);
  for (let k = 0; k < inv; k++) arr.push(arr.shift() + 12);
  return arr;
}
const chordTitle = (root, type) => noteName(root) + TYPES[type].suf;

/* ---------- Звук: сэмплы настоящего рояля ---------- */
const SAMPLE_URL = "https://tonejs.github.io/audio/salamander/";
const SF = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];
let ctx, master;
const buffers = {};           // midi -> AudioBuffer
let samplesReady = false;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  return ctx;
}

async function loadSamples() {
  const st = $("status");
  st.textContent = "Загружаю звук рояля…";
  const ac = getCtx();
  const jobs = [];
  for (let m = BASE_MIDI; m <= BASE_MIDI + KEYS + 2; m += 3) {
    const name = SF[m % 12] + (Math.floor(m / 12) - 1);
    jobs.push(
      fetch(SAMPLE_URL + name + ".mp3")
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((d) => ac.decodeAudioData(d))
        .then((b) => { buffers[m] = b; })
        .catch(() => {})
    );
  }
  await Promise.all(jobs);
  samplesReady = Object.keys(buffers).length > 5;
  st.textContent = samplesReady
    ? "Звук рояля загружен."
    : "Не удалось загрузить рояль (нужен интернет), играет упрощённый звук.";
}

function playSample(midi, t, dur, vol) {
  const base = BASE_MIDI + Math.round((midi - BASE_MIDI) / 3) * 3;
  const buf = buffers[base];
  if (!buf) return false;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = Math.pow(2, (midi - base) / 12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.setValueAtTime(vol, t + dur);
  g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
  src.connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.7);
  return true;
}

// запасной вариант без интернета: приглушённый «фортепианный» тембр из гармоник
function playFallback(midi, t, dur, vol) {
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(Math.min(f * 8, 6000), t);
  lp.frequency.exponentialRampToValueAtTime(f * 2, t + 1.5);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol * 0.5, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur + 1.2);
  lp.connect(g).connect(master);
  [1, 2, 3, 4, 5].forEach((h, i) => {
    const o = ctx.createOscillator();
    const hg = ctx.createGain();
    o.type = "sine";
    o.frequency.value = f * h * (1 + 0.0004 * h * h);
    hg.gain.value = 1 / (h * h * 0.8 + i);
    o.connect(hg).connect(lp);
    o.start(t);
    o.stop(t + dur + 1.3);
  });
}

function playNote(semi, start = 0, dur = 1.6, vol = 0.75) {
  const ac = getCtx();
  if (ac.state === "suspended") ac.resume();
  const t = ac.currentTime + start;
  const midi = BASE_MIDI + semi;
  if (!(samplesReady && playSample(midi, t, dur, vol))) playFallback(midi, t, dur, vol);
}

/* ---------- Отрисовка ---------- */
function buildChips(container, items, isOn, onPick) {
  container.innerHTML = "";
  items.forEach(({ text, value }) => {
    const b = document.createElement("button");
    b.className = "chip" + (isOn(value) ? " on" : "");
    b.textContent = text;
    b.onclick = () => onPick(value);
    container.appendChild(b);
  });
}

function renderControls() {
  buildChips($("roots"),
    NAMES[state.lang].map((n, i) => ({ text: n, value: i })),
    (v) => v === state.root, (v) => { state.root = v; update(); });

  const pickType = (v) => { state.type = v; state.inv = 0; update(); };
  ["triad", "sev"].forEach((g) => {
    buildChips($(g === "triad" ? "typesTriad" : "typesSeventh"),
      Object.entries(TYPES).filter(([, t]) => t.g === g).map(([k, t]) => ({ text: t.label, value: k })),
      (v) => v === state.type, pickType);
  });

  const names = TYPES[state.type].g === "triad" ? INV_TRIAD : INV_SEV;
  buildChips($("invs"),
    names.map((t, i) => ({ text: t, value: i })),
    (v) => v === state.inv, (v) => { state.inv = v; update(); });

  $("langEn").classList.toggle("on", state.lang === "en");
  $("langRu").classList.toggle("on", state.lang === "ru");
}

function renderKeyboard(active) {
  const kb = $("keyboard");
  kb.innerHTML = "";
  let whites = 0;
  for (let i = 0; i < KEYS; i++) if (!BLACK.has(i % 12)) whites++;
  const w = 100 / whites;                       // ширина белой клавиши, %
  const inner = "(100% - 12px)";
  let wi = 0;
  for (let i = 0; i < KEYS; i++) {
    const el = document.createElement("div");
    const isBlack = BLACK.has(i % 12);
    el.className = "key " + (isBlack ? "b" : "w");
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", noteName(i));
    const on = active.includes(i);
    if (on) { el.classList.add("on"); el.textContent = noteName(i); }
    if (on && i % 12 === (state.root) % 12 && i === active.find((x) => x % 12 === state.root)) el.classList.add("root");
    if (isBlack) {
      el.style.width = `calc(${inner} * ${(w * 0.6) / 100})`;
      el.style.left = `calc(6px + ${inner} * ${(wi * w) / 100} - ${inner} * ${(w * 0.3) / 100})`;
    } else wi++;
    el.onclick = () => playNote(i);
    el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); playNote(i); } };
    kb.appendChild(el);
  }
  // на узких экранах прокручиваем к аккорду
  const first = kb.querySelector(".key.on");
  if (first) kb.parentElement.scrollLeft = Math.max(0, first.offsetLeft - 60);
}

function renderAll() {
  $("allTitle").textContent = `Все аккорды от ноты ${noteName(state.root)}`;
  const box = $("all");
  box.innerHTML = "";
  [["triad", "Трезвучия"], ["sev", "Септаккорды"]].forEach(([g, title]) => {
    const h = document.createElement("h4");
    h.textContent = title;
    box.appendChild(h);
    Object.entries(TYPES).filter(([, t]) => t.g === g).forEach(([k, t]) => {
      const notes = t.iv.map((x) => noteName(state.root + x)).join(" – ");
      const b = document.createElement("button");
      if (k === state.type) b.className = "on";
      b.innerHTML = `<b>${chordTitle(state.root, k)}</b><span>${t.label}: ${notes}</span>`;
      b.onclick = () => { state.type = k; state.inv = 0; update(); };
      box.appendChild(b);
    });
  });
}

function update() {
  const semis = chordSemitones(state.root, state.type, state.inv);
  const t = TYPES[state.type];
  const invNames = t.g === "triad" ? INV_TRIAD : INV_SEV;
  $("chordName").textContent = chordTitle(state.root, state.type);
  $("chordNotes").textContent = semis.map(noteName).join(" – ");
  const steps = t.iv.slice(1).map((x, i) => x - t.iv[i]).join(" + ");
  $("chordInfo").textContent = `${t.label}. ${t.info} Шаги в полутонах: ${steps}. ${state.inv ? "Сейчас: " + invNames[state.inv] + "." : ""}`;
  renderControls();
  renderKeyboard(semis);
  renderAll();
}

/* ---------- События ---------- */
const cur = () => chordSemitones(state.root, state.type, state.inv);
$("playChord").onclick = () => cur().forEach((s) => playNote(s, 0, 2, 0.55));
$("playArp").onclick = () => cur().forEach((s, i) => playNote(s, i * 0.4, 1.4, 0.7));
$("langEn").onclick = () => { state.lang = "en"; update(); };
$("langRu").onclick = () => { state.lang = "ru"; update(); };

update();
loadSamples();
