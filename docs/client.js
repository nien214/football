const FIELD_WIDTH = 1000;
const FIELD_HEIGHT = 620;
const GOAL_WIDTH = 220;
const KEYBOARD_CURSOR_SPEED = 420;
const STATE_POLL_MS = 40;
const REAL_MATCH_MS = 2 * 60 * 1000;
const VIRTUAL_MATCH_SECONDS = 90 * 60;
const REMOTE_API_BASE = "https://football-2kxo.onrender.com";
const API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "0.0.0.0"
    ? ""
    : REMOTE_API_BASE;

const COUNTRY_GROUPS = {
  Africa: [
    ["🇪🇬", "Egypt"],
    ["🇲🇦", "Morocco"],
    ["🇳🇬", "Nigeria"],
    ["🇿🇦", "South Africa"],
    ["🇰🇪", "Kenya"],
    ["🇬🇭", "Ghana"]
  ],
  Asia: [
    ["🇯🇵", "Japan"],
    ["🇰🇷", "South Korea"],
    ["🇨🇳", "China"],
    ["🇮🇩", "Indonesia"],
    ["🇮🇳", "India"],
    ["🇸🇦", "Saudi Arabia"]
  ],
  Europe: [
    ["🇪🇸", "Spain"],
    ["🇩🇪", "Germany"],
    ["🇫🇷", "France"],
    ["🇬🇧", "United Kingdom"],
    ["🇮🇹", "Italy"],
    ["🇳🇱", "Netherlands"]
  ],
  "North America": [
    ["🇺🇸", "United States"],
    ["🇨🇦", "Canada"],
    ["🇲🇽", "Mexico"],
    ["🇨🇷", "Costa Rica"],
    ["🇯🇲", "Jamaica"]
  ],
  "South America": [
    ["🇧🇷", "Brazil"],
    ["🇦🇷", "Argentina"],
    ["🇺🇾", "Uruguay"],
    ["🇨🇴", "Colombia"],
    ["🇨🇱", "Chile"],
    ["🇵🇪", "Peru"]
  ],
  Oceania: [
    ["🇦🇺", "Australia"],
    ["🇳🇿", "New Zealand"],
    ["🇫🇯", "Fiji"],
    ["🇼🇸", "Samoa"]
  ]
};

const menu = document.getElementById("menu");
const hud = document.getElementById("hud");
const hudScore = document.getElementById("hudScore");
const hudTime = document.getElementById("hudTime");
const resultOverlay = document.getElementById("resultOverlay");
const resultTitle = document.getElementById("resultTitle");
const resultWinner = document.getElementById("resultWinner");
const resultScore = document.getElementById("resultScore");
const playAgainBtn = document.getElementById("playAgainBtn");
const statusText = document.getElementById("statusText");

const nameInput = document.getElementById("nameInput");
const countrySelect = document.getElementById("countrySelect");
const modeCpuBtn = document.getElementById("modeCpuBtn");
const modeOnlineBtn = document.getElementById("modeOnlineBtn");
const cpuControls = document.getElementById("cpuControls");
const onlineControls = document.getElementById("onlineControls");
const startCpuBtn = document.getElementById("startCpuBtn");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const codeInput = document.getElementById("codeInput");
const roomCodeBox = document.getElementById("roomCodeBox");
const goalGifOverlay = document.getElementById("goalGifOverlay");
const goalGif = document.getElementById("goalGif");
const preloadOverlay = document.getElementById("preloadOverlay");
const preloadFlagA = document.getElementById("preloadFlagA");
const preloadFlagB = document.getElementById("preloadFlagB");
const preloadLoading = document.getElementById("preloadLoading");
const preloadDots = document.getElementById("preloadDots");

const canvas = document.getElementById("pitch");
const ctx = canvas.getContext("2d");

const CPU_COUNTRIES = [
  "🇧🇷 Brazil",
  "🇦🇷 Argentina",
  "🇩🇪 Germany",
  "🇫🇷 France",
  "🇪🇸 Spain",
  "🇮🇹 Italy",
  "🇳🇱 Netherlands",
  "🇯🇵 Japan",
  "🇰🇷 South Korea",
  "🇲🇽 Mexico",
  "🇳🇬 Nigeria",
  "🇪🇬 Egypt"
];

