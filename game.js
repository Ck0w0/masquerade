"use strict";

// The Masquerade: a pass-and-play imposter word game.
// Everyone gets a mask and the secret word, except the Imposter.

const PERSONAS = [
  { name: "The Crimson Fox", color: "#d0484a" },
  { name: "The Gilded Raven", color: "#d4a865" },
  { name: "The Ivory Swan", color: "#efe2c8" },
  { name: "The Velvet Wolf", color: "#a070c0" },
  { name: "The Silver Moth", color: "#b8bec8" },
  { name: "The Scarlet Jester", color: "#e6607a" },
  { name: "The Midnight Owl", color: "#7a8ee0" },
  { name: "The Rose Countess", color: "#e892a6" },
  { name: "The Ember Stag", color: "#e2844a" },
  { name: "The Pale Duke", color: "#a8d0c4" },
  { name: "The Onyx Cat", color: "#9a9aa6" },
  { name: "The Emerald Viper", color: "#5cba80" },
];

const MIN_GUESTS = 3;
const MAX_GUESTS = 12;
const POINTS_GUEST_WIN = 1;
const POINTS_IMPOSTER_WIN = 2;

const $app = document.getElementById("app");
const $modal = document.getElementById("modal");

// localStorage can throw (private mode, blocked storage); the game works without it.
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem("masquerade." + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem("masquerade." + key, JSON.stringify(value));
    } catch {}
  },
};

const settings = Object.assign(
  { imposterSeesCategory: true, imposterNeverFirst: true, timer: 120, categories: Object.keys(WORDS) },
  store.get("settings", {})
);
settings.categories = settings.categories.filter((c) => c in WORDS);

let guests = store.get("guests", []); // [{ name, score }]
let imposterCount = store.get("imposters", 1);
let screen = "menu";
let round = null;
let lastWord = null;
let setupMessage = "";
const timer = { left: 0, running: false, handle: null };

// ---------------------------------------------------------------- helpers

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const rand = (n) => Math.floor(Math.random() * n);
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const maxImposters = () => Math.max(1, Math.floor((guests.length - 1) / 2));
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function saveGuests() {
  store.set("guests", guests);
  store.set("imposters", imposterCount);
}

let svgId = 0;
function maskSVG({ left = "#7a1729", right = "#f0e0c0", feathers = true, cls = "" } = {}) {
  const id = "mask" + svgId++;
  const shape =
    "M120 40 C100 20 40 10 14 30 C4 40 10 70 30 88 C50 106 90 104 108 86 C114 80 117 76 120 76 " +
    "C123 76 126 80 132 86 C150 104 190 106 210 88 C230 70 236 40 226 30 C200 10 140 20 120 40 Z";
  const feather = (rot, fill) =>
    `<path transform="translate(196 88) rotate(${rot})" fill="${fill}" stroke="#2a0a12" stroke-width="1"
       d="M0 0 C6 -24 18 -52 40 -74 C38 -46 26 -20 0 0 Z M3 -4 L36 -68" />`;
  return `<svg class="${cls}" viewBox="0 0 260 170" aria-hidden="true">
    <defs>
      <clipPath id="${id}-l"><rect x="0" y="0" width="120" height="170" /></clipPath>
      <linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f6d79c" /><stop offset="1" stop-color="#a87a3c" />
      </linearGradient>
    </defs>
    ${feathers ? feather(-26, "#5a1020") + feather(-8, "#7a1729") + feather(10, "#4a0c18") : ""}
    <g transform="translate(10 40)">
      <path d="${shape}" fill="${right}" />
      <path d="${shape}" fill="${left}" clip-path="url(#${id}-l)" />
      <path d="M40 40 C60 50 80 70 100 66 M150 70 C170 74 196 56 210 44" stroke="url(#${id}-g)" stroke-width="1.2" fill="none" opacity=".6" />
      <ellipse cx="70" cy="58" rx="27" ry="15" transform="rotate(10 70 58)" fill="#140a0c" stroke="url(#${id}-g)" stroke-width="3" />
      <ellipse cx="170" cy="58" rx="27" ry="15" transform="rotate(-10 170 58)" fill="#140a0c" stroke="url(#${id}-g)" stroke-width="3" />
      <path d="${shape}" fill="none" stroke="url(#${id}-g)" stroke-width="4" />
      <path d="M120 8 L132 26 L120 44 L108 26 Z" fill="#7a1729" stroke="url(#${id}-g)" stroke-width="3" />
      ${feathers ? `<path d="M214 64 L218 96" stroke="url(#${id}-g)" stroke-width="2" /><path d="M213 96 h10 l-2 22 h-6 Z" fill="url(#${id}-g)" />` : ""}
    </g>
  </svg>`;
}

