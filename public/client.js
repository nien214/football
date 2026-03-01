const FIELD_WIDTH = 1000;
const FIELD_HEIGHT = 620;
const GOAL_WIDTH = 150;
const GOAL_LINE_INSET = 80;
const GOAL_NET_DEPTH = 170;
const GOAL_BOX_DEPTH = 150;
const GOAL_BOX_HEIGHT = 240;
const BALL_RADIUS = 7;
const BALL_MAX_TELEPORT_DISTANCE = 120;
const BALL_SPIN_DAMPING = 0.92;
const BALL_MIN_SPIN_SPEED = 0.12;
const DIRECT_CONTROL_LOOKAHEAD = 150;
const DIRECT_ACTION_DISTANCE = 220;
const VSTICK_SENSITIVITY = 1.35;
const VSTICK_RESPONSE_EXP = 0.75;
const SERVER_CONNECT_RETRY_MS = 1500;
const STATE_POLL_MS = 40;
const REAL_MATCH_MS = 2 * 60 * 1000;
const VIRTUAL_MATCH_SECONDS = 90 * 60;
const SPRITE_FACING_OFFSET = Math.PI / 2;
const HAND_POSE_INTERVAL_MS = 220;
const PRELOAD_ASSET_TIMEOUT_MS = 15000;
const REMOTE_API_BASE = "https://football-2kxo.onrender.com";
const IS_LOCAL_HOST =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "0.0.0.0";
const ONLINE_API_BASE = IS_LOCAL_HOST ? "" : REMOTE_API_BASE;
const CPU_API_BASE = IS_LOCAL_HOST ? "" : "http://127.0.0.1:3000";

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
const inputModeInputs = Array.from(document.querySelectorAll("input[name='inputMode']"));
const cpuControls = document.getElementById("cpuControls");
const onlineControls = document.getElementById("onlineControls");
const startCpuBtn = document.getElementById("startCpuBtn");
const serverConnStatus = document.getElementById("serverConnStatus");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const codeInput = document.getElementById("codeInput");
const roomCodeBox = document.getElementById("roomCodeBox");
const howToPlayBtn = document.getElementById("howToPlayBtn");
const closeHowToPlayBtn = document.getElementById("closeHowToPlayBtn");
const howToPlayOverlay = document.getElementById("howToPlayOverlay");
const goalGifOverlay = document.getElementById("goalGifOverlay");
const goalGif = document.getElementById("goalGif");
const pauseOverlay = document.getElementById("pauseOverlay");
const pauseContinueBtn = document.getElementById("pauseContinueBtn");
const pauseEndBtn = document.getElementById("pauseEndBtn");
const preloadOverlay = document.getElementById("preloadOverlay");
const preloadLoading = document.getElementById("preloadLoading");
const preloadDots = document.getElementById("preloadDots");
const preloadLoadingWord = preloadLoading
  ? preloadLoading.querySelector(".preload-loading-word")
  : null;
const virtualControls = document.getElementById("virtualControls");
const vstickBase = document.getElementById("vstickBase");
const vstickKnob = document.getElementById("vstickKnob");
const vActionBtn = document.getElementById("vActionBtn");
const vBtn1 = document.getElementById("vBtn1");
const vBtn2 = document.getElementById("vBtn2");
const vBtn3 = document.getElementById("vBtn3");
const vPauseBtn = document.getElementById("vPauseBtn");
const cpuDifficultyInputs = Array.from(
  document.querySelectorAll("input[name='cpuDifficulty']")
);

const canvas = document.getElementById("pitch");
const ctx = canvas.getContext("2d");
const appRoot = document.querySelector(".app");

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
  "assets/bra_celeb8.gif",
  "assets/esp_celeb1.gif",
  "assets/fra_celeb1.gif",
  "assets/fra_celeb2.gif",
  "assets/ita_celeb1.gif",
  "assets/kor_celeb1.gif",
  "assets/ned_celeb1.gif",
  "assets/por_celeb1.gif"
];
function isBrazilGif(src) {
  return String(src || "")
    .toLowerCase()
    .includes("/bra_");
}

function isArgentinaGif(src) {
  return String(src || "")
    .toLowerCase()
    .includes("/arg_");
}