const CELEBRATION_GIFS = [
  "assets/arg_celeb1.gif",
  "assets/arg_celeb2.gif",
  "assets/arg_celeb3.gif",
  "assets/arg_celeb4.gif",
  "assets/arg_celeb5.gif",
  "assets/arg_celeb6.gif",
  "assets/bra_celeb1.gif",
  "assets/bra_celeb2.gif",
  "assets/bra_celeb5.gif",
  "assets/bra_celeb6.gif",
  "assets/bra_celeb7.gif",
  "assets/kor_celeb1.gif",
  "assets/por_celeb1.gif"
];
const BRAZIL_GIFS = CELEBRATION_GIFS.filter((src) =>
  src.toLowerCase().includes("/bra_")
);
const ARGENTINA_GIFS = CELEBRATION_GIFS.filter((src) =>
  src.toLowerCase().includes("/arg_")
);
const REQUIRED_ASSETS = [
  ...CELEBRATION_GIFS,
  "assets/crowd.mp3",
  "assets/goal.mp3",
  "assets/whistle.mp3"
];
const crowdAudio = new Audio("assets/crowd.mp3");
crowdAudio.loop = true;
crowdAudio.preload = "auto";
crowdAudio.volume = 0.42;
const SFX_POOL_SIZE = 6;

function createSfxPool(src, volume) {
  const pool = [];
  for (let i = 0; i < SFX_POOL_SIZE; i += 1) {
    const sfx = new Audio(src);
    sfx.preload = "auto";
    sfx.volume = volume;
    pool.push(sfx);
  }
  return pool;
}

const goalSfxPool = createSfxPool("assets/goal.mp3", 0.88);
const whistleSfxPool = createSfxPool("assets/whistle.mp3", 0.92);

let token = null;
let mode = "cpu";
let myTeam = 0;
let state = null;
let gameActive = false;
let pendingCursor = null;
let lastCursorSentAt = 0;
let lastInputTickAt = performance.now();
let pollTimer = null;
let pollInFlight = false;
let lastStatus = "";
let currentMatchMode = "cpu";
let crowdShouldPlay = false;
let hasUserInteracted = false;
let assetsReady = false;
let assetsPreloadPromise = null;
let preloadDotsTimer = null;
let preloadDotCount = 0;
let hasPlayedEndWarningWhistle = false;
let onlineStartFlowInFlight = false;
let onlineStartReadySent = false;
let onlineStartRoomCode = "";
const sfxStopTimers = new WeakMap();
const goalOverlayState = {
  stage: null
};
const keyboardMove = {
  up: false,
  down: false,
  left: false,
  right: false
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function extractFlag(countryText) {
  const text = String(countryText || "").trim();
  if (!text) {
    return "🏳️";
  }
  const first = text.split(/\s+/)[0];
  return first.length <= 6 ? first : "🏳️";
}

function setStatus(text, isError = false) {
  if (text === lastStatus && statusText.dataset.error === (isError ? "1" : "0")) {
    return;
  }
  statusText.textContent = text;
  statusText.dataset.error = isError ? "1" : "0";
  lastStatus = text;
}

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function normalizeCode4(raw) {
  return String(raw || "").replace(/\D/g, "").slice(0, 4);
}

function resetOnlineStartFlow() {
  onlineStartFlowInFlight = false;
  onlineStartReadySent = false;
  onlineStartRoomCode = "";
}

function setMode(nextMode) {
  mode = nextMode;
  modeCpuBtn.classList.toggle("active", mode === "cpu");
  modeOnlineBtn.classList.toggle("active", mode === "online");
  cpuControls.classList.toggle("hidden", mode !== "cpu");
  onlineControls.classList.toggle("hidden", mode !== "online");
  roomCodeBox.classList.add("hidden");
  if (mode === "cpu") {
    setStatus("Play against CPU: enter name and country, then start.");
  } else {
    setStatus("Online mode: create or join a room with a 4-digit code.");
  }
}

function populateCountries() {
  countrySelect.innerHTML = "";
  for (const [continent, countries] of Object.entries(COUNTRY_GROUPS)) {
    const group = document.createElement("optgroup");
    group.label = continent;
    for (const [flag, name] of countries) {
      const option = document.createElement("option");
      option.value = `${flag} ${name}`;
      option.textContent = `${flag} ${name}`;
      if (name === "United States") {
        option.selected = true;
      }
      group.appendChild(option);
    }
    countrySelect.appendChild(group);
  }
}

function profilePayload() {
  return {
    name: (nameInput.value || "").trim().slice(0, 18) || "Player",
    country: countrySelect.value || "Unknown"
  };
}

function randomCpuCountry() {
  const index = Math.floor(Math.random() * CPU_COUNTRIES.length);
  return CPU_COUNTRIES[index] || "🇧🇷 Brazil";
}

function showPreloadOverlay(countryA, countryB) {
  if (!preloadOverlay || !preloadFlagA || !preloadFlagB || !preloadLoading || !preloadDots) {
    return;
  }

  preloadFlagA.textContent = extractFlag(countryA);
  preloadFlagB.textContent = extractFlag(countryB);
  preloadDotCount = 1;
  preloadDots.textContent = ".";
  preloadOverlay.classList.remove("hidden");

  if (preloadDotsTimer) {
    clearInterval(preloadDotsTimer);
  }
  preloadDotsTimer = setInterval(() => {
    preloadDotCount = (preloadDotCount % 3) + 1;
    preloadDots.textContent = ".".repeat(preloadDotCount);
  }, 260);
}

function hidePreloadOverlay() {
  if (preloadDotsTimer) {
    clearInterval(preloadDotsTimer);
    preloadDotsTimer = null;
  }
  if (preloadDots) {
    preloadDots.textContent = "...";
  }
  if (preloadOverlay) {
    preloadOverlay.classList.add("hidden");
  }
}

function preloadSingleAsset(url) {
  const lower = String(url).toLowerCase();
  if (lower.endsWith(".gif")) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load asset: ${url}`));
      img.src = url;
    });
  }

  return fetch(url, { cache: "force-cache" }).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to load asset: ${url}`);
    }
    return response.arrayBuffer();
  });
}