// ---------------------------------------------------------------- screens

const screens = {
  menu() {
    return `
      <section class="screen">
        ${maskSVG({ cls: "mask-art" })}
        <h1>
          <span class="title-the" style="display:block">The</span>
          <span class="title-main" style="display:block">Masquerade</span>
        </h1>
        <div class="divider">&#10022;</div>
        <p class="tagline">EVERYONE HIDES A SECRET</p>
        <div class="menu-buttons">
          <button class="btn primary" data-action="play"><span>PLAY</span></button>
          <button class="btn" style="width:94%" data-action="rules"><span>HOW TO PLAY</span></button>
          <button class="btn" style="width:94%" data-action="settings"><span>SETTINGS</span></button>
        </div>
      </section>`;
  },

  setup() {
    const n = guests.length;
    const chips = guests
      .map(
        (g, i) => `
        <li class="guest-chip">${esc(g.name)}${g.score ? `<span class="score">${g.score}</span>` : ""}
          <button class="chip-x" data-action="remove-guest" data-i="${i}" aria-label="Remove ${esc(g.name)}">&times;</button>
        </li>`
      )
      .join("");
    const hint = setupMessage || (n < MIN_GUESTS ? `Add at least ${plural(MIN_GUESTS - n, "more guest")}.` : `${n} guests of ${MAX_GUESTS}.`);
    const hasScores = guests.some((g) => g.score);
    return `
      <div class="topbar"><button class="link" data-action="menu">&larr; MENU</button></div>
      <section class="screen">
        <p class="kicker">The Guest List</p>
        <h2>Who attends tonight?</h2>
        <div class="panel">
          <form class="add-row" data-form="add-guest">
            <input class="input" name="name" maxlength="16" placeholder="Guest name" autocomplete="off" ${n >= MAX_GUESTS ? "disabled" : ""}>
            <button class="square-btn" type="submit" ${n >= MAX_GUESTS ? "disabled" : ""}>ADD</button>
          </form>
          <ul class="guest-list">${chips}</ul>
          <p class="hint">${esc(hint)}</p>
        </div>
        <div class="panel row-between">
          <div>
            <span class="field-label">IMPOSTERS</span>
            <span class="muted">Hidden among the guests</span>
          </div>
          <div class="stepper">
            <button class="square-btn" data-action="imposters" data-d="-1" ${imposterCount <= 1 ? "disabled" : ""} aria-label="Fewer imposters">&minus;</button>
            <output>${imposterCount}</output>
            <button class="square-btn" data-action="imposters" data-d="1" ${imposterCount >= maxImposters() ? "disabled" : ""} aria-label="More imposters">+</button>
          </div>
        </div>
        <div class="btn-row">
          <button class="btn primary small" data-action="start" ${n < MIN_GUESTS ? "disabled" : ""}><span>BEGIN THE BALL</span></button>
        </div>
        ${hasScores ? `<button class="link" style="margin-top:18px" data-action="reset-scores">RESET SCORES</button>` : ""}
      </section>`;
  },

  pass() {
    const g = round.guests[round.revealIdx];
    const dots = round.guests.map((_, i) => `<i class="${i < round.revealIdx || (i === round.revealIdx && round.revealed) ? "done" : ""}"></i>`).join("");
    const top = `<div class="topbar"><button class="link" data-action="end-round">END ROUND</button></div>`;

    if (!round.revealed) {
      return `${top}
        <section class="screen">
          <p class="kicker">Pass the device to</p>
          <h2 class="pass-name">${esc(g.name)}</h2>
          <p class="lead muted">Make sure no one else can see the screen.</p>
          <div class="cover">${maskSVG({ left: "#2a1117", right: "#3a1a20", feathers: false })}</div>
          <div class="btn-row"><button class="btn primary small" data-action="reveal"><span>UNVEIL MY MASK</span></button></div>
          <div class="progress-dots">${dots}</div>
        </section>`;
    }

    const last = round.revealIdx === round.guests.length - 1;
    const inner = g.isImposter
      ? `<p class="muted" style="margin:0">You are</p>
         <div class="secret-word imposter">The Imposter</div>
         <p style="margin:6px 0 0">${settings.imposterSeesCategory ? `The category is <b style="color:var(--gold)">${esc(round.category)}</b>.` : "No hints. Trust your ears."}</p>
         <p class="hint">Blend in, listen closely, and bluff your clue.${imposterCount > 1 ? ` There ${imposterCount === 2 ? "is 1 other imposter" : `are ${imposterCount - 1} other imposters`} among you.` : ""}</p>`
      : `<p class="muted" style="margin:0">Your secret word</p>
         <div class="secret-word">${esc(round.word)}</div>
         <p style="margin:6px 0 0">Category: <b style="color:var(--gold)">${esc(round.category)}</b></p>
         <p class="hint">Hint at it, but not so plainly that the Imposter learns it.</p>`;
    return `${top}
      <section class="screen">
        <p class="kicker">Only you may look</p>
        <h2 class="pass-name">${esc(g.name)}</h2>
        <div class="mask-card ${g.isImposter ? "imposter" : ""}">
          <div class="persona" style="color:${g.persona.color}">${esc(g.persona.name)}</div>
          <div class="divider" style="margin:12px auto">&#10022;</div>
          ${inner}
        </div>
        <div class="btn-row"><button class="btn primary small" data-action="next-reveal"><span>${last ? "ALL ARE MASKED" : "HIDE &amp; PASS ON"}</span></button></div>
        <div class="progress-dots">${dots}</div>
      </section>`;
  },

  whispers() {
    const items = round.order
      .map((i) => {
        const g = round.guests[i];
        return `<li>${esc(g.name)}<span class="persona-small" style="color:${g.persona.color}">${esc(g.persona.name)}</span></li>`;
      })
      .join("");
    const starter = round.guests[round.order[0]];
    const timerBlock = settings.timer
      ? `<div id="timer" class="timer">${fmtTime(timer.left)}</div>
         <div class="timer-controls">
           <button class="square-btn" data-action="timer-toggle">${timer.running ? "PAUSE" : "RESUME"}</button>
           <button class="square-btn" data-action="timer-add">+30s</button>
         </div>`
      : "";
    return `
      <div class="topbar"><button class="link" data-action="end-round">END ROUND</button></div>
      <section class="screen">
        <p class="kicker">The Whispers</p>
        <h2>${esc(starter.name)} begins</h2>
        <p class="lead">In this order, each guest says <em>one word</em> hinting at the secret. Go around as many times as you like, then debate who seems lost.</p>
        <div class="panel"><ol class="order-list">${items}</ol></div>
        ${timerBlock}
        <div class="btn-row"><button class="btn primary small" data-action="to-vote"><span>CALL THE ACCUSATION</span></button></div>
      </section>`;
  },

  vote() {
    const cards = round.guests
      .map(
        (g, i) => `
        <button class="suspect ${round.accused === i ? "selected" : ""}" data-action="accuse" data-i="${i}">
          ${maskSVG({ left: g.persona.color, right: "#efe2c8", feathers: false })}
          <span class="name">${esc(g.name)}</span>
          <span class="persona" style="color:${g.persona.color}">${esc(g.persona.name)}</span>
        </button>`
      )
      .join("");
    const sel = round.accused != null ? round.guests[round.accused] : null;
    return `
      <div class="topbar"><button class="link" data-action="back-whispers">&larr; WHISPERS</button><button class="link" data-action="end-round">END ROUND</button></div>
      <section class="screen" style="max-width:720px">
        <p class="kicker">The Accusation</p>
        <h2>Who wears the false face?</h2>
        <p class="lead muted">Decide together, then choose one guest to unmask.</p>
        <div class="suspects">${cards}</div>
        <div class="btn-row" style="max-width:460px">
          <button class="btn primary small" data-action="unmask" ${sel ? "" : "disabled"}><span>${sel ? "UNMASK " + esc(sel.name.toUpperCase()) : "CHOOSE A GUEST"}</span></button>
        </div>
      </section>`;
  },

  caught() {
    const g = round.guests[round.accused];
    return `
      <section class="screen">
        <p class="kicker">The mask falls</p>
        ${maskSVG({ cls: "mask-art", left: "#7a1729", right: "#efe2c8" })}
        <h2><span class="crimson">${esc(g.name)}</span> is an Imposter!</h2>
        <p class="lead">One last gambit: <b>${esc(g.name)}</b> may guess the secret word aloud. If they name it, the Imposters still win.</p>
        <p class="hint">Guests, judge the guess. The word is revealed on the next screen.</p>
        <div class="btn-row">
          <button class="btn primary small" data-action="guess" data-correct="0"><span>WRONG GUESS</span></button>
          <button class="btn" data-action="guess" data-correct="1"><span>CORRECT GUESS</span></button>
        </div>
      </section>`;
  },

  results() {
    const r = round.result;
    const guestsWon = r.winner === "guests";
    const rows = round.guests
      .map((g) => {
        const gained = g.isImposter !== guestsWon ? (guestsWon ? POINTS_GUEST_WIN : POINTS_IMPOSTER_WIN) : 0;
        const total = guests.find((x) => x.name === g.name)?.score ?? 0;
        return `<li>
          <span>${esc(g.name)}<br><span class="persona" style="font-size:10px;color:${g.persona.color}">${esc(g.persona.name)}</span></span>
          <span style="display:flex;align-items:center;gap:10px">
            <span class="tag ${g.isImposter ? "imp" : ""}">${g.isImposter ? "IMPOSTER" : "GUEST"}</span>
            <span class="pts">${gained ? "+" + gained : ""} <span class="muted">${total}</span></span>
          </span>
        </li>`;
      })
      .join("");
    return `
      <section class="screen">
        <p class="kicker">${guestsWon ? "The guests prevail" : "The Imposter prevails"}</p>
        <h2${guestsWon ? "" : ' class="crimson"'}>${esc(r.headline)}</h2>
        <p class="lead muted">${esc(r.detail)}</p>
        <div class="mask-card" style="padding:22px">
          <p class="muted" style="margin:0">The secret word was</p>
          <div class="secret-word">${esc(round.word)}</div>
          <p style="margin:0" class="muted">${esc(round.category)}</p>
        </div>
        <div class="panel"><ul class="reveal-list">${rows}</ul></div>
        <div class="btn-row">
          <button class="btn primary small" data-action="start"><span>ANOTHER DANCE</span></button>
          <button class="btn" data-action="play"><span>GUEST LIST</span></button>
        </div>
        <button class="link" style="margin-top:18px" data-action="menu">MAIN MENU</button>
      </section>`;
  },
};

