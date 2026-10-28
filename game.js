"use strict";

// The Masquerade: an online imposter word game.
// One phone hosts a room (peer-to-peer via PeerJS) and friends join with a 4-letter code.
// The host's browser runs the game and sends each guest only their own secret.
// Messages carry word positions and text keys, never English text, so each phone
// shows the game in its own language (see i18n.js).

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 12;
const POINTS_GUEST_WIN = 1;
const POINTS_IMPOSTER_WIN = 2;
const REVEAL_TIME = 30; // seconds before clues start, unless everyone is ready sooner
const VOTE_TIME = 60;
const GUESS_TIME = 30;
const MAX_CLUE_LENGTH = 24;
const RECONNECT_GRACE = 20; // seconds a dropped guest has to return before the round reacts
const ROOM_PREFIX = "the-masquerade-room-";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

const $app = document.getElementById("app");
const $modal = document.getElementById("modal");
const $toast = document.getElementById("toast");

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

// ---------------------------------------------------------------- helpers

const esc = escHTML;
const rand = (n) => Math.floor(Math.random() * n);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const maxImposters = (n) => Math.max(1, Math.floor((n - 1) / 2));
const randomToken = () => Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 8)).join("");
const cleanName = (s) => String(s ?? "").trim().replace(/\s+/g, " ").slice(0, 16);
const validMask = (m) => Number.isInteger(m) && m >= 0 && m < MASKS.length;

const settings = Object.assign(
  {
    lang: "en",
    imposterSeesCategory: true,
    imposterNeverFirst: true,
    clueRounds: 2,
    clueTime: 30,
    discussTime: 90,
    categories: Object.keys(WORDS),
  },
  store.get("settings", {})
);
settings.categories = settings.categories.filter((c) => c in WORDS);
applyLang(settings.lang);

const profile = Object.assign({ name: "", mask: rand(MASKS.length), token: randomToken() }, store.get("profile", {}));
if (!validMask(profile.mask)) profile.mask = 0;
const saveProfile = () => store.set("profile", profile);
saveProfile();

// ---------------------------------------------------------------- client state

let view = "menu"; // menu | profile | connecting | game
let net = null; // { isHost, peer, code, conn, retries, closing }
let S = null; // latest public state from the host
let myRole = null; // { isImposter, cat, idx, imposterCount }
let myVote = null;
let endsAt = null;
let notice = "";
let connecting = null; // { key, vars } for the connecting screen
let reconnecting = false;
let pendingCode = (new URLSearchParams(location.search).get("room") || "").toUpperCase().slice(0, 4);
const myId = profile.token;

const me = () => S?.players.find((p) => p.id === myId);
const playerById = (id) => S?.players.find((p) => p.id === id);
const amHost = () => !!net?.isHost;
const maskImg = (i, cls = "") => maskArt(i, cls);
const clueText = (c) => (c == null ? t("silence") : esc(c));
const gold = (s) => ({ html: `<b class="gold">${esc(s)}</b>` });

function toast(text) {
  $toast.textContent = text;
  $toast.classList.add("show");
  clearTimeout(toast.handle);
  toast.handle = setTimeout(() => $toast.classList.remove("show"), 2800);
}

// t() returns HTML; toasts and notices are plain text.
const plain = (html) => {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.textContent;
};

// ---------------------------------------------------------------- shared UI pieces

function leaveBar() {
  return `<div class="topbar"><button class="link" data-action="leave">${t("leave")}</button>
    <span class="link" style="pointer-events:none">${t("room", { code: { html: `<span dir="ltr">${esc(S.code)}</span>` } })}</span></div>`;
}

function roleBadge() {
  if (!myRole || !me()?.inRound) return `<div class="role-badge">${t("spectating")}</div>`;
  if (myRole.isImposter) {
    return `<div class="role-badge imp">${t("badgeImp")}${myRole.cat ? ` &middot; ${esc(catName(myRole.cat))}` : ""}</div>`;
  }
  return `<div class="role-badge">${t("badgeWord", { word: { html: `<b>${esc(wordText(myRole.cat, myRole.idx))}</b>` } })} &middot; ${esc(catName(myRole.cat))}</div>`;
}

function clueBoard() {
  const rows = S.order
    .map((id) => {
      const p = playerById(id);
      if (!p) return "";
      const clues = p.clues.length
        ? p.clues.map(clueText).join(' <span class="sep">&#10022;</span> ')
        : '<span class="muted">&hellip;</span>';
      return `<div class="clue-row ${S.turn?.id === id ? "active" : ""} ${p.connected ? "" : "away"}">
        ${maskImg(p.mask)}
        <div><div class="clue-name">${esc(p.name)}${p.id === myId ? ` <span class="muted">${t("you")}</span>` : ""}</div>
        <div class="clue-words">${clues}</div></div>
      </div>`;
    })
    .join("");
  return `<div class="panel clue-board">${rows}</div>`;
}

function timerEl() {
  return `<div class="timer" data-timer></div>`;
}

function maskPicker(taken = new Set()) {
  return `<div class="mask-picker">${MASKS.map(
    (_, i) => `<button class="mask-opt ${i === profile.mask ? "selected" : ""}" data-action="pick-mask" data-i="${i}"
        ${taken.has(i) ? "disabled" : ""} title="${esc(maskName(i))}" aria-label="${esc(maskName(i))}">${maskImg(i)}</button>`
  ).join("")}</div>`;
}

// iPhones can't be prompted to install, so tell Safari users how to add the app themselves.
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isInstalled = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
const showInstallHint = () => isIOS && !isInstalled && !store.get("installHintHidden", false);