async function ensureAssetsPreloaded(preview = null) {
  if (assetsReady) {
    return;
  }

  const leftCountry = preview?.leftCountry || countrySelect.value || "Unknown";
  const rightCountry = preview?.rightCountry || "Unknown";
  showPreloadOverlay(leftCountry, rightCountry);

  try {
    if (assetsPreloadPromise) {
      await assetsPreloadPromise;
      return;
    }

    const total = REQUIRED_ASSETS.length;
    let loaded = 0;

    assetsPreloadPromise = Promise.all(
      REQUIRED_ASSETS.map(async (url) => {
        await preloadSingleAsset(url);
        loaded += 1;
        setStatus(`Loading assets ${loaded}/${total}...`);
      })
    );

    setStatus(`Loading assets 0/${total}...`);
    try {
      await assetsPreloadPromise;
      assetsReady = true;
    } catch (err) {
      assetsPreloadPromise = null;
      throw err;
    }
  } finally {
    hidePreloadOverlay();
  }
}

async function preloadOnInitialLaunch() {
  menu.classList.add("hidden");
  hud.classList.add("hidden");

  try {
    await ensureAssetsPreloaded({
      leftCountry: countrySelect.value || "Unknown",
      rightCountry: randomCpuCountry()
    });
  } catch (err) {
    setStatus(err.message || "Failed to preload assets.", true);
  }

  showMenu();
  setMode("cpu");
}

function syncCrowdAudio() {
  if (crowdShouldPlay && hasUserInteracted) {
    if (crowdAudio.paused) {
      const playAttempt = crowdAudio.play();
      if (playAttempt && typeof playAttempt.catch === "function") {
        playAttempt.catch(() => {});
      }
    }
    return;
  }

  crowdAudio.pause();
  crowdAudio.currentTime = 0;
}

function keepCrowdAlive() {
  if (!crowdShouldPlay || !hasUserInteracted) {
    return;
  }
  if (!crowdAudio.paused) {
    return;
  }
  const playAttempt = crowdAudio.play();
  if (playAttempt && typeof playAttempt.catch === "function") {
    playAttempt.catch(() => {});
  }
}

function startCrowdAudio() {
  crowdShouldPlay = true;
  syncCrowdAudio();
}

function stopCrowdAudio() {
  crowdShouldPlay = false;
  syncCrowdAudio();
}