const BRAZIL_GIFS = CELEBRATION_GIFS.filter((src) =>
  isBrazilGif(src)
);
const ARGENTINA_GIFS = CELEBRATION_GIFS.filter((src) =>
  isArgentinaGif(src)
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
let inputMode = "mouse";
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
let crowdMuted = false;
let hasUserInteracted = false;
let assetsReady = false;
let assetsPreloadPromise = null;
let preloadDotsTimer = null;
let preloadDotCount = 0;
let hasPlayedEndWarningWhistle = false;
let hasPlayedFinalWhistle = false;
let onlineStartFlowInFlight = false;
let onlineStartReadySent = false;
let onlineStartRoomCode = "";
let serverConnected = false;
let serverConnectRetryTimer = null;
let serverConnectInFlight = false;
let audioUnlocked = false;
const sfxStopTimers = new WeakMap();
const goalOverlayState = {
  stage: null
};
const halftimeOverlayState = {
  active: false
};
const usedGoalGifs = new Set();
const keyboardMove = {
  up: false,
  down: false,
  left: false,
  right: false
};
const virtualStick = {
  pointerId: null,
  x: 0,
  y: 0
};
const playerAnimCache = new Map();
const ballAnim = {
  sampleX: null,
  sampleY: null,
  sampleAt: 0,
  lastFrameAt: 0,
  heading: 0,
  rollAngle: 0,
  spinSpeed: 0
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resetBallAnimation(nowMs = performance.now()) {
  ballAnim.sampleX = null;
  ballAnim.sampleY = null;
  ballAnim.sampleAt = nowMs;
  ballAnim.lastFrameAt = nowMs;
  ballAnim.heading = 0;
  ballAnim.rollAngle = 0;
  ballAnim.spinSpeed = 0;
}

function updateBallAnimation(ball, nowMs) {
  if (!ball || !Number.isFinite(ball.x) || !Number.isFinite(ball.y)) {
    resetBallAnimation(nowMs);
    return;
  }

  if (!Number.isFinite(ballAnim.sampleX) || !Number.isFinite(ballAnim.sampleY)) {
    ballAnim.sampleX = ball.x;
    ballAnim.sampleY = ball.y;
    ballAnim.sampleAt = nowMs;
    ballAnim.lastFrameAt = nowMs;
    return;
  }

  const frameDt = clamp((nowMs - ballAnim.lastFrameAt) / 1000, 1 / 240, 0.12);
  ballAnim.lastFrameAt = nowMs;

  const dx = ball.x - ballAnim.sampleX;
  const dy = ball.y - ballAnim.sampleY;
  const distance = Math.hypot(dx, dy);

  if (distance > 0.001) {
    if (distance > BALL_MAX_TELEPORT_DISTANCE) {
      ballAnim.sampleX = ball.x;
      ballAnim.sampleY = ball.y;
      ballAnim.sampleAt = nowMs;
      ballAnim.spinSpeed = 0;
      return;
    }
    const sampleDt = clamp((nowMs - ballAnim.sampleAt) / 1000, 1 / 120, 0.28);
    const rollStep = distance / BALL_RADIUS;
    ballAnim.heading = Math.atan2(dy, dx);
    ballAnim.rollAngle = (ballAnim.rollAngle + rollStep) % (Math.PI * 2);
    const measuredSpin = rollStep / sampleDt;
    ballAnim.spinSpeed = ballAnim.spinSpeed * 0.48 + measuredSpin * 0.52;
    ballAnim.sampleX = ball.x;
    ballAnim.sampleY = ball.y;
    ballAnim.sampleAt = nowMs;
    return;
  }

  if (Math.abs(ballAnim.spinSpeed) > BALL_MIN_SPIN_SPEED) {
    const damping = Math.pow(BALL_SPIN_DAMPING, frameDt * 60);
    ballAnim.spinSpeed *= damping;
    ballAnim.rollAngle = (ballAnim.rollAngle + ballAnim.spinSpeed * frameDt) % (Math.PI * 2);
  } else {
    ballAnim.spinSpeed = 0;
  }
}

function drawPentagon(cx, cy, radius, rotation, fillStyle, strokeStyle, lineWidth) {
  ctx.beginPath();
  for (let i = 0; i < 5; i += 1) {
    const angle = rotation + (i * Math.PI * 2) / 5;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = strokeStyle;
  ctx.stroke();
}

function drawSoccerBall(ball, nowMs) {
  updateBallAnimation(ball, nowMs);

  const x = ball.x;
  const y = ball.y;
  const dirX = Math.cos(ballAnim.heading);
  const dirY = Math.sin(ballAnim.heading);
  const rollShift = Math.sin(ballAnim.rollAngle) * BALL_RADIUS * 0.34;
  const textureShiftX = -dirX * rollShift;
  const textureShiftY = -dirY * rollShift;

  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(
    x + dirX * 0.8,
    y + BALL_RADIUS * 0.95,
    BALL_RADIUS * 0.95,
    BALL_RADIUS * 0.42,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.translate(x, y);

  const shellGradient = ctx.createRadialGradient(
    -BALL_RADIUS * 0.3 + Math.cos(ballAnim.rollAngle * 0.5) * BALL_RADIUS * 0.08,
    -BALL_RADIUS * 0.44 + Math.sin(ballAnim.rollAngle * 0.34) * BALL_RADIUS * 0.06,
    BALL_RADIUS * 0.22,
    0,
    0,
    BALL_RADIUS * 1.06
  );
  shellGradient.addColorStop(0, "#ffffff");
  shellGradient.addColorStop(0.6, "#f2f2f2");
  shellGradient.addColorStop(1, "#c8c8c8");

  ctx.beginPath();
  ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = shellGradient;
  ctx.fill();
  ctx.lineWidth = 0.1;
  ctx.strokeStyle = "#111";
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, BALL_RADIUS - 0.35, 0, Math.PI * 2);
  ctx.clip();

  ctx.translate(textureShiftX, textureShiftY);
  ctx.rotate(ballAnim.rollAngle * 0.38);

  const panelFill = "#101010";
  const panelStroke = "rgba(255,255,255,0.22)";
  drawPentagon(
    0,
    0,
    BALL_RADIUS * 0.31,
    -Math.PI / 2 + ballAnim.rollAngle * 0.18,
    panelFill,
    panelStroke,
    0.72
  );

  const ringRadius = BALL_RADIUS * 0.67;
  for (let i = 0; i < 5; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5 + ballAnim.rollAngle * 0.2;
    const px = Math.cos(angle) * ringRadius;
    const py = Math.sin(angle) * ringRadius;
    drawPentagon(px, py, BALL_RADIUS * 0.21, angle + Math.PI / 5, panelFill, panelStroke, 0.6);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * BALL_RADIUS * 0.24, Math.sin(angle) * BALL_RADIUS * 0.24);
    ctx.lineTo(px * 0.78, py * 0.78);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "rgba(17,17,17,0.28)";
    ctx.stroke();
  }

  ctx.restore();

  const gloss = ctx.createRadialGradient(
    -BALL_RADIUS * 0.45,
    -BALL_RADIUS * 0.52,
    BALL_RADIUS * 0.05,
    -BALL_RADIUS * 0.3,
    -BALL_RADIUS * 0.36,
    BALL_RADIUS * 0.9
  );
  gloss.addColorStop(0, "rgba(255,255,255,0.8)");
  gloss.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.arc(0, 0, BALL_RADIUS * 0.96, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function extractFlag(countryText) {
  const text = String(countryText || "").trim();
  if (!text) {
    return "🏳️";
  }
  const first = text.split(/\s+/)[0];
  return first.length <= 6 ? first : "🏳️";
}

function isBrazilCountry(countryText) {
  const text = String(countryText || "");
  const lower = text.toLowerCase();
  return text.includes("🇧🇷") || lower.includes("brazil");
}

function isArgentinaCountry(countryText) {
  const text = String(countryText || "");
  const lower = text.toLowerCase();
  return text.includes("🇦🇷") || lower.includes("argentina");
}

function setStatus(text, isError = false) {
  if (text === lastStatus && statusText.dataset.error === (isError ? "1" : "0")) {
    return;
  }
  statusText.textContent = text;
  statusText.dataset.error = isError ? "1" : "0";
  lastStatus = text;
}

function setServerConnectionStatus(connected) {
  if (!serverConnStatus) {
    return;
  }
  serverConnStatus.dataset.state = connected ? "connected" : "connecting";
  serverConnStatus.textContent = connected
    ? "Connected to server."
    : "Connecting to the server...";
}

function scheduleServerConnectionProbe(delayMs = 0) {
  if (serverConnected || serverConnectRetryTimer !== null) {
    return;
  }
  serverConnectRetryTimer = window.setTimeout(() => {
    serverConnectRetryTimer = null;
    void probeServerConnection();
  }, Math.max(0, delayMs));
}

async function probeServerConnection() {
  if (serverConnected || serverConnectInFlight) {
    return;
  }
  serverConnectInFlight = true;
  try {
    const response = await fetch(apiUrl("/health"), {
      method: "GET",
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error("Server unavailable");
    }
    const json = await response.json().catch(() => ({}));
    if (json && json.ok === false) {
      throw new Error("Server unavailable");
    }
    serverConnected = true;
    setServerConnectionStatus(true);
  } catch (err) {
    setServerConnectionStatus(false);
  } finally {
    serverConnectInFlight = false;
    if (!serverConnected) {
      scheduleServerConnectionProbe(SERVER_CONNECT_RETRY_MS);
    }
  }
}

function startServerConnectionWatch() {
  if (serverConnectRetryTimer !== null) {
    clearTimeout(serverConnectRetryTimer);
    serverConnectRetryTimer = null;
  }
  serverConnected = false;
  setServerConnectionStatus(false);
  scheduleServerConnectionProbe(0);
}

function resolveRequestMode(requestMode = null) {
  if (requestMode === "cpu" || requestMode === "online") {
    return requestMode;
  }
  if (token) {
    return currentMatchMode === "online" ? "online" : "cpu";
  }
  return mode === "online" ? "online" : "cpu";
}

function apiBaseForMode(requestMode = null) {
  const resolvedMode = resolveRequestMode(requestMode);
  return resolvedMode === "online" ? ONLINE_API_BASE : CPU_API_BASE;
}

function apiUrl(path, requestMode = null) {
  return `${apiBaseForMode(requestMode)}${path}`;
}

function normalizeCode4(raw) {
  return String(raw || "").replace(/\D/g, "").slice(0, 4);
}

function normalizeInputMode(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "keyboard" || value === "vstick") {
    return value;
  }
  return "mouse";
}

function isMouseInputMode() {
  return inputMode === "mouse";
}

function isVStickInputMode() {
  return inputMode === "vstick";
}

function isPortraitViewport() {
  return window.matchMedia("(orientation: portrait)").matches;
}

function isLikelyMobileBrowser() {
  const ua = String(navigator.userAgent || "").toLowerCase();
  const mobileUa = /android|iphone|ipod|blackberry|mobile|windows phone/.test(ua);
  const iPadLike =
    /ipad/.test(ua) ||
    (navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1);
  const coarseTouch = window.matchMedia("(pointer: coarse)").matches;
  return mobileUa || iPadLike || coarseTouch;
}

function shouldShowVirtualControls() {
  return gameActive && isVStickInputMode() && isLikelyMobileBrowser();
}

function updateFieldLayout() {
  const viewportW = Math.max(320, window.innerWidth || document.documentElement.clientWidth || 0);
  const viewportH = Math.max(320, window.innerHeight || document.documentElement.clientHeight || 0);
  const portrait = viewportH >= viewportW;
  const controlsVisible = shouldShowVirtualControls();
  const landscapeVStick = controlsVisible && !portrait;
  const sideSpace = landscapeVStick
    ? Math.round(clamp(viewportW * 0.24, 140, 280))
    : 0;
  let reservedHeight = portrait ? 148 : 86;
  if (controlsVisible) {
    reservedHeight += portrait ? 330 : 70;
  }
  const maxByHeight = ((viewportH - reservedHeight) * FIELD_WIDTH) / FIELD_HEIGHT;
  const maxByWidth = viewportW - (portrait ? 16 : 20) - sideSpace * 2;
  const fieldMaxWidth = Math.floor(clamp(Math.min(1000, maxByHeight, maxByWidth), 280, 1000));
  document.documentElement.style.setProperty("--field-max-width", `${fieldMaxWidth}px`);
  document.documentElement.style.setProperty("--landscape-side-space", `${sideSpace}px`);
}

function resetVirtualStick() {
  virtualStick.pointerId = null;
  virtualStick.x = 0;
  virtualStick.y = 0;
  if (vstickKnob) {
    vstickKnob.style.transform = "translate(-50%, -50%)";
  }
}

function syncVirtualControls() {
  const showVirtualControls = shouldShowVirtualControls();
  if (virtualControls) {
    virtualControls.classList.toggle("hidden", !showVirtualControls);
  }
  if (appRoot) {
    appRoot.classList.toggle("vstick-active", showVirtualControls);
  }
  if (!showVirtualControls) {
    resetVirtualStick();
  }
  updateFieldLayout();
}

function setInputMode(nextMode) {
  inputMode = normalizeInputMode(nextMode);
  for (const input of inputModeInputs) {
    input.checked = normalizeInputMode(input.value) === inputMode;
  }
  syncVirtualControls();
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
  updateFieldLayout();
  startServerConnectionWatch();
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
      if (name === "Argentina") {
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

function getCpuDifficulty() {
  const selected = cpuDifficultyInputs.find((input) => input.checked);
  if (!selected) {
    return "easy";
  }
  const value = String(selected.value || "").toLowerCase();
  if (value === "hard" || value === "medium") {
    return value;
  }
  return "easy";
}

function randomCpuCountry() {
  const index = Math.floor(Math.random() * CPU_COUNTRIES.length);
  return CPU_COUNTRIES[index] || "🇧🇷 Brazil";
}

function getHumanPlayerNumber(player) {
  if (!player || player.team !== myTeam) {
    return "";
  }
  const idText = String(player.id || "");
  const parts = idText.split("-");
  const rawIndex = Number(parts[1]);
  if (!Number.isFinite(rawIndex)) {
    return "";
  }
  const number = Math.trunc(rawIndex) + 1;
  if (number < 1 || number > 3) {
    return "";
  }
  return String(number);
}

function clearKeyboardMove() {
  keyboardMove.up = false;
  keyboardMove.down = false;
  keyboardMove.left = false;
  keyboardMove.right = false;
}

function isPausedState() {
  return Boolean(state && state.paused);
}

function showPauseOverlay() {
  if (pauseOverlay) {
    pauseOverlay.classList.remove("hidden");
  }
}

function hidePauseOverlay() {
  if (pauseOverlay) {
    pauseOverlay.classList.add("hidden");
  }
}

function syncPauseOverlay() {
  if (gameActive && isPausedState()) {
    showPauseOverlay();
    clearKeyboardMove();
    return;
  }
  hidePauseOverlay();
}

function showPreloadOverlay() {
  if (!preloadOverlay || !preloadLoading || !preloadDots) {
    return;
  }

  if (preloadLoadingWord) {
    preloadLoadingWord.textContent = "Loading assets";
  }
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
  if (preloadLoadingWord) {
    preloadLoadingWord.textContent = "LOADING";
  }
  if (preloadOverlay) {
    preloadOverlay.classList.add("hidden");
  }
}

function updatePreloadOverlayProgress(loaded, total) {
  if (!preloadLoadingWord) {
    return;
  }
  const safeLoaded = Math.max(0, Math.trunc(loaded));
  const safeTotal = Math.max(0, Math.trunc(total));
  preloadLoadingWord.textContent = `Loading assets ${safeLoaded}/${safeTotal}`;
}

function preloadSingleAsset(url) {
  const lower = String(url).toLowerCase();
  if (lower.endsWith(".gif")) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let settled = false;
      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
      };
      const finish = (err = null) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      };
      const timeoutId = window.setTimeout(() => {
        finish(new Error(`Timed out loading asset: ${url}`));
      }, PRELOAD_ASSET_TIMEOUT_MS);
      img.onload = () => {
        clearTimeout(timeoutId);
        finish();
      };
      img.onerror = () => {
        clearTimeout(timeoutId);
        finish(new Error(`Failed to load asset: ${url}`));
      };
      img.src = url;
    });
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err = null) => {
      if (settled) {
        return;
      }
      settled = true;
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    };
    const timeoutId = window.setTimeout(() => {
      finish(new Error(`Timed out loading asset: ${url}`));
    }, PRELOAD_ASSET_TIMEOUT_MS);
    fetch(url, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load asset: ${url}`);
        }
        return response.arrayBuffer();
      })
      .then(() => {
        clearTimeout(timeoutId);
        finish();
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        finish(err);
      });
  });
}

async function ensureAssetsPreloaded(preview = null) {
  if (assetsReady) {
    return;
  }

  showPreloadOverlay();

  try {
    if (assetsPreloadPromise) {
      await assetsPreloadPromise;
      return;
    }

    const total = REQUIRED_ASSETS.length;
    let loaded = 0;

    updatePreloadOverlayProgress(0, total);
    assetsPreloadPromise = Promise.all(
      REQUIRED_ASSETS.map(async (url) => {
        await preloadSingleAsset(url);
        loaded += 1;
        updatePreloadOverlayProgress(loaded, total);
      })
    );
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
  if (crowdMuted) {
    crowdAudio.pause();
    return;
  }

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
  if (!crowdShouldPlay || !hasUserInteracted || crowdMuted) {
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

function unlockSingleAudio(audio) {
  if (!audio) {
    return;
  }
  const wasMuted = Boolean(audio.muted);
  const wasVolume = Number.isFinite(audio.volume) ? audio.volume : 1;
  try {
    audio.muted = true;
    audio.volume = 0;
    audio.currentTime = 0;
    const attempt = audio.play();
    const finalize = () => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (err) {
        // Ignore media reset errors.
      }
      audio.muted = wasMuted;
      audio.volume = wasVolume;
    };
    if (attempt && typeof attempt.then === "function") {
      attempt.then(finalize).catch(finalize);
    } else {
      finalize();
    }
  } catch (err) {
    audio.muted = wasMuted;
    audio.volume = wasVolume;
  }
}

function unlockAudioPlayback() {
  if (audioUnlocked) {
    return;
  }
  audioUnlocked = true;
  const allAudio = [crowdAudio, ...goalSfxPool, ...whistleSfxPool];
  const seen = new Set();
  for (const audio of allAudio) {
    if (!audio || seen.has(audio)) {
      continue;
    }
    seen.add(audio);
    unlockSingleAudio(audio);
  }
}

function clearSfxStopTimer(sfx) {
  const previousTimer = sfxStopTimers.get(sfx);
  if (previousTimer) {
    clearTimeout(previousTimer);
    sfxStopTimers.delete(sfx);
  }
}

function scheduleSfxStop(sfx, maxDurationMs) {
  if (!(maxDurationMs > 0)) {
    return;
  }
  clearSfxStopTimer(sfx);
  const timer = window.setTimeout(() => {
    try {
      sfx.pause();
      sfx.currentTime = 0;
    } catch (err) {
      // Ignore media reset errors.
    }
    sfxStopTimers.delete(sfx);
  }, maxDurationMs);
  sfxStopTimers.set(sfx, timer);
}

function toggleCrowdMute() {
  crowdMuted = !crowdMuted;
  if (crowdMuted) {
    // Stop any in-flight goal sound immediately when crowd is muted.
    stopSfxPoolNow(goalSfxPool);
  }
  syncCrowdAudio();
  if (gameActive) {
    setStatus(
      crowdMuted ? "Crowd sound muted. Press C to unmute." : "Crowd sound on."
    );
  }
}

function playSfxParallel(templateAudio, maxDurationMs = 0) {
  if (!hasUserInteracted) {
    return null;
  }

  const pool = templateAudio;
  if (!Array.isArray(pool) || pool.length === 0) {
    return null;
  }

  const preferred = pool.find((audio) => audio.paused || audio.ended) || pool[0];
  const order = [preferred, ...pool.filter((audio) => audio !== preferred)];
  const tried = new Set();

  const tryPlay = (sfx) => {
    if (!sfx || tried.has(sfx)) {
      return;
    }
    tried.add(sfx);
    clearSfxStopTimer(sfx);

    try {
      sfx.pause();
      sfx.currentTime = 0;
    } catch (err) {
      // Ignore media reset errors and still attempt play.
    }

    let playAttempt = null;
    try {
      playAttempt = sfx.play();
    } catch (err) {
      playAttempt = null;
    }

    const tryFallback = () => {
      const next = order.find((candidate) => !tried.has(candidate));
      if (next) {
        tryPlay(next);
      }
    };

    if (playAttempt && typeof playAttempt.then === "function") {
      playAttempt
        .then(() => {
          scheduleSfxStop(sfx, maxDurationMs);
        })
        .catch(() => {
          tryFallback();
        });
      return;
    }

    scheduleSfxStop(sfx, maxDurationMs);
  }
  tryPlay(preferred);
  return preferred;
}

function stopSfxPoolNow(pool) {
  if (!Array.isArray(pool) || pool.length === 0) {
    return;
  }
  for (const sfx of pool) {
    clearSfxStopTimer(sfx);
    try {
      sfx.pause();
      sfx.currentTime = 0;
    } catch (err) {
      // Ignore media reset errors.
    }
  }
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

function pickUnplayedGoalGif(pool) {
  if (!Array.isArray(pool) || pool.length === 0) {
    return null;
  }
  let choices = pool.filter((src) => !usedGoalGifs.has(src));
  if (choices.length === 0) {
    if (usedGoalGifs.size >= CELEBRATION_GIFS.length) {
      usedGoalGifs.clear();
    }
    choices = pool.slice();
  }
  const pick = choices[Math.floor(Math.random() * choices.length)];
  usedGoalGifs.add(pick);
  return pick;
}

function getEligibleGoalGifPool() {
  if (!Array.isArray(CELEBRATION_GIFS) || CELEBRATION_GIFS.length === 0) {
    return [];
  }
  const scoringTeam = Number(state?.goalPause?.scoringTeam);
  const opponentTeam = scoringTeam === 0 ? 1 : 0;
  const scorerCountry = String(state?.profiles?.[scoringTeam]?.country || "");
  const opponentCountry = String(state?.profiles?.[opponentTeam]?.country || "");

  if (isArgentinaCountry(scorerCountry)) {
    return ARGENTINA_GIFS.length > 0 ? ARGENTINA_GIFS : CELEBRATION_GIFS;
  }
  if (isBrazilCountry(scorerCountry)) {
    return BRAZIL_GIFS.length > 0 ? BRAZIL_GIFS : CELEBRATION_GIFS;
  }

  let pool = CELEBRATION_GIFS.slice();
  if (isArgentinaCountry(opponentCountry)) {
    pool = pool.filter((src) => !isArgentinaGif(src));
  }
  if (isBrazilCountry(opponentCountry)) {
    pool = pool.filter((src) => !isBrazilGif(src));
  }
  return pool.length > 0 ? pool : CELEBRATION_GIFS;
}

function playGoalGif() {
  if (!goalGifOverlay || !goalGif) {
    return;
  }
  const pool = getEligibleGoalGifPool();
  const pick = pickUnplayedGoalGif(pool);
  if (!pick) {
    return;
  }
  // Reset src first so repeated same GIF still replays from frame 1.
  goalGif.removeAttribute("src");
  goalGif.src = pick;
  goalGifOverlay.classList.remove("hidden");
}

function showMenu() {
  menu.classList.remove("hidden");
  hud.classList.add("hidden");
  goalOverlayState.stage = null;
  halftimeOverlayState.active = false;
  hidePauseOverlay();
  hideResultOverlay();
  hideGoalGif();
  usedGoalGifs.clear();
  hidePreloadOverlay();
  if (howToPlayOverlay) {
    howToPlayOverlay.classList.add("hidden");
  }
  stopCrowdAudio();
  hasPlayedEndWarningWhistle = false;
  hasPlayedFinalWhistle = false;
  resetOnlineStartFlow();
  syncVirtualControls();
}

function showGame() {
  menu.classList.add("hidden");
  hud.classList.remove("hidden");
  hidePreloadOverlay();
  syncPauseOverlay();
  syncVirtualControls();
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
  let response = null;
  try {
    response = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });
  } catch (err) {
    const requestMode = resolveRequestMode();
    if (requestMode === "cpu" && !IS_LOCAL_HOST) {
      throw new Error("Local CPU server not reachable at http://127.0.0.1:3000.");
    }
    throw err;
  }
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

async function setMatchPaused(paused) {
  if (!token || !gameActive) {
    return;
  }
  try {
    const response = await apiPost("/api/pause", { token, paused: !!paused });
    if (state) {
      state.paused = Boolean(response.paused);
    }
    syncPauseOverlay();
    setStatus(state && state.paused ? "Match paused." : "Match resumed.");
  } catch (err) {
    setStatus(err.message || "Failed to change pause state.", true);
  }
}

async function endMatchNow() {
  if (!token || !gameActive) {
    return;
  }
  try {
    await apiPost("/api/end-match", { token });
    hidePauseOverlay();
    setStatus("Ending match...");
  } catch (err) {
    setStatus(err.message || "Failed to end match.", true);
  }
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
    clearKeyboardMove();
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
    hidePauseOverlay();
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
      hasPlayedFinalWhistle = false;
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
    syncPauseOverlay();
    if (state && state.paused) {
      setStatus("Match paused.");
    } else if (payload.mode === "online") {
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
    clearKeyboardMove();
    const endedByTime = state && state.endReason === "time";
    if (endedByTime && !hasPlayedFinalWhistle) {
      playWhistleAudio();
      hasPlayedFinalWhistle = true;
    }
    stopCrowdAudio();
    goalOverlayState.stage = null;
    hideGoalGif();
    hidePauseOverlay();
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
    clearKeyboardMove();
    stopCrowdAudio();
    goalOverlayState.stage = null;
    hideGoalGif();
    hidePauseOverlay();
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

function isTextInputElement(target) {
  const tagName = target && target.tagName ? target.tagName.toLowerCase() : "";
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

function isTypingTarget(event) {
  return isTextInputElement(event && event.target);
}

function updateKeyboardCursor(deltaMs) {
  if (isMouseInputMode()) {
    return;
  }

  const selected = getSelectedPlayer();
  if (!selected) {
    if (!pendingCursor) {
      pendingCursor = { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2 };
    }
    return;
  }

  let rawDx = 0;
  let rawDy = 0;
  if (inputMode === "keyboard") {
    rawDx = (keyboardMove.right ? 1 : 0) - (keyboardMove.left ? 1 : 0);
    rawDy = (keyboardMove.down ? 1 : 0) - (keyboardMove.up ? 1 : 0);
  } else if (inputMode === "vstick") {
    rawDx = virtualStick.x;
    rawDy = virtualStick.y;
  }

  const magnitude = Math.hypot(rawDx, rawDy);
  if (magnitude <= 0.001) {
    pendingCursor = { x: selected.x, y: selected.y };
    return;
  }

  const nx = rawDx / magnitude;
  const ny = rawDy / magnitude;
  const strength = clamp(magnitude, 0, 1);
  const lookAhead = DIRECT_CONTROL_LOOKAHEAD * strength;
  pendingCursor = {
    x: clamp(selected.x + nx * lookAhead, 0, FIELD_WIDTH),
    y: clamp(selected.y + ny * lookAhead, 0, FIELD_HEIGHT)
  };
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

function sendCurrentDirectionalAction() {
  const carrier = getMyBallCarrier();
  if (!carrier) {
    return;
  }
  if (isMouseInputMode()) {
    const actionPoint = pendingCursor || { x: carrier.x, y: carrier.y };
    sendAction(actionPoint.x, actionPoint.y);
    return;
  }

  let rawDx = 0;
  let rawDy = 0;
  if (inputMode === "keyboard") {
    rawDx = (keyboardMove.right ? 1 : 0) - (keyboardMove.left ? 1 : 0);
    rawDy = (keyboardMove.down ? 1 : 0) - (keyboardMove.up ? 1 : 0);
  } else if (inputMode === "vstick") {
    rawDx = virtualStick.x;
    rawDy = virtualStick.y;
  }

  let dirX = 0;
  let dirY = 0;
  const intentLength = Math.hypot(rawDx, rawDy);
  if (intentLength > 0.001) {
    dirX = rawDx / intentLength;
    dirY = rawDy / intentLength;
  } else {
    const facingLength = Math.hypot(Number(carrier.dirX) || 0, Number(carrier.dirY) || 0);
    if (facingLength > 0.001) {
      dirX = carrier.dirX / facingLength;
      dirY = carrier.dirY / facingLength;
    } else {
      dirX = 1;
      dirY = 0;
    }
  }

  const actionPoint = {
    x: clamp(carrier.x + dirX * DIRECT_ACTION_DISTANCE, 0, FIELD_WIDTH),
    y: clamp(carrier.y + dirY * DIRECT_ACTION_DISTANCE, 0, FIELD_HEIGHT)
  };
  sendAction(actionPoint.x, actionPoint.y);
}

function updateVirtualStickFromPointer(event) {
  if (!vstickBase) {
    return;
  }
  const rect = vstickBase.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const maxRadius = Math.max(20, rect.width * 0.26);
  let dx = event.clientX - centerX;
  let dy = event.clientY - centerY;
  const distance = Math.hypot(dx, dy);
  if (distance > maxRadius) {
    const scale = maxRadius / Math.max(distance, 0.001);
    dx *= scale;
    dy *= scale;
  }

  const dirX = distance > 0.001 ? dx / distance : 0;
  const dirY = distance > 0.001 ? dy / distance : 0;
  const normalizedDistance = clamp(distance / maxRadius, 0, 1);
  const boostedMagnitude = clamp(
    Math.pow(normalizedDistance, VSTICK_RESPONSE_EXP) * VSTICK_SENSITIVITY,
    0,
    1
  );
  virtualStick.x = clamp(dirX * boostedMagnitude, -1, 1);
  virtualStick.y = clamp(dirY * boostedMagnitude, -1, 1);
  if (vstickKnob) {
    vstickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
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
  const playableLeft = GOAL_LINE_INSET;
  const playableRight = FIELD_WIDTH - GOAL_LINE_INSET;
  const playableWidth = playableRight - playableLeft;
  ctx.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  // Base grass for full canvas, including area outside the touch lines.
  ctx.fillStyle = "#2b8f4c";
  ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  // Extend the same stripe pattern beyond field lines so margins match the pitch.
  const laneWidth = playableWidth / 10;
  const stripeStartX = playableLeft - laneWidth * 2;
  const stripeCount = Math.ceil((FIELD_WIDTH - stripeStartX) / laneWidth) + 1;
  for (let i = 0; i < stripeCount; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.01)";
    ctx.fillRect(stripeStartX + laneWidth * i, 0, laneWidth, FIELD_HEIGHT);
  }

  ctx.strokeStyle = "#f6fff0";
  ctx.lineWidth = 3;
  ctx.strokeRect(playableLeft, 2, playableWidth, FIELD_HEIGHT - 4);

  ctx.beginPath();
  ctx.moveTo(FIELD_WIDTH / 2, 0);
  ctx.lineTo(FIELD_WIDTH / 2, FIELD_HEIGHT);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, 76, 0, Math.PI * 2);
  ctx.stroke();

  const goalTop = FIELD_HEIGHT / 2 - GOAL_WIDTH / 2;
  const goalBottom = goalTop + GOAL_WIDTH;
  const goalBoxTop = FIELD_HEIGHT / 2 - GOAL_BOX_HEIGHT / 2;

  // Penalty box lines from each goal line.
  ctx.strokeRect(playableLeft, goalBoxTop, GOAL_BOX_DEPTH, GOAL_BOX_HEIGHT);
  ctx.strokeRect(playableRight - GOAL_BOX_DEPTH, goalBoxTop, GOAL_BOX_DEPTH, GOAL_BOX_HEIGHT);

  function drawGoalNet(frontX, backX) {
    const left = Math.min(frontX, backX);
    const right = Math.max(frontX, backX);
    const netTop = goalTop;
    const netBottom = goalBottom;
    const netHeight = Math.max(2, netBottom - netTop);

    ctx.fillStyle = "rgba(236, 244, 250, 0.22)";
    ctx.fillRect(left, netTop + 1, right - left, netHeight - 2);

    ctx.strokeStyle = "rgba(240, 248, 255, 0.42)";
    ctx.lineWidth = 1;
    for (let x = left + 8; x < right; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, netTop + 2);
      ctx.lineTo(x, netBottom - 2);
      ctx.stroke();
    }
    for (let y = netTop + 10; y < netBottom; y += 10) {
      ctx.beginPath();
      ctx.moveTo(left + 1, y);
      ctx.lineTo(right - 1, y);
      ctx.stroke();
    }

    // Full size frame.
    ctx.strokeStyle = "#f6fff0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(frontX, netTop);
    ctx.lineTo(frontX, netBottom);
    ctx.moveTo(frontX, netTop);
    ctx.lineTo(backX, netTop);
    ctx.moveTo(frontX, netBottom);
    ctx.lineTo(backX, netBottom);
    ctx.moveTo(backX, netTop);
    ctx.lineTo(backX, netBottom);
    ctx.stroke();
  }

  drawGoalNet(playableLeft, playableLeft - GOAL_NET_DEPTH);
  drawGoalNet(playableRight, playableRight + GOAL_NET_DEPTH);
}

function getPlayerAnimationFrame(player, nowMs, forceHandSwing = false) {
  let anim = playerAnimCache.get(player.id);
  if (!anim) {
    anim = {
      lastX: player.x,
      lastY: player.y,
      dirX: player.team === 0 ? 1 : -1,
      dirY: 0,
      phase: Math.random() * Math.PI * 2,
      runBlend: 0,
      handPose: 1,
      handPoseTimer: 0,
      moveHoldMs: 0,
      lastSeenAt: nowMs
    };
    playerAnimCache.set(player.id, anim);
    return {
      dirX: anim.dirX,
      dirY: anim.dirY,
      phase: anim.phase,
      runBlend: 0,
      handPose: anim.handPose,
      handActive: false,
      moving: false,
      swing: 0
    };
  }

  const deltaMs = Math.max(1, nowMs - anim.lastSeenAt);
  const dx = player.x - anim.lastX;
  const dy = player.y - anim.lastY;
  const moved = Math.hypot(dx, dy);
  const instantMoving = moved > 0.08;

  const hasServerDir = Number.isFinite(player.dirX) && Number.isFinite(player.dirY);
  if (hasServerDir) {
    const serverLen = Math.hypot(player.dirX, player.dirY);
    if (serverLen > 0.001) {
      anim.dirX = player.dirX / serverLen;
      anim.dirY = player.dirY / serverLen;
    }
  }

  if (instantMoving) {
    const len = Math.max(0.001, moved);
    if (!hasServerDir) {
      anim.dirX = dx / len;
      anim.dirY = dy / len;
    }
    anim.moveHoldMs = 220;
  } else {
    anim.moveHoldMs = Math.max(0, (anim.moveHoldMs || 0) - deltaMs);
  }
  const moving = anim.moveHoldMs > 0;

  const targetBlend = moving ? 1 : 0;
  const blendStep = clamp(deltaMs / 200, 0, 1);
  const currentBlend = Number.isFinite(anim.runBlend) ? anim.runBlend : 0;
  anim.runBlend = currentBlend + (targetBlend - currentBlend) * blendStep;

  const handActive = moving && (Boolean(player.hasBall) || Boolean(forceHandSwing));
  if (handActive) {
    anim.handPoseTimer = (anim.handPoseTimer || 0) + deltaMs;
    if (anim.handPoseTimer >= HAND_POSE_INTERVAL_MS) {
      const flips = Math.floor(anim.handPoseTimer / HAND_POSE_INTERVAL_MS);
      anim.handPoseTimer -= flips * HAND_POSE_INTERVAL_MS;
      if (flips % 2 === 1) {
        anim.handPose = anim.handPose === -1 ? 1 : -1;
      }
    }
  } else {
    anim.handPoseTimer = 0;
  }

  anim.lastX = player.x;
  anim.lastY = player.y;
  anim.lastSeenAt = nowMs;

  anim.phase += (deltaMs / 1000) * 0.2;
  const swingBase = Math.sin(anim.phase);
  const swingScale = moving ? 1 : 0.2;
  return {
    dirX: anim.dirX,
    dirY: anim.dirY,
    phase: anim.phase,
    runBlend: anim.runBlend,
    handPose: anim.handPose,
    handActive,
    moving,
    swing: swingBase * swingScale
  };
}

function drawPlayerFigure(player, isSelected, nowMs, facingAngle, forceHandSwing = false) {
  const anim = getPlayerAnimationFrame(player, nowMs, forceHandSwing);
  const isLeft = player.team === 0;
  const shirt = isLeft ? "#1f87e5" : "#e74d3d";
  const head = "#8b4a00";
  const hand = "#ff9761";
  const r = player.radius * 1.12;
  const angle = (Number.isFinite(facingAngle) ? facingAngle : 0) + SPRITE_FACING_OFFSET;
  const runBlend = Number.isFinite(anim.runBlend) ? anim.runBlend : anim.moving ? 1 : 0;
  const handStep = anim.handPose === -1 ? -1 : 1;
  const bodyRx = r * 0.96;
  const bodyRy = r * 0.5;

  if (isSelected) {
    ctx.beginPath();
    ctx.arc(player.x, player.y, r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffe45e";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  if (player.hasBall) {
    ctx.beginPath();
    ctx.arc(player.x, player.y, r + 1.4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(angle);

  // Strict flat body style from reference.
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyRx, bodyRy, 0, 0, Math.PI * 2);
  ctx.fill();

  // Big head in the middle.
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.33, 0, Math.PI * 2);
  ctx.fill();

  const playerNumber = getHumanPlayerNumber(player);

  // Two-step hand animation only while running.
  if (anim.handActive && runBlend > 0.03) {
    const leftHandX = -bodyRx - r * 0.06;
    const rightHandX = bodyRx + r * 0.06;
    const handTopY = -r * 0.34;
    const handBottomY = r * 0.34;
    const leftHandY = handStep > 0 ? handTopY : handBottomY;
    const rightHandY = handStep > 0 ? handBottomY : handTopY;
    ctx.fillStyle = hand;
    ctx.beginPath();
    ctx.ellipse(leftHandX, leftHandY, r * 0.15, r * 0.44, 0, 0, Math.PI * 2);
    ctx.ellipse(rightHandX, rightHandY, r * 0.15, r * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  if (playerNumber) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.max(7, Math.round(r * 0.44))}px Trebuchet MS`;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(0,0,0,0.62)";
    ctx.strokeText(playerNumber, player.x, player.y + 0.4);
    ctx.fillStyle = "#f8f8f8";
    ctx.fillText(playerNumber, player.x, player.y + 0.4);
  }
}

function getFacingAngleForPlayer(player, isSelected) {
  if (!player) {
    return 0;
  }

  const celebration = state?.goalPause?.celebration;
  if (
    state?.goalPause?.stage === "goal" &&
    player.team === state.goalPause.scoringTeam &&
    celebration &&
    Number.isFinite(celebration.anchorX) &&
    Number.isFinite(celebration.anchorY)
  ) {
    const dx = celebration.anchorX - player.x;
    const dy = celebration.anchorY - player.y;
    if (Math.hypot(dx, dy) > 1) {
      return Math.atan2(dy, dx);
    }
  }

  if (isSelected && pendingCursor) {
    const dx = pendingCursor.x - player.x;
    const dy = pendingCursor.y - player.y;
    if (Math.hypot(dx, dy) > 1) {
      return Math.atan2(dy, dx);
    }
  }

  if (state?.ball) {
    const dx = state.ball.x - player.x;
    const dy = state.ball.y - player.y;
    if (Math.hypot(dx, dy) > 1) {
      return Math.atan2(dy, dx);
    }
  }

  if (Number.isFinite(player.dirX) && Number.isFinite(player.dirY)) {
    const len = Math.hypot(player.dirX, player.dirY);
    if (len > 0.001) {
      return Math.atan2(player.dirY, player.dirX);
    }
  }

  return player.team === 0 ? 0 : Math.PI;
}

function drawState() {
  if (!state) {
    halftimeOverlayState.active = false;
    resetBallAnimation();
    return;
  }

  const nowMs = performance.now();
  const activeIds = new Set(state.players.map((player) => player.id));
  for (const cachedId of playerAnimCache.keys()) {
    if (!activeIds.has(cachedId)) {
      playerAnimCache.delete(cachedId);
    }
  }

  for (const player of state.players) {
    const isSelected =
      state.selected && player.team === myTeam && state.selected[myTeam] === player.id;
    const celebratingScorer =
      state.goalPause &&
      state.goalPause.stage === "goal" &&
      player.team === state.goalPause.scoringTeam;
    const forceHandSwing = Boolean(isSelected || celebratingScorer);
    const facingAngle = getFacingAngleForPlayer(player, isSelected);
    drawPlayerFigure(player, isSelected, nowMs, facingAngle, forceHandSwing);
  }

  drawSoccerBall(state.ball, nowMs);

  if (gameActive && pendingCursor && isMouseInputMode()) {
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

  if (state.halftimePause) {
    if (!halftimeOverlayState.active) {
      halftimeOverlayState.active = true;
      playerAnimCache.clear();
      playWhistleAudio();
    }
    ctx.fillStyle = "rgba(0,0,0,0.56)";
    ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    ctx.fillStyle = "#fff2a8";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
      ctx.font = "bold 118px Trebuchet MS";
      ctx.fillText("HALF-TIME", FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
  } else if (halftimeOverlayState.active) {
    halftimeOverlayState.active = false;
    playWhistleAudio();
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
for (const input of inputModeInputs) {
  input.addEventListener("change", () => {
    if (input.checked) {
      setInputMode(input.value);
    }
  });
}

startCpuBtn.addEventListener("click", async () => {
  const profile = profilePayload();
  const cpuCountry = randomCpuCountry();
  const cpuDifficulty = getCpuDifficulty();
  try {
    await ensureAssetsPreloaded({
      leftCountry: profile.country,
      rightCountry: cpuCountry
    });
    await startCpuMatch({
      ...profile,
      cpuCountry,
      cpuDifficulty
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

function bindVirtualControlButton(button, handler) {
  if (!button) {
    return;
  }
  button.addEventListener("pointerdown", (event) => {
    if (!shouldShowVirtualControls()) {
      return;
    }
    hasUserInteracted = true;
    unlockAudioPlayback();
    syncCrowdAudio();
    event.preventDefault();
    handler();
  });
}

if (vstickBase) {
  vstickBase.addEventListener("pointerdown", (event) => {
    if (!shouldShowVirtualControls()) {
      return;
    }
    hasUserInteracted = true;
    unlockAudioPlayback();
    syncCrowdAudio();
    virtualStick.pointerId = event.pointerId;
    vstickBase.setPointerCapture(event.pointerId);
    updateVirtualStickFromPointer(event);
    event.preventDefault();
  });

  vstickBase.addEventListener("pointermove", (event) => {
    if (!shouldShowVirtualControls() || virtualStick.pointerId !== event.pointerId) {
      return;
    }
    updateVirtualStickFromPointer(event);
    event.preventDefault();
  });

  const stopStick = (event) => {
    if (virtualStick.pointerId !== event.pointerId) {
      return;
    }
    resetVirtualStick();
    event.preventDefault();
  };
  vstickBase.addEventListener("pointerup", stopStick);
  vstickBase.addEventListener("pointercancel", stopStick);
}

bindVirtualControlButton(vActionBtn, () => {
  sendCurrentDirectionalAction();
});
bindVirtualControlButton(vBtn1, () => sendSelect(1));
bindVirtualControlButton(vBtn2, () => sendSelect(2));
bindVirtualControlButton(vBtn3, () => sendSelect(3));
bindVirtualControlButton(vPauseBtn, () => {
  void setMatchPaused(!isPausedState());
});

canvas.addEventListener("mousemove", (event) => {
  if (!gameActive || isPausedState() || !isMouseInputMode()) {
    return;
  }
  pendingCursor = worldPosFromMouse(event);
});

canvas.addEventListener("click", (event) => {
  if (!gameActive || isPausedState() || !isMouseInputMode()) {
    return;
  }
  const pos = worldPosFromMouse(event);
  sendClick(pos.x, pos.y);
});

window.addEventListener("contextmenu", (event) => {
  if (!gameActive) {
    return;
  }
  const target = event.target;
  const inVirtualControls = Boolean(
    virtualControls && target instanceof Node && virtualControls.contains(target)
  );
  if (target === canvas || inVirtualControls) {
    event.preventDefault();
  }
});

window.addEventListener("keydown", (event) => {
  if (!gameActive || !token) {
    return;
  }

  if (isTypingTarget(event)) {
    return;
  }

  const key = event.key.toLowerCase();
  if (key === "c") {
    if (event.repeat) {
      event.preventDefault();
      return;
    }
    toggleCrowdMute();
    event.preventDefault();
    return;
  }

  if (event.key === "Enter") {
    if (event.repeat) {
      event.preventDefault();
      return;
    }
    void setMatchPaused(!isPausedState());
    event.preventDefault();
    return;
  }

  if (isPausedState()) {
    event.preventDefault();
    return;
  }

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
    sendCurrentDirectionalAction();
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
  clearKeyboardMove();
  resetVirtualStick();
});

window.addEventListener("pointerdown", () => {
  hasUserInteracted = true;
  unlockAudioPlayback();
  syncCrowdAudio();
});

window.addEventListener("keydown", () => {
  hasUserInteracted = true;
  unlockAudioPlayback();
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
  if (gameActive && !isPausedState()) {
    updateKeyboardCursor(deltaMs);
  }
  keepCrowdAlive();

  if (!gameActive || !pendingCursor || !token || isPausedState()) {
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
  hidePauseOverlay();
  hideResultOverlay();
  goalOverlayState.stage = null;
  hideGoalGif();
  showMenu();
  setMode(currentMatchMode === "online" ? "online" : "cpu");
});

if (pauseContinueBtn) {
  pauseContinueBtn.addEventListener("click", () => {
    void setMatchPaused(false);
  });
}

if (pauseEndBtn) {
  pauseEndBtn.addEventListener("click", () => {
    void endMatchNow();
  });
}

if (howToPlayBtn) {
  howToPlayBtn.addEventListener("click", () => {
    if (!howToPlayOverlay) {
      return;
    }
    howToPlayOverlay.classList.remove("hidden");
  });
}

if (closeHowToPlayBtn) {
  closeHowToPlayBtn.addEventListener("click", () => {
    if (!howToPlayOverlay) {
      return;
    }
    howToPlayOverlay.classList.add("hidden");
  });
}

if (howToPlayOverlay) {
  howToPlayOverlay.addEventListener("click", (event) => {
    if (event.target === howToPlayOverlay) {
      howToPlayOverlay.classList.add("hidden");
    }
  });
}

window.addEventListener("resize", () => {
  syncVirtualControls();
});

window.addEventListener("orientationchange", () => {
  window.setTimeout(() => {
    syncVirtualControls();
  }, 80);
});

document.addEventListener("contextmenu", (event) => {
  if (isTextInputElement(event.target)) {
    return;
  }
  event.preventDefault();
});

document.addEventListener("selectstart", (event) => {
  if (isTextInputElement(event.target)) {
    return;
  }
  event.preventDefault();
});

document.addEventListener("dragstart", (event) => {
  if (isTextInputElement(event.target)) {
    return;
  }
  event.preventDefault();
});

window.addEventListener(
  "gesturestart",
  (event) => {
    event.preventDefault();
  },
  { passive: false }
);

window.addEventListener(
  "gesturechange",
  (event) => {
    event.preventDefault();
  },
  { passive: false }
);

window.addEventListener(
  "gestureend",
  (event) => {
    event.preventDefault();
  },
  { passive: false }
);

window.addEventListener(
  "touchmove",
  (event) => {
    if (event.touches && event.touches.length > 1) {
      event.preventDefault();
    }
  },
  { passive: false }
);

let lastTouchEndAt = 0;
window.addEventListener(
  "touchend",
  (event) => {
    const now = Date.now();
    if (now - lastTouchEndAt < 320) {
      event.preventDefault();
    }
    lastTouchEndAt = now;
  },
  { passive: false }
);

populateCountries();
setMode("cpu");
const initialInputMode = isLikelyMobileBrowser()
  ? "vstick"
  : inputModeInputs.find((input) => input.checked)?.value || "mouse";
setInputMode(initialInputMode);
render();
void preloadOnInitialLaunch();