function installHint() {
  const shareIcon = `<svg class="share-icon" viewBox="0 0 24 24" aria-label="Share"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  return `
    <div class="install-hint">
      <button class="chip-x" data-action="hide-install" aria-label="${t("close")}">&times;</button>
      <b>${t("installTitle")}</b>
      <span>${t("installBody", { share: { html: shareIcon } })}</span>
    </div>`;
}

function resultLines(r) {
  const name = playerById(r.accusedId)?.name ?? "";
  const names = r.imposterIds.map((id) => playerById(id)?.name ?? "?").join(t("and"));
  switch (r.reason) {
    case "noAgree": return [t("r_noAgree_h"), t("r_noAgree_d")];
    case "innocent": return [t("r_innocent_h", { name }), t(r.imposterIds.length > 1 ? "r_innocent_d2" : "r_innocent_d", { names })];
    case "named": return [t("r_named_h", { name }), t("r_named_d")];
    case "missed": return [t("r_missed_h", { name }), t("r_missed_d")];
    case "timeout": return [t("r_missed_h", { name }), t("r_timeout_d")];
    case "fled": return [t("r_fled_h"), t("r_fled_d")];
    case "fledGuess": return [t("r_fled_h"), t("r_fledGuess_d")];
    default: return ["", ""];
  }
}

// ---------------------------------------------------------------- screens

const screens = {
  menu() {
    return `
      <section class="screen">
        ${maskImg(0, "mask-art")}
        <h1>
          <span class="title-the" style="display:block">${t("the")}</span>
          <span class="title-main" style="display:block">${t("masquerade")}</span>
        </h1>
        <div class="divider">&#10022;</div>
        <p class="tagline">${t("tagline")}</p>
        <div class="menu-buttons">
          <button class="btn primary" data-action="play"><span>${t("play")}</span></button>
          <button class="btn" style="width:94%" data-action="rules"><span>${t("howTo")}</span></button>
          <button class="btn" style="width:94%" data-action="settings"><span>${t("settings")}</span></button>
        </div>
        ${showInstallHint() ? installHint() : ""}
      </section>`;
  },

  profile() {
    const join = `
      <div class="panel">
        <span class="field-label">${t("joinFriend")}</span>
        <form class="add-row" data-form="join">
          <input class="input code-input" name="code" maxlength="4" placeholder="${t("codePh")}" autocomplete="off"
                 autocapitalize="characters" spellcheck="false" dir="ltr" value="${esc(pendingCode)}" data-keep="code">
          <button class="square-btn" type="submit">${t("join")}</button>
        </form>
      </div>`;
    const host = `
      <div class="btn-row">
        <button class="btn ${pendingCode ? "" : "primary small"}" data-action="host"><span>${t("hostBall")}</span></button>
      </div>`;
    return `
      <div class="topbar"><button class="link" data-action="menu">${t("backMenu")}</button></div>
      <section class="screen">
        <p class="kicker">${t("yourDisguise")}</p>
        ${maskImg(profile.mask, "hero-mask")}
        <p class="mask-name">${esc(maskName(profile.mask))}</p>
        <div class="panel">
          <label class="field-label" for="name-input">${t("yourName")}</label>
          <input id="name-input" class="input" maxlength="16" placeholder="${t("namePh")}" autocomplete="off"
                 value="${esc(profile.name)}" data-keep="name">
          <span class="field-label" style="margin-top:18px">${t("chooseMask")}</span>
          ${maskPicker()}
        </div>
        ${notice ? `<p class="notice">${esc(notice)}</p>` : ""}
        ${pendingCode ? join + host : host + join}
      </section>`;
  },

  connecting() {
    return `
      <section class="screen">
        <div class="spinner"></div>
        <p class="lead">${t(connecting.key, connecting.vars)}</p>
        <button class="link" style="margin-top:24px" data-action="cancel-connect">${t("cancel")}</button>
      </section>`;
  },

  g_lobby() {
    const n = S.players.length;
    const cards = S.players
      .map((p) => {
        const tags = [p.id === S.hostId && t("hostTag"), p.id === myId && t("youTag"), p.score && t("pts", { n: p.score })].filter(Boolean);
        return `
        <div class="guest-card ${p.connected ? "" : "away"}">
          ${maskImg(p.mask)}
          <span class="name">${esc(p.name)}</span>
          <small>${tags.join(" &middot; ")}</small>
        </div>`;
      })
      .join("");
    const hostControls = `
      <div class="panel row-between">
        <div><span class="field-label">${t("imposters")}</span><span class="muted">${t("impostersSub")}</span></div>
        <div class="stepper" dir="ltr">
          <button class="square-btn" data-action="imposters" data-d="-1" ${S.imposters <= 1 ? "disabled" : ""} aria-label="-">&minus;</button>
          <output>${S.imposters}</output>
          <button class="square-btn" data-action="imposters" data-d="1" ${S.imposters >= maxImposters(n) ? "disabled" : ""} aria-label="+">+</button>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn primary small" data-action="start" ${n < MIN_PLAYERS ? "disabled" : ""}>
          <span>${n < MIN_PLAYERS ? t("needMore", { n: MIN_PLAYERS - n }) : t("begin")}</span></button>
      </div>
      <button class="link" style="margin-top:16px" data-action="settings">${t("gameSettings")}</button>`;
    return `${leaveBar()}
      <section class="screen">
        <p class="kicker">${t("ballroom")}</p>
        <div class="room-code" dir="ltr">${esc(S.code)}</div>
        <button class="square-btn" style="margin-top:12px" data-action="invite">${t("invite")}</button>
        ${S.message ? `<p class="notice">${t(S.message)}</p>` : ""}
        <div class="panel">
          <span class="field-label">${t("guestsCount", { n, max: MAX_PLAYERS })}</span>
          <div class="guest-grid">${cards}</div>
          <button class="link" style="margin-top:14px" data-action="change-mask">${t("changeMask")}</button>
        </div>
        ${amHost() ? hostControls : `<p class="lead muted">${t("waitingHost")}</p>`}
      </section>`;
  },

  g_reveal() {
    const p = me();
    const inRound = S.players.filter((x) => x.inRound);
    const readyCount = inRound.filter((x) => x.ready).length;
    if (!p?.inRound || !myRole) {
      return `${leaveBar()}<section class="screen"><p class="kicker">${t("underway")}</p>
        <h2>${t("nextRound")}</h2><p class="lead muted">${t("watch")}</p></section>`;
    }
    const inner = myRole.isImposter
      ? `<p class="muted" style="margin:0">${t("youAre")}</p>
         <div class="secret-word imposter">${t("theImposter")}</div>
         <p style="margin:6px 0 0">${myRole.cat ? t("catIs", { cat: gold(catName(myRole.cat)) }) : t("noHints")}</p>
         <p class="hint">${t("blendIn")}${myRole.imposterCount > 1 ? " " + t("manyImposters", { n: myRole.imposterCount }) : ""}</p>`
      : `<p class="muted" style="margin:0">${t("secretWord")}</p>
         <div class="secret-word">${esc(wordText(myRole.cat, myRole.idx))}</div>
         <p style="margin:6px 0 0">${t("category", { cat: gold(catName(myRole.cat)) })}</p>
         <p class="hint">${t("hintAt")}</p>`;
    return `${leaveBar()}
      <section class="screen">
        <p class="kicker">${t("unveiling")}</p>
        <div class="mask-card ${myRole.isImposter ? "imposter" : ""}">
          ${maskImg(p.mask, "card-mask")}
          <div class="persona">${esc(p.name)}</div>
          <div class="divider" style="margin:12px auto">&#10022;</div>
          ${inner}
        </div>
        <div class="btn-row">
          <button class="btn primary small" data-action="ready" ${p.ready ? "disabled" : ""}><span>${p.ready ? t("ready") : t("imReady")}</span></button>
        </div>
        <p class="hint">${t("readyCount", { n: readyCount, total: inRound.length, timer: { html: '<span data-timer dir="ltr"></span>' } })}</p>
      </section>`;
  },

  g_clues() {
    const turn = playerById(S.turn?.id);
    const myTurn = S.turn?.id === myId;
    const form = `
      <form class="add-row clue-form" data-form="clue">
        <input class="input" name="text" maxlength="${MAX_CLUE_LENGTH}" placeholder="${t("oneWordPh")}" autocomplete="off" data-keep="clue" autofocus>
        <button class="square-btn" type="submit">${t("whisper")}</button>
      </form>
      <p class="hint">${myRole?.isImposter ? t("bluffHint") : t("crewHint")}</p>`;
    return `${leaveBar()}
      <section class="screen">
        <p class="kicker">${t("whispersRound", { r: S.turn?.round ?? 1, of: S.clueRounds })}</p>
        <h2>${myTurn ? t("yourTurn") : t("isWhispering", { name: turn?.name ?? "" })}</h2>
        ${timerEl()}
        ${roleBadge()}
        ${myTurn ? form : ""}
        ${clueBoard()}
      </section>`;
  },

  g_discuss() {
    return `${leaveBar()}
      <section class="screen">
        <p class="kicker">${t("debate")}</p>
        <h2>${t("whoLost")}</h2>
        <p class="lead muted">${t("talk")}</p>
        ${S.endsIn != null ? timerEl() : ""}
        ${roleBadge()}
        ${clueBoard()}
        ${amHost()
          ? `<div class="btn-row"><button class="btn primary small" data-action="to-vote"><span>${t("callVote")}</span></button></div>`
          : `<p class="hint">${t("hostCalls")}</p>`}
      </section>`;
  },

  g_vote() {
    const p = me();
    const voters = S.players.filter((x) => x.inRound && x.connected);
    const votedCount = voters.filter((x) => x.voted).length;
    const canVote = p?.inRound;
    const cards = S.order
      .map(playerById)
      .filter((x) => x && x.id !== myId)
      .map(
        (x) => `
        <button class="suspect ${myVote === x.id ? "selected" : ""}" data-action="vote" data-id="${esc(x.id)}" ${canVote && x.connected ? "" : "disabled"}>
          ${maskImg(x.mask)}
          <span class="name">${esc(x.name)}</span>
          <span class="clue-words">${x.clues.map(clueText).join(" &middot; ") || "&hellip;"}</span>
        </button>`
      )
      .join("");
    return `${leaveBar()}
      <section class="screen" style="max-width:720px">
        <p class="kicker">${t("accusation")}</p>
        <h2>${t("falseFace")}</h2>
        ${timerEl()}
        <p class="lead muted">${canVote ? (myVote ? t("voteCast") : t("tapAccuse")) : t("guestsVoting")}</p>
        ${roleBadge()}
        <div class="suspects">${cards}</div>
        <p class="hint">${t("votedCount", { n: votedCount, total: voters.length })}</p>
      </section>`;
  },

  g_guess() {
    const accused = playerById(S.accusedId);
    const mine = S.accusedId === myId;
    return `${leaveBar()}
      <section class="screen">
        <p class="kicker">${t("maskFalls")}</p>
        ${maskImg(accused?.mask ?? 0, "hero-mask")}
        <h2>${mine ? t("youUnmasked") : t("isImposter", { name: { html: `<span class="crimson">${esc(accused?.name ?? "")}</span>` } })}</h2>
        ${timerEl()}
        ${mine
          ? `<p class="lead">${t("lastGambit")}</p>
             <form class="add-row clue-form" data-form="guess">
               <input class="input" name="text" maxlength="40" placeholder="${t("guessPh")}" autocomplete="off" data-keep="guess" autofocus>
               <button class="square-btn" type="submit">${t("guessBtn")}</button>
             </form>`
          : `<p class="lead muted">${t("theyGuess")}</p>`}
      </section>`;
  },

  g_results() {
    const r = S.results;
    const guestsWon = r.winner === "guests";
    const inRound = S.order.map(playerById).filter(Boolean);
    const [headline, detail] = resultLines(r);
    let myWin = null;
    if (me()?.inRound && myRole && r.winner) myWin = (r.winner === "imposter") === myRole.isImposter;
    const rows = inRound
      .map((p) => {
        const imp = r.imposterIds.includes(p.id);
        const votes = r.tally[p.id] || 0;
        return `<li>
          ${maskImg(p.mask)}
          <span class="grow">${esc(p.name)}<br><span class="muted small">${votes === 0 ? t("noVotes") : votes === 1 ? t("vote1") : t("votesN", { n: votes })}</span></span>
          <span class="tag ${imp ? "imp" : ""}">${imp ? t("tagImp") : t("tagGuest")}</span>
          <span class="pts">${p.score}</span>
        </li>`;
      })
      .join("");
    return `${leaveBar()}
      <section class="screen">
        <p class="kicker">${r.winner ? (guestsWon ? t("guestsPrevail") : t("impPrevail")) : t("danceOver")}</p>
        <h2${myWin === false ? ' class="crimson"' : ""}>${myWin === true ? t("victory") : myWin === false ? t("defeat") : headline}</h2>
        <p class="lead">${myWin === null ? "" : headline + "<br>"}<span class="muted">${detail}</span></p>
        <div class="mask-card" style="padding:22px">
          <p class="muted" style="margin:0">${t("wordWas")}</p>
          <div class="secret-word">${esc(wordText(r.cat, r.idx))}</div>
          <p style="margin:0" class="muted">${esc(catName(r.cat))}${r.guess ? ` &middot; ${t("guessed", { guess: r.guess })}` : ""}</p>
        </div>
        <div class="panel"><ul class="reveal-list">${rows}</ul></div>
        ${amHost()
          ? `<div class="btn-row">
               <button class="btn primary small" data-action="start"><span>${t("anotherDance")}</span></button>
               <button class="btn" data-action="to-lobby"><span>${t("backLobby")}</span></button>
             </div>`
          : `<p class="hint">${t("waitingHostShort")}</p>`}
      </section>`;
  },
};

// ---------------------------------------------------------------- rendering

let lastKey = "";
function render() {
  const key = view === "game" && S ? "g_" + S.phase : view;
  const same = key === lastKey;
  // Keep typed text and focus when the same screen re-renders with new state.
  const kept = {};
  let focus = null;
  $app.querySelectorAll("[data-keep]").forEach((el) => {
    kept[el.dataset.keep] = el.value;
    if (el === document.activeElement) focus = { k: el.dataset.keep, s: el.selectionStart, e: el.selectionEnd };
  });

  $app.innerHTML =
    (view === "game" && reconnecting ? `<div class="banner">${t("reconnecting")}</div>` : "") + screens[key]();

  if (same) {
    $app.querySelector(".screen")?.classList.add("still");
    for (const [k, v] of Object.entries(kept)) {
      const el = $app.querySelector(`[data-keep="${k}"]`);
      if (el) el.value = v;
    }
    if (focus) {
      const el = $app.querySelector(`[data-keep="${focus.k}"]`);
      if (el) {
        el.focus();
        try {
          el.setSelectionRange(focus.s, focus.e);
        } catch {}
      }
    }
  } else {
    window.scrollTo(0, 0);
  }
  lastKey = key;
  paintTimers();
}

function paintTimers() {
  const left = endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : null;
  $app.querySelectorAll("[data-timer]").forEach((el) => {
    el.textContent = left == null ? "" : fmtTime(left);
    el.classList.toggle("low", left != null && left <= 5);
  });
}
setInterval(paintTimers, 250);

// ---------------------------------------------------------------- networking (both sides)

function makeCode() {
  return Array.from({ length: 4 }, () => CODE_CHARS[rand(CODE_CHARS.length)]).join("");
}

function sendAction(msg) {
  if (!net) return;
  if (net.isHost) hostAction(myId, msg);
  else if (net.conn?.open) net.conn.send(msg);
  else toast(plain(t("n_notConnected")));
}

function leaveNet() {
  if (!net) return;
  net.closing = true;
  if (net.isHost && H) {
    for (const p of H.players) if (p.conn) hostSend(p, { t: "closed", key: "c_hostEnded" });
    clearTimeout(H.timeout);
  }
  const peer = net.peer;
  setTimeout(() => peer.destroy(), 300); // let the goodbye message flush
  net = null;
  H = null;
  S = null;
  myRole = null;
  endsAt = null;
  reconnecting = false;
  releaseWakeLock();
}

function failToProfile(key, vars) {
  leaveNet();
  notice = plain(t(key, vars));
  view = "profile";
  render();
}

function onHostMessage(msg) {
  switch (msg?.t) {
    case "state": {
      const prev = S?.phase;
      S = msg.s;
      endsAt = S.endsIn != null ? Date.now() + S.endsIn : null;
      if (S.phase !== prev) {
        if (S.phase === "vote") myVote = null;
        if (S.phase === "lobby") myRole = null;
      }
      reconnecting = false;
      view = "game";
      render();
      break;
    }
    case "role":
      myRole = msg.role;
      if (view === "game") render();
      break;
    case "mask":
      profile.mask = msg.mask;
      saveProfile();
      break;
    case "error":
      toast(plain(t(msg.key)));
      break;
    case "closed":
      failToProfile(msg.key);
      break;
  }
}

function startHosting(attempt = 0) {
  if (typeof Peer === "undefined") return failToProfile("n_lib");
  const code = makeCode();
  view = "connecting";
  connecting = { key: "opening" };
  render();
  const peer = new Peer(ROOM_PREFIX + code, { debug: 0 });
  net = { isHost: true, peer, code, closing: false };
  peer.on("open", () => hostInit(code));
  peer.on("connection", hostAccept);
  peer.on("disconnected", () => {
    if (net?.peer === peer && !peer.destroyed) peer.reconnect();
  });
  peer.on("error", (err) => {
    if (net?.peer !== peer) return;
    if (err.type === "unavailable-id" && attempt < 5) {
      net = null;
      peer.destroy();
      startHosting(attempt + 1);
    } else if (view === "connecting") {
      failToProfile("n_open", { err: err.type });
    }
  });
  requestWakeLock();
}

function joinRoom(code) {
  if (typeof Peer === "undefined") return failToProfile("n_lib");
  view = "connecting";
  connecting = { key: "finding", vars: { code } };
  render();
  const peer = new Peer({ debug: 0 });
  net = { isHost: false, peer, code, conn: null, retries: 0, closing: false };
  const thisNet = net;
  peer.on("open", () => clientConnect(thisNet));
  peer.on("disconnected", () => {
    if (!thisNet.closing && !peer.destroyed) peer.reconnect();
  });
  peer.on("error", (err) => {
    if (thisNet.closing) return;
    if (!S) failToProfile(err.type === "peer-unavailable" ? "n_noRoom" : "n_connFail", { code, err: err.type });
    else scheduleReconnect(thisNet);
  });
  setTimeout(() => {
    if (net === thisNet && !S) failToProfile("n_cantReach");
  }, 15000);
  requestWakeLock();
}

function clientConnect(thisNet) {
  if (thisNet.closing) return;
  const conn = thisNet.peer.connect(ROOM_PREFIX + thisNet.code, { reliable: true, serialization: "json" });
  thisNet.conn = conn;
  conn.on("open", () => {
    thisNet.retries = 0;
    conn.send({ t: "hello", name: profile.name, mask: profile.mask, token: profile.token });
  });
  conn.on("data", onHostMessage);
  conn.on("close", () => {
    if (thisNet.conn === conn) scheduleReconnect(thisNet);
  });
}

function scheduleReconnect(thisNet) {
  if (thisNet.closing || net !== thisNet || thisNet.waiting) return;
  if (thisNet.retries++ >= 10) return failToProfile("n_lost");
  reconnecting = true;
  render();
  thisNet.waiting = true;
  setTimeout(() => {
    thisNet.waiting = false;
    clientConnect(thisNet);
  }, 2000);
}

// Keep phones awake during a game; a sleeping host freezes the room.
let wakeLock = null;
async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request("screen");
  } catch {}
}
function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && net) requestWakeLock();
});
window.addEventListener("beforeunload", (e) => {
  if (net?.isHost && H) e.preventDefault();
});

// ---------------------------------------------------------------- host: game engine
// Everything below runs only in the host's browser.

let H = null;

const hostPlayer = (id) => H.players.find((p) => p.id === id);
const hostActive = () => H.players.filter((p) => p.inRound && p.connected);
const hostImposterIds = () => [...H.roles].filter(([, r]) => r.isImposter).map(([id]) => id);

function hostInit(code) {
  H = {
    code,
    hostId: myId,
    players: [],
    imposters: store.get("imposters", 1),
    phase: "lobby",
    roundId: 0,
    roles: new Map(),
    votes: new Map(),
    order: [],
    orderIdx: -1,
    clueRound: 1,
    turnId: null,
    endsAt: null,
    timeout: null,
    word: null, // { cat, idx }
    lastWord: null,
    accusedId: null,
    results: null,
    message: "",
  };
  hostAddPlayer(myId, profile.name, profile.mask, null);
  hostBroadcast();
}

function hostAccept(conn) {
  conn.on("data", (msg) => {
    if (!H) return;
    if (msg?.t === "hello") return hostHello(conn, msg);
    const p = H.players.find((x) => x.conn === conn);
    if (p) hostAction(p.id, msg);
  });
  conn.on("close", () => {
    const p = H?.players.find((x) => x.conn === conn);
    if (p) hostDisconnect(p);
  });
}

function hostAddPlayer(id, name, mask, conn) {
  name = cleanName(name) || "Guest";
  let unique = name;
  for (let n = 2; H.players.some((p) => p.name.toLowerCase() === unique.toLowerCase()); n++) unique = `${name} ${n}`;
  const taken = new Set(H.players.map((p) => p.mask));
  if (!validMask(mask) || taken.has(mask)) mask = [...MASKS.keys()].find((i) => !taken.has(i)) ?? 0;
  const p = { id, name: unique, mask, conn, connected: true, score: 0, inRound: false, ready: false, voted: false, clues: [] };
  H.players.push(p);
  return p;
}

function hostHello(conn, msg) {
  const id = String(msg.token ?? "").slice(0, 40);
  if (!id) return;
  let p = hostPlayer(id);
  if (p) {
    const old = p.conn;
    p.conn = conn;
    p.connected = true;
    if (old && old !== conn) old.close();
  } else {
    if (H.players.length >= MAX_PLAYERS) {
      conn.send({ t: "closed", key: "c_full" });
      return;
    }
    p = hostAddPlayer(id, msg.name, Number(msg.mask), conn);
  }
  if (p.mask !== msg.mask) hostSend(p, { t: "mask", mask: p.mask });
  if (p.inRound) hostSend(p, { t: "role", role: H.roles.get(p.id) });
  hostBroadcast();
}

function hostDisconnect(p) {
  p.connected = false;
  p.conn = null;
  if (H.phase === "lobby") {
    H.players = H.players.filter((x) => x !== p);
  } else if (p.inRound) {
    if (H.phase === "reveal") hostCheckReady();
    if (H.phase === "vote") hostCheckVotes();
    const round = H.roundId;
    setTimeout(() => {
      if (H && H.roundId === round && !p.connected) hostRoundHealth();
    }, RECONNECT_GRACE * 1000);
  }
  if (H) hostBroadcast();
}

function hostSend(p, msg) {
  if (p.id === H.hostId) return onHostMessage(msg);
  if (p.conn?.open) {
    try {
      p.conn.send(msg);
    } catch {}
  }
}

function hostPublicState() {
  return {
    code: H.code,
    hostId: H.hostId,
    phase: H.phase,
    imposters: H.imposters,
    clueRounds: settings.clueRounds,
    order: H.order,
    players: H.players.map(({ id, name, mask, connected, score, inRound, ready, voted, clues }) => ({
      id, name, mask, connected, score, inRound, ready, voted, clues,
    })),
    turn: H.phase === "clues" && H.turnId ? { id: H.turnId, round: H.clueRound } : null,
    endsIn: H.endsAt ? Math.max(0, H.endsAt - Date.now()) : null,
    accusedId: H.accusedId,
    results: H.results,
    message: H.message,
  };
}

function hostBroadcast() {
  const s = hostPublicState();
  for (const p of H.players) hostSend(p, { t: "state", s });
}

function hostTimer(seconds, fn) {
  clearTimeout(H.timeout);
  H.endsAt = seconds ? Date.now() + seconds * 1000 : null;
  H.timeout = seconds ? setTimeout(fn, seconds * 1000) : null;
}

// The secret word in both languages, for checking clues and guesses typed in either.
function hostWordForms() {
  const { cat, idx } = H.word;
  return [WORDS[cat][idx], WORDS_AR[cat]?.[idx]].filter(Boolean).map(normWord);
}

function hostAction(id, msg) {
  const p = hostPlayer(id);
  if (!p || !msg) return;
  const isHost = id === H.hostId;
  switch (msg.t) {
    case "mask": {
      const m = Number(msg.mask);
      if (!validMask(m)) return;
      if (H.players.some((x) => x !== p && x.mask === m)) return hostSend(p, { t: "error", key: "e_maskTaken" });
      p.mask = m;
      hostSend(p, { t: "mask", mask: m });
      return hostBroadcast();
    }
    case "ready":
      if (H.phase !== "reveal" || !p.inRound) return;
      p.ready = true;
      if (!hostCheckReady()) hostBroadcast();
      return;
    case "clue": {
      if (H.phase !== "clues" || H.turnId !== id) return;
      const [clue, error] = hostValidateClue(p, msg.text);
      if (!clue) return hostSend(p, { t: "error", key: error });
      p.clues.push(clue);
      return hostNextTurn();
    }
    case "vote": {
      const target = hostPlayer(msg.target);
      if (H.phase !== "vote" || !p.inRound || !target?.inRound || target === p) return;
      H.votes.set(id, target.id);
      p.voted = true;
      if (!hostCheckVotes()) hostBroadcast();
      return;
    }
    case "guess": {
      if (H.phase !== "guess" || H.accusedId !== id) return;
      const guess = String(msg.text ?? "").trim().slice(0, 40);
      if (!guess) return;
      const correct = hostWordForms().includes(normWord(guess));
      return hostFinish(correct ? "imposter" : "guests", correct ? "named" : "missed", guess);
    }
    // Host-only controls
    case "imposters":
      if (!isHost || H.phase !== "lobby") return;
      H.imposters = clamp(H.imposters + Number(msg.d), 1, maxImposters(H.players.length));
      store.set("imposters", H.imposters);
      return hostBroadcast();
    case "start":
      if (isHost && (H.phase === "lobby" || H.phase === "results")) hostStartRound();
      return;
    case "to-vote":
      if (isHost && H.phase === "discuss") hostBeginVote();
      return;
    case "to-lobby":
      if (isHost && H.phase === "results") hostToLobby("");
      return;
  }
}

function hostValidateClue(p, raw) {
  const text = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!text) return [null, "e_clueEmpty"];
  if (text.length > MAX_CLUE_LENGTH) return [null, "e_clueLong"];
  if (text.includes(" ")) return [null, "e_oneWord"];
  // Only honest guests are blocked; telling the Imposter would leak the word.
  // Short words only match exactly, so a two-letter word doesn't block every clue containing it.
  if (!H.roles.get(p.id).isImposter) {
    const clue = normWord(text);
    if (hostWordForms().some((w) => w && (clue === w || (w.length >= 4 && clue.includes(w))))) {
      return [null, "e_saidWord"];
    }
  }
  return [text, null];
}

function hostPickWord() {
  const cats = settings.categories.length ? settings.categories : Object.keys(WORDS);
  let cat, idx;
  for (let tries = 0; tries < 10; tries++) {
    cat = cats[rand(cats.length)];
    idx = rand(WORDS[cat].length);
    if (`${cat}:${idx}` !== H.lastWord) break;
  }
  H.lastWord = `${cat}:${idx}`;
  return { cat, idx };
}

function hostStartRound() {
  H.players = H.players.filter((p) => p.connected);
  const players = H.players;
  if (players.length < MIN_PLAYERS) return hostToLobby("m_notEnough");

  const count = clamp(H.imposters, 1, maxImposters(players.length));
  const word = hostPickWord();
  const imposterIds = new Set(shuffle(players.map((p) => p.id)).slice(0, count));
  Object.assign(H, { word, roundId: H.roundId + 1, accusedId: null, results: null, message: "", turnId: null });
  H.roles.clear();
  H.votes.clear();

  for (const p of players) {
    const isImposter = imposterIds.has(p.id);
    Object.assign(p, { inRound: true, ready: false, voted: false, clues: [] });
    const role = {
      isImposter,
      cat: isImposter && !settings.imposterSeesCategory ? null : word.cat,
      idx: isImposter ? null : word.idx,
      imposterCount: count,
    };
    H.roles.set(p.id, role);
    hostSend(p, { t: "role", role });
  }

  // Clue order: start from a random guest and go around; optionally never start with an imposter.
  const ids = shuffle(players.map((p) => p.id));
  let start = 0;
  if (settings.imposterNeverFirst) start = Math.max(0, ids.findIndex((id) => !imposterIds.has(id)));
  H.order = ids.map((_, k) => ids[(start + k) % ids.length]);

  H.phase = "reveal";
  hostTimer(REVEAL_TIME, hostBeginClues);
  hostBroadcast();
}

function hostCheckReady() {
  if (H.phase === "reveal" && hostActive().every((p) => p.ready)) {
    hostBeginClues();
    return true;
  }
  return false;
}

function hostBeginClues() {
  H.phase = "clues";
  H.clueRound = 1;
  H.orderIdx = -1;
  hostNextTurn();
}

function hostNextTurn() {
  for (let guard = 0; guard < H.order.length * (settings.clueRounds + 1); guard++) {
    H.orderIdx++;
    if (H.orderIdx >= H.order.length) {
      H.orderIdx = 0;
      H.clueRound++;
    }
    if (H.clueRound > settings.clueRounds) break;
    const p = hostPlayer(H.order[H.orderIdx]);
    if (p?.connected && p.inRound) {
      H.turnId = p.id;
      hostTimer(settings.clueTime, () => {
        p.clues.push(null); // shown as "(silence)"
        hostNextTurn();
      });
      return hostBroadcast();
    }
  }
  hostBeginDiscuss();
}

function hostBeginDiscuss() {
  H.phase = "discuss";
  H.turnId = null;
  hostTimer(settings.discussTime, hostBeginVote);
  hostBroadcast();
}

function hostBeginVote() {
  H.phase = "vote";
  H.votes.clear();
  for (const p of H.players) p.voted = false;
  hostTimer(VOTE_TIME, hostTally);
  hostBroadcast();
}

function hostCheckVotes() {
  if (H.phase === "vote" && hostActive().every((p) => p.voted)) {
    hostTally();
    return true;
  }
  return false;
}

function hostTally() {
  const tally = {};
  for (const target of H.votes.values()) tally[target] = (tally[target] || 0) + 1;
  H.tally = tally;
  let top = null, best = 0, tie = false;
  for (const [id, n] of Object.entries(tally)) {
    if (n > best) [top, best, tie] = [id, n, false];
    else if (n === best) tie = true;
  }
  if (!top || tie) return hostFinish("imposter", "noAgree");
  H.accusedId = top;
  if (!H.roles.get(top)?.isImposter) return hostFinish("imposter", "innocent");
  H.phase = "guess";
  hostTimer(GUESS_TIME, () => hostFinish("guests", "timeout"));
  hostBroadcast();
}

function hostRoundHealth() {
  if (!["reveal", "clues", "discuss", "vote", "guess"].includes(H.phase)) return;
  const active = hostActive();
  if (!active.some((p) => H.roles.get(p.id)?.isImposter)) return hostFinish("guests", "fled");
  if (active.length < MIN_PLAYERS) return hostToLobby("m_cancelled");
  if (H.phase === "guess" && !hostPlayer(H.accusedId)?.connected) return hostFinish("guests", "fledGuess");
}

function hostFinish(winner, reason, guess = null) {
  hostTimer(0);
  H.phase = "results";
  H.turnId = null;
  const imposterIds = hostImposterIds();
  for (const p of H.players) {
    if (!p.inRound) continue;
    const imp = imposterIds.includes(p.id);
    if (winner === "guests" && !imp) p.score += POINTS_GUEST_WIN;
    if (winner === "imposter" && imp) p.score += POINTS_IMPOSTER_WIN;
  }
  H.results = { winner, reason, guess, accusedId: H.accusedId, cat: H.word.cat, idx: H.word.idx, imposterIds, tally: H.tally || {} };
  H.tally = null;
  hostBroadcast();
}

function hostToLobby(message) {
  hostTimer(0);
  H.phase = "lobby";
  H.players = H.players.filter((p) => p.connected);
  for (const p of H.players) Object.assign(p, { inRound: false, ready: false, voted: false, clues: [] });
  Object.assign(H, { order: [], turnId: null, accusedId: null, results: null, message, roundId: H.roundId + 1 });
  H.roles.clear();
  H.votes.clear();
  hostBroadcast();
}

// ---------------------------------------------------------------- modals

let confirmAction = null;

function openModal(html) {
  $modal.innerHTML = `<div class="panel" role="dialog" aria-modal="true">${html}</div>`;
  $modal.hidden = false;
}

function closeModal() {
  $modal.hidden = true;
  $modal.innerHTML = "";
  confirmAction = null;
}

// Themed replacement for the browser's confirm() dialog.
function askConfirm({ kicker, title, body, ok, cancel = t("stay") }, onOk) {
  openModal(`
    <p class="kicker" style="text-align:center">${kicker}</p>
    <h2>${title}</h2>
    <div class="divider">&#10022;</div>
    <p class="lead" style="text-align:center;margin-top:0">${body}</p>
    <div class="btn-row">
      <button class="btn" data-action="close-modal"><span>${cancel}</span></button>
      <button class="btn primary small" data-action="confirm-ok"><span>${ok}</span></button>
    </div>`);
  confirmAction = onOk;
  $modal.querySelector('[data-action="close-modal"]').focus();
}

function showRules() {
  const rules = [1, 2, 3, 4, 5, 6].map((n) => `<li>${t("rule" + n)}</li>`).join("");
  openModal(`
    <p class="kicker" style="text-align:center">${t("tagline")}</p>
    <h2>${t("rulesTitle")}</h2>
    <div class="divider">&#10022;</div>
    <ol>${rules}</ol>
    <p class="hint">${t("rulesPoints", { g: POINTS_GUEST_WIN, i: POINTS_IMPOSTER_WIN })}</p>
    <div class="btn-row"><button class="btn" data-action="close-modal"><span>${t("close")}</span></button></div>`);
}

function showSettings() {
  const toggle = (key, title, sub) => `
    <div class="setting">
      <div>${t(title)}<small>${t(sub)}</small></div>
      <button class="toggle" role="switch" aria-checked="${settings[key]}" data-action="toggle-setting" data-key="${key}" aria-label="${t(title)}"></button>
    </div>`;
  const select = (key, title, sub, options) => `
    <div class="setting">
      <div>${t(title)}<small>${t(sub)}</small></div>
      <select class="select" data-setting="${key}">${options
        .map(([v, label]) => `<option value="${v}" ${settings[key] === v ? "selected" : ""}>${label}</option>`)
        .join("")}</select>
    </div>`;
  const cats = Object.keys(WORDS)
    .map((c) => `<button class="chip" aria-pressed="${settings.categories.includes(c)}" data-action="toggle-category" data-cat="${esc(c)}">${esc(catName(c))}</button>`)
    .join("");
  openModal(`
    <h2>${t("settingsTitle")}</h2>
    <div class="divider">&#10022;</div>
    ${select("lang", "langLabel", "langSub", [["en", "English"], ["ar", "العربية"]])}
    <p class="hint" style="text-align:center;margin-top:18px">${t("hostSettings")}</p>
    ${toggle("imposterSeesCategory", "s_cat", "s_catSub")}
    ${toggle("imposterNeverFirst", "s_first", "s_firstSub")}
    ${select("clueRounds", "s_rounds", "s_roundsSub", [[1, "1"], [2, "2"], [3, "3"]])}
    ${select("clueTime", "s_time", "s_timeSub", [[20, "0:20"], [30, "0:30"], [45, "0:45"], [60, "1:00"]])}
    ${select("discussTime", "s_debate", "s_debateSub", [[0, t("hostDecides")], [60, "1:00"], [90, "1:30"], [120, "2:00"], [180, "3:00"]])}
    <span class="field-label" style="margin-top:14px">${t("categories")}</span>
    <div class="chips">${cats}</div>
    <div class="btn-row"><button class="btn" data-action="close-modal"><span>${t("done")}</span></button></div>`);
}

function showMaskModal() {
  const taken = new Set(S.players.filter((p) => p.id !== myId).map((p) => p.mask));
  openModal(`
    <h2>${t("chooseMaskTitle")}</h2>
    <div class="divider">&#10022;</div>
    ${maskPicker(taken)}
    <div class="btn-row"><button class="btn" data-action="close-modal"><span>${t("done")}</span></button></div>`);
}

function saveSettings() {
  store.set("settings", settings);
}

// ---------------------------------------------------------------- input

function requireName() {
  profile.name = cleanName(document.getElementById("name-input")?.value ?? profile.name);
  saveProfile();
  if (!profile.name) {
    notice = plain(t("n_enterName"));
    render();
    document.getElementById("name-input")?.focus();
    return false;
  }
  return true;
}

const actions = {
  menu: () => {
    view = "menu";
    render();
  },
  play: () => {
    notice = "";
    view = "profile";
    render();
  },
  rules: showRules,
  settings: showSettings,
  "close-modal": closeModal,
  "confirm-ok": () => {
    const fn = confirmAction;
    closeModal();
    fn?.();
  },

  "pick-mask": ({ i }) => {
    const m = Number(i);
    if (view === "game") {
      sendAction({ t: "mask", mask: m });
      closeModal();
      return;
    }
    profile.mask = m;
    saveProfile();
    document.querySelectorAll(".mask-opt").forEach((el) => el.classList.toggle("selected", Number(el.dataset.i) === m));
    const hero = $app.querySelector(".hero-mask");
    if (hero) hero.outerHTML = maskImg(m, "hero-mask");
    const label = $app.querySelector(".mask-name");
    if (label) label.textContent = maskName(m);
  },
  host: () => {
    if (!requireName()) return;
    notice = "";
    startHosting();
  },
  "cancel-connect": () => {
    leaveNet();
    view = "profile";
    render();
  },
  leave: () => {
    const host = amHost();
    askConfirm(
      {
        kicker: t("slipping"),
        title: host ? t("endBallQ") : t("leaveBallQ"),
        body: host ? t("hostLeaveBody") : t("guestLeaveBody"),
        ok: host ? t("endBall") : t("leaveBtn"),
      },
      () => {
        leaveNet();
        view = "profile";
        notice = "";
        render();
      }
    );
  },
  invite: async () => {
    const url = `${location.origin}${location.pathname}?room=${S.code}`;
    const text = plain(t("inviteText", { code: S.code }));
    if (navigator.share) {
      try {
        await navigator.share({ title: plain(t("docTitle")), text, url });
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast(plain(t("inviteCopied")));
    } catch {
      toast(plain(t("shareCode", { code: S.code })));
    }
  },
  "hide-install": () => {
    store.set("installHintHidden", true);
    render();
  },
  "change-mask": showMaskModal,
  imposters: ({ d }) => sendAction({ t: "imposters", d: Number(d) }),
  start: () => sendAction({ t: "start" }),
  ready: () => sendAction({ t: "ready" }),
  "to-vote": () => sendAction({ t: "to-vote" }),
  "to-lobby": () => sendAction({ t: "to-lobby" }),
  vote: ({ id }) => {
    myVote = id;
    sendAction({ t: "vote", target: id });
    render();
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

document.addEventListener("input", (e) => {
  if (e.target.id === "name-input") {
    profile.name = cleanName(e.target.value);
    saveProfile();
  } else if (e.target.matches(".code-input")) {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
  }
});

document.addEventListener("change", (e) => {
  const key = e.target.dataset?.setting;
  if (!key) return;
  if (key === "lang") {
    // Language is personal: it only changes this device, so redraw everything here.
    settings.lang = e.target.value;
    saveSettings();
    applyLang(settings.lang);
    lastKey = "";
    render();
    showSettings();
    return;
  }
  settings[key] = Number(e.target.value);
  saveSettings();
});

document.addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target.dataset.form;
  const input = e.target.querySelector("input");
  const value = input?.value.trim() ?? "";
  if (form === "join") {
    if (!requireName()) return;
    if (!/^[A-Z]{4}$/.test(value.toUpperCase())) {
      notice = plain(t("n_codeLetters"));
      return render();
    }
    pendingCode = value.toUpperCase();
    notice = "";
    joinRoom(pendingCode);
  } else if (form === "clue" || form === "guess") {
    if (!value) return;
    sendAction({ t: form, text: value });
    input.value = "";
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$modal.hidden) closeModal();
});

// Arriving from an invite link goes straight to the join screen.
if (pendingCode) view = "profile";
render();

// Makes the game installable as a home-screen app (only works over https, e.g. GitHub Pages).
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