function playSfxParallel(templateAudio, maxDurationMs = 0) {
  if (!hasUserInteracted) {
    return null;
  }

  const pool = templateAudio;
  if (!Array.isArray(pool) || pool.length === 0) {
    return null;
  }

  let sfx = pool.find((audio) => audio.paused || audio.ended);
  if (!sfx) {
    sfx = pool[0];
  }

  const previousTimer = sfxStopTimers.get(sfx);
  if (previousTimer) {
    clearTimeout(previousTimer);
    sfxStopTimers.delete(sfx);
  }

  try {
    sfx.pause();
    sfx.currentTime = 0;
  } catch (err) {
    // Ignore media reset errors and still attempt play.
  }

  const playAttempt = sfx.play();
  if (playAttempt && typeof playAttempt.catch === "function") {
    playAttempt.catch(() => {});
  }

  if (maxDurationMs > 0) {
    const timer = window.setTimeout(() => {
      sfx.pause();
      sfx.currentTime = 0;
      sfxStopTimers.delete(sfx);
    }, maxDurationMs);
    sfxStopTimers.set(sfx, timer);
  }

  return sfx;
}

function playGoalAudio() {
  keepCrowdAlive();
  playSfxParallel(goalSfxPool);
  window.setTimeout(keepCrowdAlive, 40);
  window.setTimeout(keepCrowdAlive, 240);
}

function playWhistleAudio() {
  keepCrowdAlive();
  playSfxParallel(whistleSfxPool, 2000);
  window.setTimeout(keepCrowdAlive, 40);
  window.setTimeout(keepCrowdAlive, 240);
}

function hideGoalGif() {
  if (goalGifOverlay) {
    goalGifOverlay.classList.add("hidden");
  }
  if (goalGif) {
    goalGif.removeAttribute("src");
  }
}

function playGoalGif() {
  if (!goalGifOverlay || !goalGif) {
    return;
  }
  const scoringTeam = state?.goalPause?.scoringTeam;
  const countryText = String(state?.profiles?.[scoringTeam]?.country || "");
  const countryLower = countryText.toLowerCase();

  let pool = CELEBRATION_GIFS;
  if (countryText.includes("🇧🇷") || countryLower.includes("brazil")) {
    pool = BRAZIL_GIFS.length > 0 ? BRAZIL_GIFS : CELEBRATION_GIFS;
  } else if (countryText.includes("🇦🇷") || countryLower.includes("argentina")) {
    pool = ARGENTINA_GIFS.length > 0 ? ARGENTINA_GIFS : CELEBRATION_GIFS;
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  // Reset src first so repeated same GIF still replays from frame 1.
  goalGif.removeAttribute("src");
  goalGif.src = pick;
  goalGifOverlay.classList.remove("hidden");
}

function showMenu() {
  menu.classList.remove("hidden");
  hud.classList.add("hidden");
  hideResultOverlay();
  hideGoalGif();
  hidePreloadOverlay();
  stopCrowdAudio();
  hasPlayedEndWarningWhistle = false;
  resetOnlineStartFlow();
}

function showGame() {
  menu.classList.add("hidden");
  hud.classList.remove("hidden");
  hidePreloadOverlay();
}

function hideResultOverlay() {
  resultOverlay.classList.add("hidden");
}

function showResultOverlay(winnerText) {
  if (!state) {
    return;
  }
  const leftFlag = extractFlag(state.profiles?.[0]?.country);
  const rightFlag = extractFlag(state.profiles?.[1]?.country);
  resultTitle.textContent = "FULL TIME";
  resultWinner.textContent = winnerText || "";
  resultScore.textContent = `${leftFlag} ${state.score[0]} - ${state.score[1]} ${rightFlag}`;
  resultOverlay.classList.remove("hidden");
}

async function apiPost(path, payload) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.ok === false) {
    throw new Error(json.message || `Request failed (${response.status})`);
  }
  return json;
}

async function safeLeaveSession() {
  if (!token) {
    return;
  }
  try {
    await apiPost("/api/leave", { token });
  } catch (err) {
    // Ignore leave errors; token might already be invalid.
  }
  token = null;
  gameActive = false;
  resetOnlineStartFlow();
}

function startPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
  pollTimer = setInterval(() => {
    void pollState();
  }, STATE_POLL_MS);
  void pollState();
}

async function beginOnlineStartFlow(payload) {
  const safeCode = normalizeCode4(payload.code);
  if (!safeCode || !token) {
    return;
  }

  if (onlineStartRoomCode !== safeCode) {
    onlineStartRoomCode = safeCode;
    onlineStartReadySent = false;
    onlineStartFlowInFlight = false;
  }

  if (onlineStartReadySent || onlineStartFlowInFlight) {
    return;
  }

  onlineStartFlowInFlight = true;
  try {
    const leftCountry = payload.profiles?.[0]?.country || "Unknown";
    const rightCountry = payload.profiles?.[1]?.country || "Unknown";
    await ensureAssetsPreloaded({
      leftCountry,
      rightCountry
    });
    await apiPost("/api/ready", { token });
    onlineStartReadySent = true;
    setStatus("Loaded. Waiting for opponent...");
  } catch (err) {
    setStatus(err.message || "Failed to load match assets.", true);
  } finally {
    onlineStartFlowInFlight = false;
  }
}

