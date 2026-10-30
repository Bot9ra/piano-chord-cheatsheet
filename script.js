"use strict";

/* ---------- Данные ---------- */
const NAMES = {
  en: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
  ru: ["До", "До#", "Ре", "Ре#", "Ми", "Фа", "Фа#", "Соль", "Соль#", "Ля", "Ля#", "Си"]
};

// iv — интервалы в полутонах от основной ноты
const TYPES = {
  maj:  { label: "Мажор",       suf: "",     iv: [0, 4, 7],     info: "Светлое, устойчивое звучание. Большая терция + малая терция." },
  min:  { label: "Минор",       suf: "m",    iv: [0, 3, 7],     info: "Грустное, мягкое звучание. Малая терция + большая терция." },
  dim:  { label: "Уменьшённый", suf: "dim",  iv: [0, 3, 6],     info: "Напряжённое, тревожное звучание. Две малые терции." },
  aug:  { label: "Увеличенный", suf: "aug",  iv: [0, 4, 8],     info: "Неустойчивое, «парящее» звучание. Две большие терции." },
  sus2: { label: "Sus2",        suf: "sus2", iv: [0, 2, 7],     info: "Открытое звучание без терции: вместо неё вторая ступень." },
  sus4: { label: "Sus4",        suf: "sus4", iv: [0, 5, 7],     info: "Ждёт разрешения: вместо терции четвёртая ступень." },
  dom7: { label: "Септаккорд 7", suf: "7",   iv: [0, 4, 7, 10], info: "Доминантсептаккорд: мажорное трезвучие + малая септима. Тянется к разрешению." },
  maj7: { label: "Maj7",        suf: "maj7", iv: [0, 4, 7, 11], info: "Мажорное трезвучие + большая септима. Нежное, «джазовое» звучание." },
  min7: { label: "m7",          suf: "m7",   iv: [0, 3, 7, 10], info: "Минорное трезвучие + малая септима. Спокойное, задумчивое звучание." }
};

const KEYS = 25;                    // 2 октавы + верхняя До (полутоны 0..24)
const BLACK = new Set([1, 3, 6, 8, 10]);

/* ---------- Состояние ---------- */
const state = { root: 0, type: "maj", inv: 0, lang: "en" };
const $ = (id) => document.getElementById(id);

/* ---------- Музыкальная логика ---------- */
const noteName = (n) => NAMES[state.lang][n % 12];

function chordSemitones(root, type, inv) {
  const arr = TYPES[type].iv.map((x) => root + x);
  for (let k = 0; k < inv; k++) arr.push(arr.shift() + 12);
  return arr;
}

const chordTitle = (root, type) => noteName(root) + TYPES[type].suf;

/* ---------- Звук (Web Audio API) ---------- */
let ctx;
function playNote(semi, start = 0, dur = 1.2) {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = 261.63 * Math.pow(2, semi / 12);   // 261.63 Гц — До первой октавы
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/* ---------- Отрисовка ---------- */
function buildChips(container, items, isOn, onPick) {
  container.innerHTML = "";
  items.forEach(({ text, value, disabled }) => {
    const b = document.createElement("button");
    b.className = "chip" + (isOn(value) ? " on" : "");
    b.textContent = text;
    b.disabled = !!disabled;
    b.onclick = () => onPick(value);
    container.appendChild(b);
  });
}

function renderControls() {
  buildChips($("roots"),
    NAMES[state.lang].map((n, i) => ({ text: n, value: i })),
    (v) => v === state.root, (v) => { state.root = v; update(); });

  buildChips($("types"),
    Object.entries(TYPES).map(([k, t]) => ({ text: t.label, value: k })),
    (v) => v === state.type, (v) => { state.type = v; state.inv = 0; update(); });

  const n = TYPES[state.type].iv.length;
  const invNames = ["Основной вид", "1-е обращение", "2-е обращение", "3-е обращение"];
  buildChips($("invs"),
    invNames.slice(0, n).map((t, i) => ({ text: t, value: i })),
    (v) => v === state.inv, (v) => { state.inv = v; update(); });

  $("langEn").classList.toggle("on", state.lang === "en");
  $("langRu").classList.toggle("on", state.lang === "ru");
}

function renderKeyboard(active) {
  const kb = $("keyboard");
  kb.innerHTML = "";
  const whites = [...Array(KEYS).keys()].filter((i) => !BLACK.has(i % 12)).length;
  const w = 100 / whites;
  let wi = 0;
  for (let i = 0; i < KEYS; i++) {
    const el = document.createElement("div");
    const isBlack = BLACK.has(i % 12);
    el.className = "key " + (isBlack ? "b" : "w");
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", noteName(i));
    if (active.includes(i)) el.classList.add("on");
    if (i === active[0] && state.inv === 0) el.classList.add("root");
    if (active.includes(i)) el.textContent = noteName(i);
    if (isBlack) {
      // чёрная клавиша стоит на границе между предыдущей и следующей белой
      el.style.left = `calc(6px + (100% - 12px) * ${(wi * w) / 100} - 2.6%)`;
    } else wi++;
    el.onclick = () => playNote(i);
    el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); playNote(i); } };
    kb.appendChild(el);
  }
}

function renderAll() {
  $("allTitle").textContent = `Все аккорды от ноты ${noteName(state.root)}`;
  const box = $("all");
  box.innerHTML = "";
  Object.entries(TYPES).forEach(([k, t]) => {
    const notes = t.iv.map((x) => noteName(state.root + x)).join(" – ");
    const b = document.createElement("button");
    if (k === state.type) b.className = "on";
    b.innerHTML = `<b>${chordTitle(state.root, k)}</b><span>${notes}</span>`;
    b.onclick = () => { state.type = k; state.inv = 0; update(); };
    box.appendChild(b);
  });
}

function update() {
  const semis = chordSemitones(state.root, state.type, state.inv);
  const t = TYPES[state.type];
  const invNote = state.inv ? ` (${state.inv}-е обращение)` : "";
  $("chordName").textContent = chordTitle(state.root, state.type) + invNote;
  $("chordNotes").textContent = semis.map(noteName).join(" – ");
  const steps = t.iv.slice(1).map((x, i) => x - t.iv[i]).join(" + ");
  $("chordInfo").textContent = `${t.info} Шаги в полутонах: ${steps}.`;
  renderControls();
  renderKeyboard(semis);
  renderAll();
}

/* ---------- События ---------- */
$("playChord").onclick = () => chordSemitones(state.root, state.type, state.inv).forEach((s) => playNote(s, 0, 1.6));
$("playArp").onclick = () => chordSemitones(state.root, state.type, state.inv).forEach((s, i) => playNote(s, i * 0.4, 1));
$("langEn").onclick = () => { state.lang = "en"; update(); };
$("langRu").onclick = () => { state.lang = "ru"; update(); };

update();