function render() {
  $app.innerHTML = screens[screen]();
}

function go(next) {
  if (next !== "whispers") stopTimer();
  screen = next;
  render();
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- round flow

function pickWord() {
  const cats = settings.categories.length ? settings.categories : Object.keys(WORDS);
  let category, word;
  for (let tries = 0; tries < 10; tries++) {
    category = cats[rand(cats.length)];
    const list = WORDS[category];
    word = list[rand(list.length)];
    if (word !== lastWord) break;
  }
  lastWord = word;
  return { category, word };
}

function startRound() {
  if (guests.length < MIN_GUESTS) return go("setup");
  imposterCount = Math.min(imposterCount, maxImposters());

  const { category, word } = pickWord();
  const personas = shuffle([...PERSONAS]);
  const imposterIdx = new Set(shuffle(guests.map((_, i) => i)).slice(0, imposterCount));
  const roundGuests = guests.map((g, i) => ({
    name: g.name,
    persona: personas[i % personas.length],
    isImposter: imposterIdx.has(i),
  }));

  // Clue order: start from a random guest and go around; optionally never start with an imposter.
  let start = rand(roundGuests.length);
  if (settings.imposterNeverFirst && roundGuests[start].isImposter) {
    const honest = roundGuests.map((g, i) => (g.isImposter ? -1 : i)).filter((i) => i >= 0);
    start = honest[rand(honest.length)];
  }
  const order = roundGuests.map((_, k) => (start + k) % roundGuests.length);

  round = { category, word, guests: roundGuests, order, revealIdx: 0, revealed: false, accused: null, result: null };
  go("pass");
}

function finishRound(winner, headline, detail) {
  round.result = { winner, headline, detail };
  for (const g of round.guests) {
    const entry = guests.find((x) => x.name === g.name);
    if (!entry) continue;
    if (winner === "guests" && !g.isImposter) entry.score = (entry.score || 0) + POINTS_GUEST_WIN;
    if (winner === "imposter" && g.isImposter) entry.score = (entry.score || 0) + POINTS_IMPOSTER_WIN;
  }
  saveGuests();
  go("results");
}

function imposterNames() {
  return round.guests.filter((g) => g.isImposter).map((g) => g.name).join(" & ");
}

// ---------------------------------------------------------------- timer

function startTimer() {
  stopTimer();
  if (!settings.timer) return;
  timer.left = settings.timer;
  timer.running = true;
  timer.handle = setInterval(tick, 1000);
}

function stopTimer() {
  clearInterval(timer.handle);
  timer.handle = null;
  timer.running = false;
}

function tick() {
  if (!timer.running) return;
  timer.left = Math.max(0, timer.left - 1);
  if (timer.left === 0) timer.running = false;
  paintTimer();
}

function paintTimer() {
  const el = document.getElementById("timer");
  if (!el) return;
  el.textContent = timer.left === 0 ? "Time!" : fmtTime(timer.left);
  el.classList.toggle("low", timer.left <= 10);
  const btn = document.querySelector('[data-action="timer-toggle"]');
  if (btn) btn.textContent = timer.running ? "PAUSE" : "RESUME";
}

// ---------------------------------------------------------------- modals

function openModal(html) {
  $modal.innerHTML = `<div class="panel" role="dialog" aria-modal="true">${html}</div>`;
  $modal.hidden = false;
}

function closeModal() {
  $modal.hidden = true;
  $modal.innerHTML = "";
}

function showRules() {
  openModal(`
    <p class="kicker" style="text-align:center">Everyone hides a secret</p>
    <h2>How to Play</h2>
    <div class="divider">&#10022;</div>
    <ol>
      <li><b>Gather your guests.</b> Three or more players, one device.</li>
      <li><b>The Unveiling.</b> Pass the device around. Each guest privately sees their mask and the <b>secret word</b>, except the <b>Imposter</b>, who only learns the category.</li>
      <li><b>The Whispers.</b> In turn, each guest says one word that hints at the secret word. Too obvious, and the Imposter will catch on. Too vague, and you'll look suspicious.</li>
      <li><b>The Accusation.</b> Debate, then choose one guest to unmask.</li>
      <li><b>The Last Gambit.</b> An unmasked Imposter may guess the word. If they're right, they still win.</li>
    </ol>
    <p class="hint">Guests earn ${POINTS_GUEST_WIN} point for catching the Imposter. Imposters earn ${POINTS_IMPOSTER_WIN} for getting away with it.</p>
    <div class="btn-row"><button class="btn" data-action="close-modal"><span>CLOSE</span></button></div>`);
}

function showSettings() {
  const toggle = (key, title, sub) => `
    <div class="setting">
      <div>${title}<small>${sub}</small></div>
      <button class="toggle" role="switch" aria-checked="${settings[key]}" data-action="toggle-setting" data-key="${key}" aria-label="${title}"></button>
    </div>`;
  const timerOptions = [0, 60, 120, 180, 300]
    .map((s) => `<option value="${s}" ${settings.timer === s ? "selected" : ""}>${s ? fmtTime(s) : "Off"}</option>`)
    .join("");
  const cats = Object.keys(WORDS)
    .map((c) => `<button class="chip" aria-pressed="${settings.categories.includes(c)}" data-action="toggle-category" data-cat="${esc(c)}">${esc(c)}</button>`)
    .join("");
  openModal(`
    <h2>Settings</h2>
    <div class="divider">&#10022;</div>
    ${toggle("imposterSeesCategory", "Imposter sees the category", "A small hint to help them bluff")}
    ${toggle("imposterNeverFirst", "Imposter never speaks first", "Gives them one clue to listen to")}
    <div class="setting">
      <div>Whispers timer<small>Time for clues and debate</small></div>
      <select class="select" data-setting="timer">${timerOptions}</select>
    </div>
    <span class="field-label" style="margin-top:14px">CATEGORIES</span>
    <div class="chips">${cats}</div>
    <div class="btn-row"><button class="btn" data-action="close-modal"><span>DONE</span></button></div>`);
}

function saveSettings() {
  store.set("settings", settings);
}

// ---------------------------------------------------------------- actions

const actions = {
  menu: () => go("menu"),
  play: () => {
    setupMessage = "";
    go("setup");
  },
  rules: showRules,
  settings: showSettings,
  "close-modal": closeModal,

  "remove-guest": ({ i }) => {
    guests.splice(Number(i), 1);
    imposterCount = Math.min(imposterCount, maxImposters());
    setupMessage = "";
    saveGuests();
    render();
  },
  imposters: ({ d }) => {
    imposterCount = Math.min(maxImposters(), Math.max(1, imposterCount + Number(d)));
    saveGuests();
    render();
  },
  "reset-scores": () => {
    guests.forEach((g) => (g.score = 0));
    saveGuests();
    render();
  },
  start: startRound,

  reveal: () => {
    round.revealed = true;
    render();
  },
  "next-reveal": () => {
    if (round.revealIdx < round.guests.length - 1) {
      round.revealIdx++;
      round.revealed = false;
      render();
    } else {
      go("whispers");
      startTimer();
      paintTimer();
    }
  },
  "end-round": () => {
    if (confirm("End this round? No points will be awarded.")) go("setup");
  },

  "timer-toggle": () => {
    if (timer.left === 0) timer.left = 30;
    timer.running = !timer.running;
    if (!timer.handle) timer.handle = setInterval(tick, 1000);
    paintTimer();
  },
  "timer-add": () => {
    timer.left += 30;
    paintTimer();
  },
  "to-vote": () => go("vote"),
  "back-whispers": () => {
    screen = "whispers";
    render();
    paintTimer();
  },

  accuse: ({ i }) => {
    round.accused = Number(i);
    render();
  },
  unmask: () => {
    const g = round.guests[round.accused];
    if (!g) return;
    if (g.isImposter) return go("caught");
    finishRound("imposter", `${g.name} was innocent!`, `The Imposter${imposterCount > 1 ? "s were" : " was"} ${imposterNames()}, dancing on unseen.`);
  },
  guess: ({ correct }) => {
    const g = round.guests[round.accused];
    if (correct === "1") {
      finishRound("imposter", "Unmasked, yet victorious", `${g.name} was caught but named the secret word.`);
    } else {
      finishRound("guests", `${g.name} is unmasked!`, imposterCount > 1 ? `The Imposters were ${imposterNames()}.` : "The guests saw through the disguise.");
    }
  },

  "toggle-setting": ({ key }, el) => {
    settings[key] = !settings[key];
    el.setAttribute("aria-checked", settings[key]);
    saveSettings();
  },
  "toggle-category": ({ cat }, el) => {
    const on = settings.categories.includes(cat);
    if (on && settings.categories.length === 1) return; // keep at least one
    settings.categories = on ? settings.categories.filter((c) => c !== cat) : [...settings.categories, cat];
    el.setAttribute("aria-pressed", !on);
    saveSettings();
  },
};

document.addEventListener("click", (e) => {
  if (e.target === $modal) return closeModal();
  const el = e.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el.dataset, el);
});

document.addEventListener("change", (e) => {
  if (e.target.matches('[data-setting="timer"]')) {
    settings.timer = Number(e.target.value);
    saveSettings();
  }
});

document.addEventListener("submit", (e) => {
  if (!e.target.matches('[data-form="add-guest"]')) return;
  e.preventDefault();
  const input = e.target.elements.name;
  const name = input.value.trim().replace(/\s+/g, " ");
  if (!name) return;
  if (guests.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
    setupMessage = `${name} is already on the list.`;
  } else if (guests.length < MAX_GUESTS) {
    guests.push({ name, score: 0 });
    setupMessage = "";
    saveGuests();
  }
  render();
  $app.querySelector('[data-form="add-guest"] input')?.focus();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$modal.hidden) closeModal();
});

render();