async function pollState() {
  if (!token || pollInFlight) {
    return;
  }
  pollInFlight = true;
  try {
    const response = await fetch(apiUrl(`/api/state?token=${encodeURIComponent(token)}`), {
      method: "GET",
      cache: "no-store"
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.ok === false) {
      if (json.status === "expired") {
        token = null;
        gameActive = false;
        showMenu();
        setStatus(json.message || "Session expired. Start a new game.", true);
      }
      return;
    }
    handleServerState(json);
  } catch (err) {
    setStatus("Connection error while polling game state.", true);
  } finally {
    pollInFlight = false;
  }
}

function handleServerState(payload) {
  if (payload.status === "waiting") {
    gameActive = false;
    showMenu();
    hideResultOverlay();
    goalOverlayState.stage = null;
    hideGoalGif();
    const safeCode = normalizeCode4(payload.code);
    roomCodeBox.textContent = safeCode ? `Room code: ${safeCode}` : "Room code: ----";
    roomCodeBox.classList.remove("hidden");
    if (safeCode) {
      codeInput.value = safeCode;
      setStatus(`Room ${safeCode} created. Waiting for another player...`);
    } else {
      setStatus("Room created. Waiting for another player...", false);
    }
    return;
  }

  if (payload.status === "starting") {
    currentMatchMode = payload.mode;
    myTeam = payload.team;
    gameActive = false;
    state = null;
    roomCodeBox.classList.add("hidden");
    hideResultOverlay();
    showGame();
    setStatus("Opponent joined. Loading match...");
    void beginOnlineStartFlow(payload);
    return;
  }

  if (payload.status === "started") {
    resetOnlineStartFlow();
    const wasActive = gameActive;
    const previousTimeLeftMs = state && Number.isFinite(state.timeLeftMs) ? state.timeLeftMs : null;
    currentMatchMode = payload.mode;
    myTeam = payload.team;
    state = payload.state;
    gameActive = true;
    startCrowdAudio();
    if (!wasActive) {
      hasPlayedEndWarningWhistle = false;
      playWhistleAudio();
    }

    if (!hasPlayedEndWarningWhistle && Number.isFinite(state.timeLeftMs) && state.timeLeftMs > 0) {
      const crossedOneSecond =
        (previousTimeLeftMs === null && state.timeLeftMs <= 1000) ||
        (previousTimeLeftMs !== null && previousTimeLeftMs > 1000 && state.timeLeftMs <= 1000);
      if (crossedOneSecond) {
        playWhistleAudio();
        hasPlayedEndWarningWhistle = true;
      }
    }

    if (!pendingCursor) {
      const selected = getSelectedPlayer();
      pendingCursor = selected
        ? { x: selected.x, y: selected.y }
        : { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2 };
    }
    showGame();
    hideResultOverlay();
    updateHud();
    if (payload.mode === "online") {
      setStatus(`Online match started. Room ${payload.code}.`);
    } else {
      setStatus("CPU match started.");
    }
    return;
  }

  if (payload.status === "ended") {
    resetOnlineStartFlow();
    myTeam = payload.team;
    state = payload.state;
    gameActive = false;
    stopCrowdAudio();
    goalOverlayState.stage = null;
    hideGoalGif();
    showGame();
    updateHud();
    showResultOverlay(payload.winner === "Draw" ? "Match Drawn" : `${payload.winner} Wins`);
    setStatus("Time is up.");
    return;
  }

  if (payload.status === "opponent_left") {
    resetOnlineStartFlow();
    myTeam = payload.team;
    state = payload.state || state;
    gameActive = false;
    stopCrowdAudio();
    goalOverlayState.stage = null;
    hideGoalGif();
    showMenu();
    hideResultOverlay();
    updateHud();
    setStatus("Opponent left the room.", true);
  }
}

function sendInput(x, y) {
  if (!token) {
    return;
  }
  fetch(apiUrl("/api/input"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, x, y })
  }).catch(() => {});
}

function sendClick(x, y) {
  if (!token) {
    return;
  }
  fetch(apiUrl("/api/click"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, x, y })
  }).catch(() => {});
}

function sendAction(x, y) {
  if (!token) {
    return;
  }
  fetch(apiUrl("/api/action"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, x, y })
  }).catch(() => {});
}

function sendSelect(number) {
  if (!token) {
    return;
  }
  fetch(apiUrl("/api/select"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, number })
  }).catch(() => {});
}

function getSelectedPlayer() {
  if (!state || !state.players || !state.selected) {
    return null;
  }
  const selectedId = state.selected[myTeam];
  return state.players.find((player) => player.id === selectedId) || null;
}

function getMyBallCarrier() {
  if (!state || !state.players) {
    return null;
  }
  return state.players.find((player) => player.team === myTeam && player.hasBall) || null;
}

function isTypingTarget(event) {
  const target = event.target;
  const tagName = target && target.tagName ? target.tagName.toLowerCase() : "";
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

function updateKeyboardCursor(deltaMs) {
  const dx = (keyboardMove.right ? 1 : 0) - (keyboardMove.left ? 1 : 0);
  const dy = (keyboardMove.down ? 1 : 0) - (keyboardMove.up ? 1 : 0);
  if (dx === 0 && dy === 0) {
    return;
  }

  if (!pendingCursor) {
    const selected = getSelectedPlayer();
    pendingCursor = selected
      ? { x: selected.x, y: selected.y }
      : { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2 };
  }

  const distance = Math.hypot(dx, dy) || 1;
  const step = (KEYBOARD_CURSOR_SPEED * deltaMs) / 1000;
  pendingCursor.x = clamp(pendingCursor.x + (dx / distance) * step, 0, FIELD_WIDTH);
  pendingCursor.y = clamp(pendingCursor.y + (dy / distance) * step, 0, FIELD_HEIGHT);
}

function worldPosFromMouse(event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  return {
    x: clamp(x, 0, FIELD_WIDTH),
    y: clamp(y, 0, FIELD_HEIGHT)
  };
}

function formatClock(ms) {
  const elapsedMs = clamp(REAL_MATCH_MS - ms, 0, REAL_MATCH_MS);
  let totalSeconds = Math.floor((elapsedMs / REAL_MATCH_MS) * VIRTUAL_MATCH_SECONDS);
  if (ms <= 0) {
    totalSeconds = VIRTUAL_MATCH_SECONDS;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateHud() {
  if (!state) {
    return;
  }
  const leftFlag = extractFlag(state.profiles?.[0]?.country);
  const rightFlag = extractFlag(state.profiles?.[1]?.country);
  hudScore.textContent = `${leftFlag} ${state.score[0]} - ${state.score[1]} ${rightFlag}`;
  hudTime.textContent = formatClock(state.timeLeftMs);
}

function drawField() {
  ctx.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
  ctx.fillStyle = "#2b8f4c";
  ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  for (let i = 0; i < 10; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.01)";
    ctx.fillRect((FIELD_WIDTH / 10) * i, 0, FIELD_WIDTH / 10, FIELD_HEIGHT);
  }

  ctx.strokeStyle = "#f6fff0";
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, FIELD_WIDTH - 4, FIELD_HEIGHT - 4);

  ctx.beginPath();
  ctx.moveTo(FIELD_WIDTH / 2, 0);
  ctx.lineTo(FIELD_WIDTH / 2, FIELD_HEIGHT);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, 76, 0, Math.PI * 2);
  ctx.stroke();

  const goalTop = FIELD_HEIGHT / 2 - GOAL_WIDTH / 2;
  ctx.strokeRect(0, goalTop, 115, GOAL_WIDTH);
  ctx.strokeRect(FIELD_WIDTH - 115, goalTop, 115, GOAL_WIDTH);

  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(-8, goalTop + 20, 8, GOAL_WIDTH - 40);
  ctx.fillRect(FIELD_WIDTH, goalTop + 20, 8, GOAL_WIDTH - 40);
}

function drawState() {
  if (!state) {
    return;
  }

  for (const player of state.players) {
    const isLeft = player.team === 0;
    const fill = isLeft ? "#2d6fff" : "#ff4a45";

    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    if (state.selected && player.team === myTeam && state.selected[myTeam] === player.id) {
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffe45e";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if (player.hasBall) {
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const shirt = String(Number(player.id.split("-")[1]) + 1);
    const fontSize = Math.max(12, Math.round(player.radius * 0.72));
    ctx.font = `${fontSize}px Trebuchet MS`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(shirt, player.x, player.y + 0.5);
  }

  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#f8f8f8";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#111";
  ctx.stroke();

  if (gameActive && pendingCursor) {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(pendingCursor.x, pendingCursor.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pendingCursor.x - 14, pendingCursor.y);
    ctx.lineTo(pendingCursor.x + 14, pendingCursor.y);
    ctx.moveTo(pendingCursor.x, pendingCursor.y - 14);
    ctx.lineTo(pendingCursor.x, pendingCursor.y + 14);
    ctx.stroke();
  }

  if (state.goalPause) {
    if (goalOverlayState.stage !== state.goalPause.stage) {
      goalOverlayState.stage = state.goalPause.stage;
      if (state.goalPause.stage === "goal") {
        playGoalAudio();
        playGoalGif();
      } else {
        hideGoalGif();
      }
    }

    if (state.goalPause.stage === "score") {
      const leftFlag = extractFlag(state.profiles?.[0]?.country);
      const rightFlag = extractFlag(state.profiles?.[1]?.country);
      ctx.fillStyle = "rgba(0,0,0,0.52)";
      ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 30px Trebuchet MS";
      ctx.fillText("SCORE", FIELD_WIDTH / 2, FIELD_HEIGHT / 2 - 76);
      ctx.font = "bold 84px Trebuchet MS";
      ctx.fillText(`${leftFlag} ${state.score[0]} - ${state.score[1]} ${rightFlag}`, FIELD_WIDTH / 2, FIELD_HEIGHT / 2 + 6);
    }
  } else if (goalOverlayState.stage !== null) {
    playWhistleAudio();
    goalOverlayState.stage = null;
    hideGoalGif();
  }
}

function render() {
  drawField();
  drawState();

  if (!state) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 24px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Start a match from the panel.", FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
  }

  window.requestAnimationFrame(render);
}

async function startCpuMatch(profile) {
  await safeLeaveSession();
  const response = await apiPost("/api/start-cpu", profile);
  token = response.token;
  myTeam = response.team;
  state = null;
  gameActive = false;
  currentMatchMode = "cpu";
  roomCodeBox.classList.add("hidden");
  hideResultOverlay();
  hideGoalGif();
  setStatus("Starting CPU match...");
  startPolling();
}

modeCpuBtn.addEventListener("click", () => setMode("cpu"));
modeOnlineBtn.addEventListener("click", () => setMode("online"));

startCpuBtn.addEventListener("click", async () => {
  const profile = profilePayload();
  const cpuCountry = randomCpuCountry();
  try {
    await ensureAssetsPreloaded({
      leftCountry: profile.country,
      rightCountry: cpuCountry
    });
    await startCpuMatch({
      ...profile,
      cpuCountry
    });
  } catch (err) {
    showMenu();
    setStatus(err.message || "Failed to start CPU match.", true);
  }
});

createBtn.addEventListener("click", async () => {
  const profile = profilePayload();
  try {
    setStatus("Generating 4-digit room code...");
    await ensureAssetsPreloaded({
      leftCountry: profile.country,
      rightCountry: "Unknown"
    });
    await safeLeaveSession();
    const response = await apiPost("/api/create-online", profile);
    const safeCode = normalizeCode4(response.code);
    if (!/^\d{4}$/.test(safeCode)) {
      throw new Error("Failed to generate a valid 4-digit room code.");
    }
    token = response.token;
    myTeam = response.team;
    state = null;
    gameActive = false;
    currentMatchMode = "online";
    roomCodeBox.textContent = `Room code: ${safeCode}`;
    roomCodeBox.classList.remove("hidden");
    codeInput.value = safeCode;
    hideResultOverlay();
    showMenu();
    setStatus(`Room ${safeCode} created. Waiting for another player...`);
    startPolling();
  } catch (err) {
    showMenu();
    setStatus(err.message || "Failed to create room.", true);
  }
});

joinBtn.addEventListener("click", async () => {
  const code = codeInput.value.replace(/\D/g, "").slice(0, 4);
  if (code.length !== 4) {
    setStatus("Enter a valid 4-digit room code.", true);
    return;
  }

  const profile = profilePayload();
  try {
    await ensureAssetsPreloaded({
      leftCountry: profile.country,
      rightCountry: "Unknown"
    });
    await safeLeaveSession();
    const response = await apiPost("/api/join-online", {
      ...profile,
      code
    });
    token = response.token;
    myTeam = response.team;
    state = null;
    gameActive = false;
    currentMatchMode = "online";
    roomCodeBox.classList.add("hidden");
    hideResultOverlay();
    setStatus(`Joined room ${code}. Loading match...`);
    startPolling();
  } catch (err) {
    showMenu();
    setStatus(err.message || "Failed to join room.", true);
  }
});

codeInput.addEventListener("input", () => {
  codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 4);
});

canvas.addEventListener("mousemove", (event) => {
  if (!gameActive) {
    return;
  }
  pendingCursor = worldPosFromMouse(event);
});

canvas.addEventListener("click", (event) => {
  if (!gameActive) {
    return;
  }
  const pos = worldPosFromMouse(event);
  sendClick(pos.x, pos.y);
});

window.addEventListener("keydown", (event) => {
  if (!gameActive || !token) {
    return;
  }

  if (isTypingTarget(event)) {
    return;
  }

  const key = event.key.toLowerCase();
  if (key === "arrowup" || key === "w") {
    keyboardMove.up = true;
    event.preventDefault();
    return;
  }
  if (key === "arrowdown" || key === "s") {
    keyboardMove.down = true;
    event.preventDefault();
    return;
  }
  if (key === "arrowleft" || key === "a") {
    keyboardMove.left = true;
    event.preventDefault();
    return;
  }
  if (key === "arrowright" || key === "d") {
    keyboardMove.right = true;
    event.preventDefault();
    return;
  }

  if (event.code === "Space") {
    if (event.repeat) {
      event.preventDefault();
      return;
    }
    const carrier = getMyBallCarrier();
    if (carrier) {
      const actionPoint = pendingCursor || { x: carrier.x, y: carrier.y };
      sendAction(actionPoint.x, actionPoint.y);
    }
    event.preventDefault();
    return;
  }

  if (event.key === "1" || event.key === "2" || event.key === "3") {
    if (event.repeat) {
      event.preventDefault();
      return;
    }
    const number = Number(event.key);
    sendSelect(number);
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key === "arrowup" || key === "w") {
    keyboardMove.up = false;
    event.preventDefault();
  } else if (key === "arrowdown" || key === "s") {
    keyboardMove.down = false;
    event.preventDefault();
  } else if (key === "arrowleft" || key === "a") {
    keyboardMove.left = false;
    event.preventDefault();
  } else if (key === "arrowright" || key === "d") {
    keyboardMove.right = false;
    event.preventDefault();
  }
});

window.addEventListener("blur", () => {
  keyboardMove.up = false;
  keyboardMove.down = false;
  keyboardMove.left = false;
  keyboardMove.right = false;
});

window.addEventListener("pointerdown", () => {
  hasUserInteracted = true;
  syncCrowdAudio();
});

window.addEventListener("keydown", () => {
  hasUserInteracted = true;
  syncCrowdAudio();
});

crowdAudio.addEventListener("pause", () => {
  keepCrowdAlive();
});

crowdAudio.addEventListener("ended", () => {
  keepCrowdAlive();
});

setInterval(() => {
  const now = performance.now();
  const deltaMs = Math.max(0, now - lastInputTickAt);
  lastInputTickAt = now;
  updateKeyboardCursor(deltaMs);
  keepCrowdAlive();

  if (!gameActive || !pendingCursor || !token) {
    return;
  }

  if (now - lastCursorSentAt < 30) {
    return;
  }
  sendInput(pendingCursor.x, pendingCursor.y);
  lastCursorSentAt = now;
}, 16);

window.addEventListener("beforeunload", () => {
  if (!token) {
    return;
  }
  const blob = new Blob([JSON.stringify({ token })], {
    type: "application/json"
  });
  navigator.sendBeacon(apiUrl("/api/leave"), blob);
});

playAgainBtn.addEventListener("click", async () => {
  await safeLeaveSession();
  state = null;
  pendingCursor = null;
  stopCrowdAudio();
  hideResultOverlay();
  goalOverlayState.stage = null;
  hideGoalGif();
  showMenu();
  setMode(currentMatchMode === "online" ? "online" : "cpu");
});

populateCountries();
setMode("cpu");
render();
void preloadOnInitialLaunch();
