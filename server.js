const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const ASSETS_DIR = path.join(__dirname, "assets");

const TICK_RATE = 30;
const DT = 1 / TICK_RATE;
const MATCH_TIME_MS = 2 * 60 * 1000;
const SESSION_TIMEOUT_MS = 30000;
const ROOM_CLEANUP_MS = 15000;
const POSSESSION_PROTECTION_MS = 1000;
const GOAL_GIF_MS = 2600;
const GOAL_SCORE_MS = 1650;
const KICKOFF_DELAY_MS = 3000;
const HALFTIME_BREAK_MS = 3000;
const HALFTIME_CLOCK_MS = MATCH_TIME_MS / 2;

const FIELD = {
  width: 1000,
  height: 620,
  goalWidth: 150
};

const GOAL_LINE_INSET = 80;
const GOAL_NET_DEPTH = 170;
const GOAL_LINE_SHOT_FALLOFF_START = 120;
const GOAL_LINE_SHOT_FALLOFF_RANGE =
  FIELD.width - GOAL_LINE_INSET * 2 - GOAL_LINE_SHOT_FALLOFF_START;

const BALL_RADIUS = 7;
const PLAYER_RADIUS = 19;
const CLICK_SELECT_RADIUS = PLAYER_RADIUS + 9;
const OUTFIELD_SPEED = 120;
const DEFENDER_SPEED = 110;
const PASS_SPEED = 280;
const SHOT_SPEED = 360;
const BALL_CARRIER_SPEED_MULTIPLIER = 0.99;
const BALL_CARRY_PULSE_AMPLITUDE = 2.7;
const BALL_CARRY_PULSE_FREQ = 0.022;
const BALL_CARRY_LATERAL_AMPLITUDE = 1.35;
const BALL_CARRY_LATERAL_FREQ = 0.017;
const LONG_TRAVEL_CURVE_START = FIELD.width * 0.25;
const LONG_TRAVEL_CURVE_RANGE = FIELD.width * 0.75;
const CURVE_TURN_RATE_MIN = 0.14;
const CURVE_TURN_RATE_MAX = 0.34;
const CURVE_MIN_FLIGHT_MS = 380;
const CURVE_MAX_FLIGHT_MS = 1250;
const FAR_SHOT_MAX_ANGLE_DEG = 10;
const PLAYER_CHEMISTRY_BY_INDEX = Object.freeze([
  // Footballer #1: Defender
  { speedScale: 1.0, controlScale: 0.9, shotAccuracy: 0.7 },
  // Footballer #2: Mid field
  { speedScale: 0.9, controlScale: 0.9, shotAccuracy: 0.9 },
  // Footballer #3: Striker
  { speedScale: 0.8, controlScale: 0.8, shotAccuracy: 1.0 }
]);
const DEFAULT_PLAYER_CHEMISTRY = PLAYER_CHEMISTRY_BY_INDEX[1];

const LEFT_FORMATION = [
  { x: 180, y: FIELD.height / 2, role: "F" },
  { x: 300, y: 190, role: "F" },
  { x: 300, y: FIELD.height - 190, role: "F" }
];

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

const CPU_DIFFICULTY_PROFILES = {
  easy: {
    outfieldSpeedScale: 0.8,
    defenderSpeedScale: 0.78,
    shotDistance: 165,
    shotSpread: 130,
    shotSpeedScale: 0.82,
    shotDecisionCooldownMs: 1250,
    carrierAdvance: 155,
    carrierSpeedScale: 0.95,
    possessionPush: 125,
    defendRetreat: 70,
    looseBallSpeedScale: 0.98,
    pressSpeedScale: 1,
    pressCount: 1,
    postStealDecisionDelayMs: 280,
    tackleReachCpuDelta: -2.2,
    tackleReachVsCpuDelta: 1.8,
    requireOpenLane: false,
    openLaneMinClearance: 0
  },
  medium: {
    outfieldSpeedScale: 0.86,
    defenderSpeedScale: 0.9,
    shotDistance: 185,
    shotSpread: 95,
    shotSpeedScale: 0.9,
    shotDecisionCooldownMs: 1020,
    carrierAdvance: 145,
    carrierSpeedScale: 0.94,
    possessionPush: 85,
    defendRetreat: 120,
    looseBallSpeedScale: 1.02,
    pressSpeedScale: 1.04,
    pressCount: 1,
    postStealDecisionDelayMs: 240,
    tackleReachCpuDelta: -0.8,
    tackleReachVsCpuDelta: 0.6,
    requireOpenLane: true,
    openLaneMinClearance: 24
  },
  hard: {
    outfieldSpeedScale: 1.12,
    defenderSpeedScale: 1.14,
    shotDistance: 250,
    shotSpread: 45,
    shotSpeedScale: 1.16,
    shotDecisionCooldownMs: 620,
    carrierAdvance: 195,
    carrierSpeedScale: 1.16,
    possessionPush: 150,
    defendRetreat: 88,
    looseBallSpeedScale: 1.2,
    pressSpeedScale: 1.3,
    pressCount: 2,
    postStealDecisionDelayMs: 90,
    tackleReachCpuDelta: 2.8,
    tackleReachVsCpuDelta: -1.6,
    requireOpenLane: true,
    openLaneMinClearance: 14,
    longShotDistance: 390,
    longShotMinClearance: 16,
    passMinLaneClearance: 11
  }
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg"
};

const rooms = new Map();
const sessions = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function rotateVector(x, y, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: x * c - y * s,
    y: x * s + y * c
  };
}

function getLongTravelRatio(distance) {
  if (distance <= LONG_TRAVEL_CURVE_START) {
    return 0;
  }
  return clamp((distance - LONG_TRAVEL_CURVE_START) / LONG_TRAVEL_CURVE_RANGE, 0, 1);
}

function createCurveProfile(distance, speed, now) {
  const ratio = getLongTravelRatio(distance);
  if (ratio <= 0) {
    return { turnRate: 0, until: 0 };
  }
  // Curve direction is random on every long kick.
  const randomDirection = Math.random() < 0.5 ? -1 : 1;
  const turnRate =
    randomDirection *
    (CURVE_TURN_RATE_MIN + (CURVE_TURN_RATE_MAX - CURVE_TURN_RATE_MIN) * ratio);
  const curveFlightMs = clamp(
    (distance / Math.max(speed, 1)) * 1000 * 0.72,
    CURVE_MIN_FLIGHT_MS,
    CURVE_MAX_FLIGHT_MS
  );
  return { turnRate, until: now + curveFlightMs };
}

function getPlayerChemistry(player) {
  const index = player && Number.isInteger(player.index) ? player.index : -1;
  return PLAYER_CHEMISTRY_BY_INDEX[index] || DEFAULT_PLAYER_CHEMISTRY;
}

function getDistanceToAttackGoalLine(room, player) {
  if (!player) {
    return FIELD.width * 0.5;
  }
  const attackGoalLineX = getAttackingGoalLineX(room, player.team);
  return Math.abs(attackGoalLineX - player.x);
}

function applyFarShotInaccuracy(room, dx, dy, player) {
  const distanceToGoalLine = getDistanceToAttackGoalLine(room, player);
  const ratio = clamp(
    (distanceToGoalLine - GOAL_LINE_SHOT_FALLOFF_START) / GOAL_LINE_SHOT_FALLOFF_RANGE,
    0,
    1
  );
  if (ratio <= 0) {
    return { dx, dy };
  }
  const chemistry = getPlayerChemistry(player);
  const accuracyAmplifier = 1 / clamp(chemistry.shotAccuracy, 0.35, 1.2);
  const maxAngle = ((1.5 + FAR_SHOT_MAX_ANGLE_DEG * ratio) * accuracyAmplifier * Math.PI) / 180;
  const angleOffset = (Math.random() * 2 - 1) * maxAngle;
  const rotated = rotateVector(dx, dy, angleOffset);
  return { dx: rotated.x, dy: rotated.y };
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeProfile(raw) {
  const safe = raw || {};
  const name = (typeof safe.name === "string" ? safe.name : "")
    .trim()
    .slice(0, 18) || "Player";
  const country = (typeof safe.country === "string" ? safe.country : "")
    .trim()
    .slice(0, 40) || "Unknown";
  return { name, country };
}

function normalizeCpuDifficulty(raw) {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  if (value === "hard" || value === "medium") {
    return value;
  }
  return "easy";
}

function generateRoomCode() {
  for (let i = 0; i < 10000; i += 1) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    if (!rooms.has(code)) {
      return code;
    }
  }
  return null;
}

function isValidRoomCode(code) {
  return typeof code === "string" && /^\d{4}$/.test(code);
}

function randomCpuCountry() {
  const index = Math.floor(Math.random() * CPU_COUNTRIES.length);
  return CPU_COUNTRIES[index] || "🇧🇷 Brazil";
}

function createTeam(team) {
  return LEFT_FORMATION.map((slot, index) => {
    const x = team === 0 ? slot.x : FIELD.width - slot.x;
    return {
      id: `${team}-${index}`,
      team,
      index,
      role: slot.role,
      x,
      y: slot.y,
      baseX: x,
      baseY: slot.y,
      targetX: x,
      targetY: slot.y,
      radius: PLAYER_RADIUS,
      dirX: team === 0 ? 1 : -1,
      dirY: 0,
      hasBall: false,
      kickLockUntil: 0,
      moveSpeed: DEFENDER_SPEED
    };
  });
}

function createRoom(mode, code = null) {
  const teams = [createTeam(0), createTeam(1)];
  const allPlayers = [...teams[0], ...teams[1]];
  const playerById = {};
  for (const player of allPlayers) {
    playerById[player.id] = player;
  }

  const room = {
    id: code || `cpu-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    code,
    mode,
    cpuDifficulty: "easy",
    sessionTokens: [null, null],
    profiles: [
      { name: "Player 1", country: "Unknown" },
      mode === "cpu"
        ? { name: "CPU", country: randomCpuCountry() }
        : { name: "Player 2", country: "Unknown" }
    ],
    inputs: [
      {
        cursor: { x: FIELD.width * 0.35, y: FIELD.height / 2 },
        selectedId: "0-1",
        clicks: []
      },
      {
        cursor: { x: FIELD.width * 0.65, y: FIELD.height / 2 },
        selectedId: "1-1",
        clicks: []
      }
    ],
    teams,
    allPlayers,
    playerById,
    ball: {
      x: FIELD.width / 2,
      y: FIELD.height / 2,
      vx: 0,
      vy: 0,
      curveTurnRate: 0,
      curveUntil: 0,
      radius: BALL_RADIUS,
      ownerId: null,
      lastTouchTeam: 0,
      lockUntil: 0,
      stealLockUntil: 0
    },
    score: [0, 0],
    timeLeftMs: MATCH_TIME_MS,
    sidesFlipped: false,
    openingKickoffTeam: 0,
    halftimePlayed: false,
    halftimePause: null,
    started: false,
    ready: [false, false],
    kickoffUntil: 0,
    paused: false,
    ended: false,
    endedAt: 0,
    endReason: null,
    abandonedTeam: null,
    nextAiDecisionAt: [0, 0],
    goalPause: null
  };

  resetForKickoff(room, 0, Date.now());
  return room;
}

function isTeamOnLeftSide(room, team) {
  if (room && room.sidesFlipped) {
    return team === 1;
  }
  return team === 0;
}

function getTeamAttackDirection(room, team) {
  return isTeamOnLeftSide(room, team) ? 1 : -1;
}

function getAttackingGoalLineX(room, team) {
  return getTeamAttackDirection(room, team) > 0
    ? FIELD.width - GOAL_LINE_INSET
    : GOAL_LINE_INSET;
}

function getTeamScoringOnLeftGoal(room) {
  return room && room.sidesFlipped ? 0 : 1;
}

function getTeamScoringOnRightGoal(room) {
  return room && room.sidesFlipped ? 1 : 0;
}

function isHumanTeam(room, team) {
  return room.mode === "online" ? true : team === 0;
}

function isCpuTeam(room, team) {
  return room.mode === "cpu" && team === 1;
}

function getCpuDifficultyProfile(room) {
  const key = normalizeCpuDifficulty(room && room.cpuDifficulty);
  return CPU_DIFFICULTY_PROFILES[key] || CPU_DIFFICULTY_PROFILES.easy;
}

function getOutfieldSpeedForTeam(room, team) {
  if (!isCpuTeam(room, team)) {
    return OUTFIELD_SPEED;
  }
  const profile = getCpuDifficultyProfile(room);
  return OUTFIELD_SPEED * profile.outfieldSpeedScale;
}

function getDefenderSpeedForTeam(room, team) {
  if (!isCpuTeam(room, team)) {
    return DEFENDER_SPEED;
  }
  const profile = getCpuDifficultyProfile(room);
  return DEFENDER_SPEED * profile.defenderSpeedScale;
}

function getPlayerOutfieldSpeed(room, player) {
  if (!player) {
    return OUTFIELD_SPEED;
  }
  if (isCpuTeam(room, player.team) && normalizeCpuDifficulty(room.cpuDifficulty) === "hard") {
    return OUTFIELD_SPEED * 1.02;
  }
  return getOutfieldSpeedForTeam(room, player.team) * getPlayerChemistry(player).speedScale;
}

function getPlayerDefenderSpeed(room, player) {
  if (!player) {
    return DEFENDER_SPEED;
  }
  if (isCpuTeam(room, player.team) && normalizeCpuDifficulty(room.cpuDifficulty) === "hard") {
    return DEFENDER_SPEED * 1.02;
  }
  return getDefenderSpeedForTeam(room, player.team) * getPlayerChemistry(player).speedScale;
}

function applyCarrySpeedRule(room, player, baseSpeed) {
  if (!player || !player.hasBall) {
    return baseSpeed;
  }
  return baseSpeed * BALL_CARRIER_SPEED_MULTIPLIER;
}

function getBallOwner(room) {
  if (!room.ball.ownerId) {
    return null;
  }
  return room.playerById[room.ball.ownerId] || null;
}

function setBallOwner(room, player, now) {
  for (const p of room.allPlayers) {
    p.hasBall = false;
  }

  if (!player) {
    room.ball.ownerId = null;
    return;
  }

  player.hasBall = true;
  room.ball.ownerId = player.id;
  room.ball.lastTouchTeam = player.team;
  room.ball.vx = 0;
  room.ball.vy = 0;
  room.ball.curveTurnRate = 0;
  room.ball.curveUntil = 0;
  room.ball.x = player.x + player.dirX * (player.radius + room.ball.radius + 1);
  room.ball.y = player.y + player.dirY * (player.radius + room.ball.radius + 1);
  room.ball.lockUntil = now + 120;
  room.ball.stealLockUntil = now + POSSESSION_PROTECTION_MS;

  if (isHumanTeam(room, player.team) && player.role === "F") {
    room.inputs[player.team].selectedId = player.id;
  }
}

function releaseBall(room, vx, vy, now, curveProfile = null) {
  const owner = getBallOwner(room);
  if (owner) {
    owner.hasBall = false;
    owner.kickLockUntil = now + 180;
    room.ball.x = owner.x + owner.dirX * (owner.radius + room.ball.radius + 1);
    room.ball.y = owner.y + owner.dirY * (owner.radius + room.ball.radius + 1);
  }

  room.ball.ownerId = null;
  room.ball.vx = vx;
  room.ball.vy = vy;
  room.ball.curveTurnRate = curveProfile ? curveProfile.turnRate : 0;
  room.ball.curveUntil = curveProfile ? curveProfile.until : 0;
  room.ball.lockUntil = now + 120;
  room.ball.stealLockUntil = 0;
}

function passBall(room, from, to, now, speed = PASS_SPEED) {
  if (!from || !to || !from.hasBall) {
    return false;
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const curveProfile = createCurveProfile(distance, speed, now);
  releaseBall(
    room,
    (dx / distance) * speed,
    (dy / distance) * speed,
    now,
    curveProfile
  );
  room.ball.lastTouchTeam = from.team;
  room.nextAiDecisionAt[from.team] = now + 280;
  return true;
}

function shootBall(room, from, targetX, targetY, now, speed = SHOT_SPEED) {
  if (!from || !from.hasBall) {
    return false;
  }
  const dx = targetX - from.x;
  const dy = targetY - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const inaccurate = applyFarShotInaccuracy(room, dx, dy, from);
  const aimedDistance = Math.hypot(inaccurate.dx, inaccurate.dy) || 1;
  const curveProfile = createCurveProfile(distance, speed, now);
  releaseBall(
    room,
    (inaccurate.dx / aimedDistance) * speed,
    (inaccurate.dy / aimedDistance) * speed,
    now,
    curveProfile
  );
  room.ball.lastTouchTeam = from.team;
  room.nextAiDecisionAt[from.team] = now + 480;
  return true;
}

function resetForKickoff(room, kickoffTeam, now, kickoffDelayMs = KICKOFF_DELAY_MS) {
  for (const player of room.allPlayers) {
    const slot = LEFT_FORMATION[player.index] || LEFT_FORMATION[0];
    const onLeft = isTeamOnLeftSide(room, player.team);
    player.baseX = onLeft ? slot.x : FIELD.width - slot.x;
    player.baseY = slot.y;
    player.x = player.baseX;
    player.y = player.baseY;
    player.targetX = player.baseX;
    player.targetY = player.baseY;
    player.moveSpeed = getPlayerDefenderSpeed(room, player);
    player.hasBall = false;
    player.kickLockUntil = 0;
    player.dirX = getTeamAttackDirection(room, player.team);
    player.dirY = 0;
  }

  room.inputs[0].selectedId = "0-1";
  room.inputs[1].selectedId = "1-1";
  room.inputs[0].clicks = [];
  room.inputs[1].clicks = [];
  room.inputs[0].cursor = { x: room.teams[0][1].x, y: room.teams[0][1].y };
  room.inputs[1].cursor = { x: room.teams[1][1].x, y: room.teams[1][1].y };

  const centerY = FIELD.height / 2;
  const attackers = room.teams[kickoffTeam];
  const defenders = room.teams[1 - kickoffTeam];
  const kickoffPlayer = attackers[attackers.length - 1];
  const support = attackers[attackers.length - 2] || attackers[0];
  const opponent = defenders[defenders.length - 1] || defenders[0];

  if (!kickoffPlayer || !support || !opponent) {
    return;
  }

  const kickoffDirection = getTeamAttackDirection(room, kickoffTeam);
  kickoffPlayer.x = FIELD.width / 2 - kickoffDirection * 28;
  kickoffPlayer.y = centerY;
  kickoffPlayer.targetX = kickoffPlayer.x;
  kickoffPlayer.targetY = kickoffPlayer.y;
  kickoffPlayer.dirX = kickoffDirection;
  kickoffPlayer.dirY = 0;

  support.x = FIELD.width / 2 - kickoffDirection * 85;
  support.y = centerY + 52;
  support.targetX = support.x;
  support.targetY = support.y;

  opponent.x = FIELD.width / 2 + kickoffDirection * 85;
  opponent.y = centerY;
  opponent.targetX = opponent.x;
  opponent.targetY = opponent.y;

  setBallOwner(room, kickoffPlayer, now);
  const kickoffBallOffset = kickoffPlayer.radius + room.ball.radius + 1;
  room.ball.x = kickoffPlayer.x + kickoffPlayer.dirX * kickoffBallOffset;
  room.ball.y = kickoffPlayer.y + kickoffPlayer.dirY * kickoffBallOffset;
  room.ball.vx = 0;
  room.ball.vy = 0;
  room.ball.curveTurnRate = 0;
  room.ball.curveUntil = 0;
  room.ball.lockUntil = now + 180;
  room.kickoffUntil = now + Math.max(0, kickoffDelayMs);
}

function scoreGoal(room, scoringTeam, now) {
  const playableLeft = GOAL_LINE_INSET;
  const playableRight = FIELD.width - GOAL_LINE_INSET;
  const celebrateTop = Math.random() < 0.5;
  const anchorX = scoringTeam === 0 ? playableRight - 30 : playableLeft + 30;
  const anchorY = celebrateTop ? 34 : FIELD.height - 34;
  const scorers = room.teams[scoringTeam];
  const phaseOffsets = scorers.map((_, index) =>
    (index / Math.max(1, scorers.length)) * Math.PI * 2
  );

  room.score[scoringTeam] += 1;
  room.goalPause = {
    stage: "goal",
    scoringTeam,
    kickoffTeam: 1 - scoringTeam,
    startedAt: now,
    goalUntil: now + GOAL_GIF_MS,
    scoreUntil: now + GOAL_GIF_MS + GOAL_SCORE_MS,
    celebration: {
      anchorX,
      anchorY,
      gatherUntil: now + 700,
      orbitRadiusX: 34,
      orbitRadiusY: 24,
      spinRate: 0.0068,
      phaseOffsets
    }
  };

  for (const player of room.allPlayers) {
    player.hasBall = false;
  }
  room.ball.ownerId = null;
  room.ball.vx = 0;
  room.ball.vy = 0;
  room.ball.curveTurnRate = 0;
  room.ball.curveUntil = 0;
  room.ball.lockUntil = now + 120;
  room.ball.stealLockUntil = 0;
  room.inputs[0].clicks = [];
  room.inputs[1].clicks = [];
}

function getClosestOutfield(room, team, x, y) {
  let best = null;
  let bestDistance = Infinity;

  for (const player of room.teams[team]) {
    if (player.role !== "F") {
      continue;
    }
    const d = dist2(player.x, player.y, x, y);
    if (d < bestDistance) {
      bestDistance = d;
      best = player;
    }
  }

  return best;
}

function getClosestOutfields(room, team, x, y, count) {
  const outfields = room.teams[team]
    .filter((player) => player.role === "F")
    .map((player) => ({
      player,
      distance: dist2(player.x, player.y, x, y)
    }))
    .sort((a, b) => a.distance - b.distance);

  return outfields.slice(0, count).map((entry) => entry.player);
}

function getNearestOpponentDistance(room, player) {
  let best = Infinity;
  for (const opponent of room.teams[1 - player.team]) {
    const d = Math.hypot(opponent.x - player.x, opponent.y - player.y);
    if (d < best) {
      best = d;
    }
  }
  return best;
}

function getBestForwardTarget(room, team, from) {
  const direction = getTeamAttackDirection(room, team);
  let best = null;
  let bestScore = -Infinity;

  for (const player of room.teams[team]) {
    if (player.id === from.id || player.role !== "F") {
      continue;
    }
    const progress = (player.x - from.x) * direction;
    const lanePenalty = Math.abs(player.y - from.y) * 0.35;
    const score = progress - lanePenalty;
    if (score > bestScore) {
      bestScore = score;
      best = player;
    }
  }

  if (best) {
    return best;
  }
  return room.teams[team].find((p) => p.role === "F" && p.id !== from.id) || null;
}

function getBestHardPassOption(room, from) {
  const team = from.team;
  const direction = getTeamAttackDirection(room, team);
  let best = null;
  let bestScore = -Infinity;

  for (const mate of room.teams[team]) {
    if (mate.id === from.id || mate.role !== "F") {
      continue;
    }

    const progress = (mate.x - from.x) * direction;
    const laneClearance = getShotLaneClearance(room, team, from.x, from.y, mate.x, mate.y);
    const receiverSpace = getNearestOpponentDistance(room, mate);
    const diagonalOffset = Math.abs(mate.y - from.y);
    const score =
      (progress >= 0 ? progress * 1.3 : progress * 0.3) +
      laneClearance * 2.2 +
      receiverSpace * 0.75 +
      diagonalOffset * 0.18;

    if (score > bestScore) {
      bestScore = score;
      best = {
        target: mate,
        score,
        progress,
        laneClearance,
        receiverSpace
      };
    }
  }

  return best;
}

function distancePointToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 <= 1e-6) {
    return Math.hypot(px - ax, py - ay);
  }
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / len2, 0, 1);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

function getShotLaneClearance(room, team, fromX, fromY, toX, toY) {
  let minDistance = Infinity;
  for (const opponent of room.teams[1 - team]) {
    const d = distancePointToSegment(opponent.x, opponent.y, fromX, fromY, toX, toY);
    if (d < minDistance) {
      minDistance = d;
    }
  }
  return minDistance;
}

function pickSmartShotY(room, player, attackGoalX, spread) {
  const centerY = FIELD.height / 2;
  const topY = FIELD.height / 2 - FIELD.goalWidth / 2 + 16;
  const bottomY = FIELD.height / 2 + FIELD.goalWidth / 2 - 16;
  const boundedSpread = clamp(spread, 24, FIELD.goalWidth / 2 - 16);
  const candidates = [
    centerY,
    clamp(centerY - boundedSpread, topY, bottomY),
    clamp(centerY + boundedSpread, topY, bottomY),
    clamp(centerY - boundedSpread * 0.55, topY, bottomY),
    clamp(centerY + boundedSpread * 0.55, topY, bottomY)
  ];

  let bestY = centerY;
  let bestClearance = -Infinity;

  for (const y of candidates) {
    const clearance = getShotLaneClearance(room, player.team, player.x, player.y, attackGoalX, y);
    if (clearance > bestClearance) {
      bestClearance = clearance;
      bestY = y;
    }
  }

  return {
    y: bestY,
    clearance: bestClearance
  };
}

function pickHardShotY(room, player, attackGoalX, spread) {
  const centerY = FIELD.height / 2;
  const topY = FIELD.height / 2 - FIELD.goalWidth / 2 + 16;
  const bottomY = FIELD.height / 2 + FIELD.goalWidth / 2 - 16;
  const boundedSpread = clamp(spread, 24, FIELD.goalWidth / 2 - 16);
  const preferredDiagonal = player.y <= centerY ? bottomY : topY;
  const candidates = [
    preferredDiagonal,
    topY,
    bottomY,
    clamp(preferredDiagonal + (preferredDiagonal === bottomY ? -1 : 1) * boundedSpread * 0.45, topY, bottomY),
    centerY
  ];

  let bestY = preferredDiagonal;
  let bestClearance = -Infinity;
  let bestScore = -Infinity;

  for (const y of candidates) {
    const clearance = getShotLaneClearance(room, player.team, player.x, player.y, attackGoalX, y);
    const diagonalBias = Math.abs(y - player.y) * 0.23;
    const score = clearance + diagonalBias;
    if (score > bestScore) {
      bestScore = score;
      bestClearance = clearance;
      bestY = y;
    }
  }

  return {
    y: bestY,
    clearance: bestClearance
  };
}

function handleTeamClick(room, team, x, y, now) {
  if (!isHumanTeam(room, team)) {
    return;
  }

  const input = room.inputs[team];

  const selected = room.playerById[input.selectedId] || room.teams[team][1];
  const teammates = room.teams[team].filter((p) => p.role === "F");

  let clickedMate = null;
  let minDistance = CLICK_SELECT_RADIUS * CLICK_SELECT_RADIUS;

  for (const mate of teammates) {
    const d = dist2(x, y, mate.x, mate.y);
    if (d < minDistance) {
      minDistance = d;
      clickedMate = mate;
    }
  }

  if (clickedMate) {
    if (selected.hasBall && clickedMate.id !== selected.id) {
      passBall(room, selected, clickedMate, now);
    } else {
      input.selectedId = clickedMate.id;
    }
    return;
  }

  if (selected.hasBall) {
    shootBall(room, selected, x, y, now);
  }
}

function handleDirectionalAction(room, team, x, y, now) {
  if (!isHumanTeam(room, team)) {
    return false;
  }

  const carrier = room.teams[team].find((player) => player.hasBall) || null;
  if (!carrier) {
    return false;
  }

  let clickedMate = null;
  let minDistance = CLICK_SELECT_RADIUS * CLICK_SELECT_RADIUS;
  for (const mate of room.teams[team]) {
    if (mate.id === carrier.id) {
      continue;
    }
    const d = dist2(x, y, mate.x, mate.y);
    if (d < minDistance) {
      minDistance = d;
      clickedMate = mate;
    }
  }

  if (clickedMate) {
    return passBall(room, carrier, clickedMate, now);
  }
  return shootBall(room, carrier, x, y, now);
}

function passToTeammateNumber(room, team, number, now) {
  if (!isHumanTeam(room, team)) {
    return false;
  }

  const from = room.teams[team].find((player) => player.hasBall) || null;
  if (!from) {
    return false;
  }

  const index = number - 1;
  const target = room.teams[team][index];
  if (!target || target.id === from.id) {
    return false;
  }

  return passBall(room, from, target, now);
}

function runAiCarrierLogic(room, player, now) {
  const team = player.team;
  const cpuTeam = isCpuTeam(room, team);
  const cpuProfile = cpuTeam ? getCpuDifficultyProfile(room) : null;
  const cpuDifficulty = cpuTeam ? normalizeCpuDifficulty(room.cpuDifficulty) : "easy";
  const attackGoalX = getTeamAttackDirection(room, team) > 0 ? FIELD.width + 30 : -30;
  const attackGoalY = FIELD.height / 2;
  const distanceToGoal = Math.hypot(attackGoalX - player.x, attackGoalY - player.y);
  const shotDistance = cpuProfile ? cpuProfile.shotDistance : 210;
  const decisionCooldown = cpuProfile ? cpuProfile.shotDecisionCooldownMs : 920;

  if (now >= room.nextAiDecisionAt[team]) {
    if (cpuTeam) {
      if (cpuDifficulty === "easy") {
        if (distanceToGoal < shotDistance) {
          const spread = (Math.random() - 0.5) * cpuProfile.shotSpread;
          const shotY = clamp(
            attackGoalY + spread,
            FIELD.height / 2 - FIELD.goalWidth / 2 + 16,
            FIELD.height / 2 + FIELD.goalWidth / 2 - 16
          );
          shootBall(room, player, attackGoalX, shotY, now, SHOT_SPEED * cpuProfile.shotSpeedScale);
          room.nextAiDecisionAt[team] = now + decisionCooldown;
          return;
        }
      } else if (cpuDifficulty === "medium") {
        const picked = pickSmartShotY(room, player, attackGoalX, cpuProfile.shotSpread);
        const canShoot =
          distanceToGoal < shotDistance &&
          (!cpuProfile.requireOpenLane || picked.clearance >= cpuProfile.openLaneMinClearance);
        if (canShoot) {
          shootBall(room, player, attackGoalX, picked.y, now, SHOT_SPEED * cpuProfile.shotSpeedScale);
          room.nextAiDecisionAt[team] = now + decisionCooldown;
          return;
        }
      } else {
        const pressure = getNearestOpponentDistance(room, player);
        const passOption = getBestHardPassOption(room, player);
        const hardShot = pickHardShotY(room, player, attackGoalX, cpuProfile.shotSpread);
        const canNormalShot =
          distanceToGoal < shotDistance && hardShot.clearance >= cpuProfile.openLaneMinClearance;
        const canLongShot =
          distanceToGoal < (cpuProfile.longShotDistance || 320) &&
          hardShot.clearance >= (cpuProfile.longShotMinClearance || 26);

        const canComboPass =
          passOption &&
          passOption.laneClearance >= (cpuProfile.passMinLaneClearance || 16) &&
          passOption.progress > 8;

        if (canComboPass) {
          const forcePass = pressure < 72;
          const proactivePass = distanceToGoal > 180 && passOption.progress > 18 && Math.random() < 0.76;
          const setupPass = canLongShot && passOption.receiverSpace > 30 && Math.random() < 0.56;
          const directAssistChance =
            distanceToGoal > 150 && passOption.progress > 14 && passOption.receiverSpace > 52;
          if (forcePass || proactivePass || setupPass || directAssistChance) {
            passBall(room, player, passOption.target, now, PASS_SPEED * 1.2);
            room.nextAiDecisionAt[team] = now + 250;
            return;
          }
        }

        if (canNormalShot || (canLongShot && Math.random() < 0.62)) {
          shootBall(room, player, attackGoalX, hardShot.y, now, SHOT_SPEED * cpuProfile.shotSpeedScale);
          room.nextAiDecisionAt[team] = now + decisionCooldown;
          return;
        }

        // Hard mode can still offload quickly when heavily pressured.
        if (pressure < 62) {
          const forward = getBestForwardTarget(room, team, player);
          if (forward) {
            const direction = getTeamAttackDirection(room, team);
            const progress = (forward.x - player.x) * direction;
            if (progress > 4 && passBall(room, player, forward, now, PASS_SPEED * 1.14)) {
              room.nextAiDecisionAt[team] = now + 320;
              return;
            }
          }
        }
      }
    } else if (distanceToGoal < shotDistance) {
      const spread = (Math.random() - 0.5) * 80;
      const shotY = clamp(
        attackGoalY + spread,
        FIELD.height / 2 - FIELD.goalWidth / 2 + 16,
        FIELD.height / 2 + FIELD.goalWidth / 2 - 16
      );
      shootBall(room, player, attackGoalX, shotY, now, SHOT_SPEED);
      room.nextAiDecisionAt[team] = now + decisionCooldown;
      return;
    }
  }

  const direction = getTeamAttackDirection(room, team);
  const laneOffset = (player.baseY - attackGoalY) * 0.18;
  player.targetX = clamp(
    player.x + direction * (cpuProfile ? cpuProfile.carrierAdvance : 170),
    40,
    FIELD.width - 40
  );
  player.targetY = clamp(
    attackGoalY + laneOffset + (room.ball.y - attackGoalY) * 0.08,
    40,
    FIELD.height - 40
  );
  const aiCarryBaseSpeed =
    getPlayerOutfieldSpeed(room, player) * (cpuProfile ? cpuProfile.carrierSpeedScale : 1);
  player.moveSpeed = applyCarrySpeedRule(room, player, aiCarryBaseSpeed);
}

function isOnOpponentHalf(room, player) {
  if (!player) {
    return false;
  }
  const direction = getTeamAttackDirection(room, player.team);
  return direction > 0 ? player.x > FIELD.width / 2 : player.x < FIELD.width / 2;
}

function getAssistPartnerIndex(playerIndex) {
  if (playerIndex === 1) {
    return 2;
  }
  if (playerIndex === 2) {
    return 1;
  }
  return -1;
}

function startHalftimeBreak(room, now) {
  room.timeLeftMs = HALFTIME_CLOCK_MS;
  room.halftimePlayed = true;
  room.halftimePause = {
    stage: "halftime",
    startedAt: now,
    until: now + HALFTIME_BREAK_MS,
    kickoffTeam: 1 - room.openingKickoffTeam
  };
  room.kickoffUntil = 0;
  room.ball.lockUntil = now + HALFTIME_BREAK_MS;
  room.ball.stealLockUntil = now + HALFTIME_BREAK_MS;
  room.inputs[0].clicks = [];
  room.inputs[1].clicks = [];
  for (const player of room.allPlayers) {
    player.targetX = player.x;
    player.targetY = player.y;
    player.moveSpeed = 0;
  }
}

function completeHalftimeBreak(room, now) {
  const nextKickoffTeam = room.halftimePause ? room.halftimePause.kickoffTeam : 0;
  room.halftimePause = null;
  room.sidesFlipped = !room.sidesFlipped;
  resetForKickoff(room, nextKickoffTeam, now + 40, KICKOFF_DELAY_MS);
}

function setOutfieldTarget(room, player, context, now) {
  const team = player.team;
  const input = room.inputs[team];
  const human = isHumanTeam(room, team);
  const cpuTeam = isCpuTeam(room, team);
  const cpuProfile = cpuTeam ? getCpuDifficultyProfile(room) : null;
  const cpuDifficulty = cpuTeam ? normalizeCpuDifficulty(room.cpuDifficulty) : "easy";
  const isSelected = human && input.selectedId === player.id;
  const outfieldSpeed = getPlayerOutfieldSpeed(room, player);
  const defenderSpeed = getPlayerDefenderSpeed(room, player);

  if (isSelected) {
    player.targetX = clamp(input.cursor.x, 0, FIELD.width);
    player.targetY = clamp(input.cursor.y, 0, FIELD.height);
    player.moveSpeed = applyCarrySpeedRule(room, player, outfieldSpeed);
    return;
  }

  if (player.hasBall) {
    runAiCarrierLogic(room, player, now);
    return;
  }

  if (
    context.owner &&
    context.owner.team === team &&
    context.owner.role === "F" &&
    player.role === "F" &&
    !player.hasBall
  ) {
    const supportIndex = getAssistPartnerIndex(context.owner.index);
    if (supportIndex === player.index && isOnOpponentHalf(room, context.owner)) {
      const direction = getTeamAttackDirection(room, team);
      const centerLine = FIELD.width / 2;
      let tx = context.owner.x + direction * 54;
      if (direction > 0) {
        tx = Math.max(tx, centerLine + 34);
      } else {
        tx = Math.min(tx, centerLine - 34);
      }
      const laneOffset = player.baseY <= FIELD.height / 2 ? -72 : 72;
      const ty = context.owner.y + laneOffset * 0.55;
      player.targetX = clamp(tx, 70, FIELD.width - 70);
      player.targetY = clamp(ty, 40, FIELD.height - 40);
      player.moveSpeed = outfieldSpeed * 1.04;
      return;
    }
  }

  if (
    cpuTeam &&
    cpuDifficulty === "hard" &&
    context.owner &&
    context.owner.team === team
  ) {
    const direction = getTeamAttackDirection(room, team);
    const laneSign = player.baseY <= FIELD.height / 2 ? -1 : 1;
    const isPrimaryRunner = context.primaryRunnerId && context.primaryRunnerId === player.id;
    const advance = isPrimaryRunner ? 175 : 130;
    const laneOffset = isPrimaryRunner ? laneSign * 112 : -laneSign * 76;

    player.targetX = clamp(context.owner.x + direction * advance, 70, FIELD.width - 70);
    player.targetY = clamp(context.owner.y + laneOffset, 40, FIELD.height - 40);
    player.moveSpeed = outfieldSpeed * 1.05;
    return;
  }

  if (!context.owner && context.closestFree && context.closestFree.id === player.id) {
    player.targetX = room.ball.x;
    player.targetY = room.ball.y;
    player.moveSpeed = outfieldSpeed * (cpuProfile ? cpuProfile.looseBallSpeedScale : 0.98);
    return;
  }

  if (
    context.owner &&
    context.owner.team !== team &&
    context.presserIds &&
    context.presserIds.has(player.id)
  ) {
    player.targetX = context.owner.x;
    player.targetY = context.owner.y;
    player.moveSpeed = outfieldSpeed * (cpuProfile ? cpuProfile.pressSpeedScale : 1);
    return;
  }

  const direction = getTeamAttackDirection(room, team);
  let tx = player.baseX;
  if (context.possessionTeam === team) {
    tx += direction * (cpuProfile ? cpuProfile.possessionPush : 125);
  } else if (context.possessionTeam === 1 - team) {
    tx -= direction * (cpuProfile ? cpuProfile.defendRetreat : 70);
  }
  const ty = player.baseY + (room.ball.y - FIELD.height / 2) * 0.2;

  player.targetX = clamp(tx, 80, FIELD.width - 80);
  player.targetY = clamp(ty, 40, FIELD.height - 40);
  player.moveSpeed = defenderSpeed;
}

function movePlayer(player, dt) {
  const dx = player.targetX - player.x;
  const dy = player.targetY - player.y;
  const distance = Math.hypot(dx, dy);

  if (distance > 0.01) {
    const step = Math.min(distance, player.moveSpeed * dt);
    const nx = dx / distance;
    const ny = dy / distance;
    player.x += nx * step;
    player.y += ny * step;
    player.dirX = nx;
    player.dirY = ny;
  }

  player.x = clamp(player.x, 20, FIELD.width - 20);
  player.y = clamp(player.y, 20, FIELD.height - 20);
}

function resolveTackles(room, now) {
  const owner = getBallOwner(room);
  if (!owner || now <= room.ball.lockUntil || now <= room.ball.stealLockUntil) {
    return;
  }
  const cpuProfile = room.mode === "cpu" ? getCpuDifficultyProfile(room) : null;

  let winner = null;
  let bestDistance = Infinity;

  for (const challenger of room.teams[1 - owner.team]) {
    if (now <= challenger.kickLockUntil) {
      continue;
    }
    // Steal is allowed only when challenger touches the ball collider.
    let touchRadius = challenger.radius + room.ball.radius;
    if (cpuProfile && room.mode === "cpu") {
      if (isCpuTeam(room, challenger.team)) {
        touchRadius += cpuProfile.tackleReachCpuDelta || 0;
      } else if (isCpuTeam(room, owner.team)) {
        touchRadius += cpuProfile.tackleReachVsCpuDelta || 0;
      }
    }
    touchRadius *= getPlayerChemistry(challenger).controlScale;
    touchRadius = Math.max(room.ball.radius + 2, touchRadius);
    const dBall = dist2(challenger.x, challenger.y, room.ball.x, room.ball.y);
    if (dBall <= touchRadius * touchRadius && dBall < bestDistance) {
      bestDistance = dBall;
      winner = challenger;
    }
  }

  if (winner && now > owner.kickLockUntil) {
    setBallOwner(room, winner, now);
    const delay =
      isCpuTeam(room, winner.team) && cpuProfile
        ? cpuProfile.postStealDecisionDelayMs
        : 280;
    room.nextAiDecisionAt[winner.team] = now + delay;
  }
}

function checkGoalScored(room, now) {
  const goalTop = FIELD.height / 2 - FIELD.goalWidth / 2;
  const goalBottom = FIELD.height / 2 + FIELD.goalWidth / 2;
  const leftGoalLineX = GOAL_LINE_INSET;
  const rightGoalLineX = FIELD.width - GOAL_LINE_INSET;
  const withinGoalMouth = room.ball.y >= goalTop && room.ball.y <= goalBottom;

  if (!withinGoalMouth) {
    return false;
  }

  if (room.ball.x - room.ball.radius <= leftGoalLineX) {
    room.ball.x = clamp(
      leftGoalLineX - GOAL_NET_DEPTH * 0.42,
      room.ball.radius + 1,
      leftGoalLineX - 1
    );
    room.ball.y = clamp(
      room.ball.y,
      goalTop + room.ball.radius + 2,
      goalBottom - room.ball.radius - 2
    );
    scoreGoal(room, getTeamScoringOnLeftGoal(room), now);
    return true;
  }

  if (room.ball.x + room.ball.radius >= rightGoalLineX) {
    room.ball.x = clamp(
      rightGoalLineX + GOAL_NET_DEPTH * 0.42,
      rightGoalLineX + 1,
      FIELD.width - room.ball.radius - 1
    );
    room.ball.y = clamp(
      room.ball.y,
      goalTop + room.ball.radius + 2,
      goalBottom - room.ball.radius - 2
    );
    scoreGoal(room, getTeamScoringOnRightGoal(room), now);
    return true;
  }

  return false;
}

function updateBallPhysics(room, dt, now) {
  const owner = getBallOwner(room);
  if (owner) {
    let facingX = owner.dirX;
    let facingY = owner.dirY;
    const facingLength = Math.hypot(facingX, facingY);
    if (facingLength < 0.001) {
      facingX = getTeamAttackDirection(room, owner.team);
      facingY = 0;
    } else {
      facingX /= facingLength;
      facingY /= facingLength;
    }
    const perpX = -facingY;
    const perpY = facingX;
    const baseOffset = owner.radius + room.ball.radius + 1;
    const pulse = Math.sin(now * BALL_CARRY_PULSE_FREQ);
    const lateralPulse = Math.cos(now * BALL_CARRY_LATERAL_FREQ);
    const offset = baseOffset + pulse * BALL_CARRY_PULSE_AMPLITUDE;
    const lateral = lateralPulse * BALL_CARRY_LATERAL_AMPLITUDE;
    room.ball.x = clamp(
      owner.x + facingX * offset + perpX * lateral,
      room.ball.radius,
      FIELD.width - room.ball.radius
    );
    room.ball.y = clamp(
      owner.y + facingY * offset + perpY * lateral,
      room.ball.radius,
      FIELD.height - room.ball.radius
    );
    room.ball.vx = 0;
    room.ball.vy = 0;
    room.ball.curveTurnRate = 0;
    room.ball.curveUntil = 0;
    if (checkGoalScored(room, now)) {
      return;
    }
    return;
  }

  if (now < room.ball.curveUntil && room.ball.curveTurnRate) {
    const speed = Math.hypot(room.ball.vx, room.ball.vy);
    if (speed > 6) {
      const rotated = rotateVector(room.ball.vx, room.ball.vy, room.ball.curveTurnRate * dt);
      room.ball.vx = rotated.x;
      room.ball.vy = rotated.y;
    }
  } else if (room.ball.curveTurnRate) {
    room.ball.curveTurnRate = 0;
  }

  room.ball.x += room.ball.vx * dt;
  room.ball.y += room.ball.vy * dt;
  room.ball.vx *= 0.986;
  room.ball.vy *= 0.986;

  if (Math.abs(room.ball.vx) < 2) {
    room.ball.vx = 0;
  }
  if (Math.abs(room.ball.vy) < 2) {
    room.ball.vy = 0;
  }

  if (room.ball.y <= room.ball.radius) {
    room.ball.y = room.ball.radius;
    room.ball.vy = Math.abs(room.ball.vy) * 0.72;
  } else if (room.ball.y >= FIELD.height - room.ball.radius) {
    room.ball.y = FIELD.height - room.ball.radius;
    room.ball.vy = -Math.abs(room.ball.vy) * 0.72;
  }

  const leftGoalLineX = GOAL_LINE_INSET;
  const rightGoalLineX = FIELD.width - GOAL_LINE_INSET;
  if (checkGoalScored(room, now)) {
    return;
  }

  if (room.ball.x <= leftGoalLineX + room.ball.radius) {
    room.ball.x = leftGoalLineX + room.ball.radius;
    room.ball.vx = Math.abs(room.ball.vx) * 0.72;
  } else if (room.ball.x >= rightGoalLineX - room.ball.radius) {
    room.ball.x = rightGoalLineX - room.ball.radius;
    room.ball.vx = -Math.abs(room.ball.vx) * 0.72;
  }

  if (now <= room.ball.lockUntil) {
    return;
  }

  let picked = null;
  let bestDistance = Infinity;

  for (const player of room.allPlayers) {
    if (now <= player.kickLockUntil) {
      continue;
    }
    const pickupRadius =
      (player.radius + room.ball.radius) * getPlayerChemistry(player).controlScale;
    const d = dist2(player.x, player.y, room.ball.x, room.ball.y);
    if (d <= pickupRadius * pickupRadius && d < bestDistance) {
      bestDistance = d;
      picked = player;
    }
  }

  if (picked) {
    setBallOwner(room, picked, now);
  }
}

function updateGoalCelebration(room, dt, now) {
  if (!room.goalPause || room.goalPause.stage !== "goal") {
    return;
  }

  const scoringTeam = room.goalPause.scoringTeam;
  const celebration = room.goalPause.celebration;
  if (!celebration) {
    return;
  }
  const scorers = room.teams[scoringTeam];
  const phaseOffsets = celebration.phaseOffsets || [];

  for (let i = 0; i < scorers.length; i += 1) {
    const player = scorers[i];
    const basePhase = phaseOffsets[i] || 0;
    let targetX;
    let targetY;

    if (now < celebration.gatherUntil) {
      targetX = celebration.anchorX + Math.cos(basePhase) * 15;
      targetY = celebration.anchorY + Math.sin(basePhase) * 11;
    } else {
      const orbitAngle = (now - celebration.gatherUntil) * celebration.spinRate + basePhase;
      targetX = celebration.anchorX + Math.cos(orbitAngle) * celebration.orbitRadiusX;
      targetY = celebration.anchorY + Math.sin(orbitAngle) * celebration.orbitRadiusY;
    }

    player.targetX = clamp(targetX, 24, FIELD.width - 24);
    player.targetY = clamp(targetY, 24, FIELD.height - 24);
    player.moveSpeed = getPlayerOutfieldSpeed(room, player) * 1.08;
    movePlayer(player, dt);
  }
}

function updateRoom(room, dt, now) {
  if (!room.started || room.ended) {
    return;
  }

  if (room.paused) {
    room.inputs[0].clicks = [];
    room.inputs[1].clicks = [];
    return;
  }

  if (room.halftimePause) {
    room.inputs[0].clicks = [];
    room.inputs[1].clicks = [];
    if (now >= room.halftimePause.until) {
      completeHalftimeBreak(room, now);
    }
    return;
  }

  if (room.goalPause) {
    updateGoalCelebration(room, dt, now);

    if (room.goalPause.stage === "goal" && now >= room.goalPause.goalUntil) {
      room.goalPause.stage = "score";
    }

    if (room.goalPause.stage === "score" && now >= room.goalPause.scoreUntil) {
      const kickoffTeam = room.goalPause.kickoffTeam;
      room.goalPause = null;
      resetForKickoff(room, kickoffTeam, now + 120);
    }
    return;
  }

  if (room.kickoffUntil && now < room.kickoffUntil) {
    room.inputs[0].clicks = [];
    room.inputs[1].clicks = [];
    return;
  }
  room.kickoffUntil = 0;

  room.timeLeftMs = Math.max(0, room.timeLeftMs - dt * 1000);
  if (!room.halftimePlayed && room.timeLeftMs <= HALFTIME_CLOCK_MS) {
    startHalftimeBreak(room, now);
    return;
  }

  for (let team = 0; team < 2; team += 1) {
    const input = room.inputs[team];
    while (input.clicks.length > 0) {
      const click = input.clicks.shift();
      handleTeamClick(room, team, click.x, click.y, now);
    }
  }

  for (let team = 0; team < 2; team += 1) {
    const selected = room.playerById[room.inputs[team].selectedId];
    if (!selected || selected.role !== "F") {
      room.inputs[team].selectedId = `${team}-1`;
    }
  }

  const owner = getBallOwner(room);
  const possessionTeam = owner ? owner.team : -1;
  const team0PressCount = isCpuTeam(room, 0) ? getCpuDifficultyProfile(room).pressCount : 1;
  const team1PressCount = isCpuTeam(room, 1) ? getCpuDifficultyProfile(room).pressCount : 1;
  const team0PrimaryRunner = owner && owner.team === 0 ? getBestForwardTarget(room, 0, owner) : null;
  const team1PrimaryRunner = owner && owner.team === 1 ? getBestForwardTarget(room, 1, owner) : null;
  const contexts = [
    {
      owner,
      possessionTeam,
      primaryRunnerId: team0PrimaryRunner ? team0PrimaryRunner.id : null,
      closestFree: owner ? null : getClosestOutfield(room, 0, room.ball.x, room.ball.y),
      presserIds: new Set(
        owner && owner.team !== 0
          ? getClosestOutfields(room, 0, owner.x, owner.y, team0PressCount).map((player) => player.id)
          : []
      )
    },
    {
      owner,
      possessionTeam,
      primaryRunnerId: team1PrimaryRunner ? team1PrimaryRunner.id : null,
      closestFree: owner ? null : getClosestOutfield(room, 1, room.ball.x, room.ball.y),
      presserIds: new Set(
        owner && owner.team !== 1
          ? getClosestOutfields(room, 1, owner.x, owner.y, team1PressCount).map((player) => player.id)
          : []
      )
    }
  ];

  for (const player of room.allPlayers) {
    setOutfieldTarget(room, player, contexts[player.team], now);
  }

  for (const player of room.allPlayers) {
    movePlayer(player, dt);
  }

  resolveTackles(room, now);
  updateBallPhysics(room, dt, now);

  if (room.timeLeftMs <= 0) {
    room.ended = true;
    room.endReason = "time";
    room.endedAt = now;
    room.timeLeftMs = 0;
  }
}

function serializeState(room) {
  return {
    mode: room.mode,
    code: room.code,
    score: room.score,
    timeLeftMs: Math.ceil(room.timeLeftMs),
    paused: Boolean(room.paused),
    ended: room.ended,
    players: room.allPlayers.map((player) => ({
      id: player.id,
      team: player.team,
      role: player.role,
      x: round1(player.x),
      y: round1(player.y),
      dirX: round1(player.dirX),
      dirY: round1(player.dirY),
      radius: player.radius,
      hasBall: player.hasBall
    })),
    ball: {
      x: round1(room.ball.x),
      y: round1(room.ball.y),
      ownerId: room.ball.ownerId
    },
    goalPause: room.goalPause
      ? {
          stage: room.goalPause.stage,
          scoringTeam: room.goalPause.scoringTeam,
          celebration: room.goalPause.celebration
            ? {
                anchorX: round1(room.goalPause.celebration.anchorX),
                anchorY: round1(room.goalPause.celebration.anchorY)
              }
            : null
        }
      : null,
    halftimePause: room.halftimePause
      ? {
          stage: room.halftimePause.stage,
          startedAt: room.halftimePause.startedAt,
          until: room.halftimePause.until
        }
      : null,
    selected: [room.inputs[0].selectedId, room.inputs[1].selectedId],
    profiles: room.profiles
  };
}

function winnerName(room) {
  const [left, right] = room.score;
  if (left === right) {
    return "Draw";
  }
  return left > right ? room.profiles[0].name : room.profiles[1].name;
}

function createSession(roomId, team) {
  const token = crypto.randomBytes(16).toString("hex");
  sessions.set(token, {
    token,
    roomId,
    team,
    lastSeen: Date.now()
  });
  return token;
}

function touchSession(token) {
  const session = sessions.get(token);
  if (!session) {
    return null;
  }
  session.lastSeen = Date.now();
  return session;
}

function closeRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  for (const token of room.sessionTokens) {
    if (token) {
      sessions.delete(token);
    }
  }

  rooms.delete(roomId);
}

function leaveSession(token) {
  if (!token) {
    return;
  }
  const session = sessions.get(token);
  if (!session) {
    return;
  }

  const room = rooms.get(session.roomId);
  sessions.delete(token);

  if (!room) {
    return;
  }

  if (room.sessionTokens[session.team] === token) {
    room.sessionTokens[session.team] = null;
  }

  if (room.mode === "cpu") {
    closeRoom(room.id);
    return;
  }

  if (!room.started) {
    if (session.team === 0) {
      closeRoom(room.id);
    } else {
      room.sessionTokens[1] = null;
      room.profiles[1] = { name: "Waiting...", country: "Unknown" };
      room.ready = [false, false];
    }
    return;
  }

  const otherTeam = session.team === 0 ? 1 : 0;
  if (room.sessionTokens[otherTeam]) {
    room.ended = true;
    room.endReason = "opponent_left";
    room.abandonedTeam = session.team;
    room.endedAt = Date.now();
  } else {
    closeRoom(room.id);
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error("Invalid JSON payload"));
      }
    });
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function stateResponse(session, room) {
  if (!room) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        status: "expired",
        message: "Room no longer exists."
      }
    };
  }

  if (room.mode === "online" && !room.started) {
    const bothConnected = Boolean(room.sessionTokens[0] && room.sessionTokens[1]);
    return {
      statusCode: 200,
      payload: {
        ok: true,
        status: bothConnected ? "starting" : "waiting",
        mode: room.mode,
        code: room.code,
        team: session.team,
        profiles: room.profiles,
        ready: room.ready
      }
    };
  }

  if (room.ended) {
    if (room.endReason === "opponent_left") {
      return {
        statusCode: 200,
        payload: {
          ok: true,
          status: "opponent_left",
          mode: room.mode,
          code: room.code,
          team: session.team,
          winner: winnerName(room),
          state: serializeState(room)
        }
      };
    }

    return {
      statusCode: 200,
      payload: {
        ok: true,
        status: "ended",
        mode: room.mode,
        code: room.code,
        team: session.team,
        winner: winnerName(room),
        state: serializeState(room)
      }
    };
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      status: "started",
      mode: room.mode,
      code: room.code,
      team: session.team,
      state: serializeState(room)
    }
  };
}

async function handleApi(req, res, pathname, searchParams) {
  if (pathname === "/api/start-cpu" && req.method === "POST") {
    const body = await parseBody(req);
    leaveSession(body.token);

    const profile = normalizeProfile(body);
    const cpuDifficulty = normalizeCpuDifficulty(body.cpuDifficulty);
    const cpuCountry = (typeof body.cpuCountry === "string" ? body.cpuCountry : "")
      .trim()
      .slice(0, 40);
    const room = createRoom("cpu");
    room.profiles[0] = profile;
    room.profiles[1] = { name: "CPU", country: cpuCountry || randomCpuCountry() };
    room.cpuDifficulty = cpuDifficulty;
    room.started = true;
    room.timeLeftMs = MATCH_TIME_MS;
    room.sidesFlipped = false;
    room.openingKickoffTeam = 0;
    room.halftimePlayed = false;
    room.halftimePause = null;
    room.paused = false;
    room.ended = false;
    room.endReason = null;
    room.abandonedTeam = null;

    const token = createSession(room.id, 0);
    room.sessionTokens[0] = token;
    rooms.set(room.id, room);

    sendJson(res, 200, {
      ok: true,
      token,
      mode: "cpu",
      team: 0
    });
    return;
  }

  if (pathname === "/api/create-online" && req.method === "POST") {
    const body = await parseBody(req);
    leaveSession(body.token);

    const code = generateRoomCode();
    if (!code || !isValidRoomCode(code)) {
      sendJson(res, 503, {
        ok: false,
        message: "Could not generate room code. Try again."
      });
      return;
    }

    const room = createRoom("online", code);
    room.profiles[0] = normalizeProfile(body);
    room.profiles[1] = { name: "Waiting...", country: "Unknown" };
    room.started = false;
    room.ready = [false, false];
    room.timeLeftMs = MATCH_TIME_MS;
    room.sidesFlipped = false;
    room.openingKickoffTeam = 0;
    room.halftimePlayed = false;
    room.halftimePause = null;
    room.paused = false;
    room.ended = false;
    room.endReason = null;
    room.abandonedTeam = null;

    const token = createSession(room.id, 0);
    room.sessionTokens[0] = token;
    rooms.set(room.id, room);

    sendJson(res, 200, {
      ok: true,
      token,
      mode: "online",
      team: 0,
      code,
      status: "waiting"
    });
    return;
  }

  if (pathname === "/api/join-online" && req.method === "POST") {
    const body = await parseBody(req);
    leaveSession(body.token);

    const code = String(body.code || "").trim();
    if (!/^\d{4}$/.test(code)) {
      sendJson(res, 400, {
        ok: false,
        message: "Room code must be 4 digits."
      });
      return;
    }

    const room = rooms.get(code);
    if (!room || room.mode !== "online") {
      sendJson(res, 404, {
        ok: false,
        message: "Room not found."
      });
      return;
    }

    if (room.started || room.sessionTokens[1]) {
      sendJson(res, 409, {
        ok: false,
        message: "Room is full."
      });
      return;
    }

    room.profiles[1] = normalizeProfile(body);
    room.started = false;
    room.ready = [false, false];
    room.ended = false;
    room.endReason = null;
    room.abandonedTeam = null;
    room.timeLeftMs = MATCH_TIME_MS;
    room.sidesFlipped = false;
    room.openingKickoffTeam = 0;
    room.halftimePlayed = false;
    room.halftimePause = null;
    room.paused = false;

    const token = createSession(room.id, 1);
    room.sessionTokens[1] = token;

    sendJson(res, 200, {
      ok: true,
      token,
      mode: "online",
      team: 1,
      code,
      status: "starting"
    });
    return;
  }

  if (pathname === "/api/ready" && req.method === "POST") {
    const body = await parseBody(req);
    const session = touchSession(String(body.token || ""));
    if (!session) {
      sendJson(res, 401, { ok: false, message: "Invalid session token." });
      return;
    }

    const room = rooms.get(session.roomId);
    if (!room || room.mode !== "online" || room.ended) {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (room.started) {
      sendJson(res, 200, { ok: true, status: "started" });
      return;
    }

    if (!room.sessionTokens[0] || !room.sessionTokens[1]) {
      sendJson(res, 200, { ok: true, status: "waiting" });
      return;
    }

    room.ready[session.team] = true;
    if (room.ready[0] && room.ready[1]) {
      const openingKickoffTeam = Math.random() < 0.5 ? 0 : 1;
      room.started = true;
      room.timeLeftMs = MATCH_TIME_MS;
      room.sidesFlipped = false;
      room.openingKickoffTeam = openingKickoffTeam;
      room.halftimePlayed = false;
      room.halftimePause = null;
      room.paused = false;
      room.goalPause = null;
      resetForKickoff(room, openingKickoffTeam, Date.now());
      sendJson(res, 200, { ok: true, status: "started" });
      return;
    }

    sendJson(res, 200, { ok: true, status: "starting" });
    return;
  }

  if (pathname === "/api/input" && req.method === "POST") {
    const body = await parseBody(req);
    const session = touchSession(String(body.token || ""));
    if (!session) {
      sendJson(res, 401, { ok: false, message: "Invalid session token." });
      return;
    }

    const room = rooms.get(session.roomId);
    if (!room || !room.started || room.ended || room.goalPause || room.halftimePause || room.paused) {
      sendJson(res, 200, { ok: true });
      return;
    }

    room.inputs[session.team].cursor = {
      x: clamp(toNumber(body.x, FIELD.width / 2), 0, FIELD.width),
      y: clamp(toNumber(body.y, FIELD.height / 2), 0, FIELD.height)
    };
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/click" && req.method === "POST") {
    const body = await parseBody(req);
    const session = touchSession(String(body.token || ""));
    if (!session) {
      sendJson(res, 401, { ok: false, message: "Invalid session token." });
      return;
    }

    const room = rooms.get(session.roomId);
    if (!room || !room.started || room.ended) {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (room.goalPause || room.halftimePause || room.paused) {
      sendJson(res, 200, { ok: true });
      return;
    }

    room.inputs[session.team].clicks.push({
      x: clamp(toNumber(body.x, FIELD.width / 2), 0, FIELD.width),
      y: clamp(toNumber(body.y, FIELD.height / 2), 0, FIELD.height)
    });
    if (room.inputs[session.team].clicks.length > 6) {
      room.inputs[session.team].clicks.shift();
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/select" && req.method === "POST") {
    const body = await parseBody(req);
    const session = touchSession(String(body.token || ""));
    if (!session) {
      sendJson(res, 401, { ok: false, message: "Invalid session token." });
      return;
    }

    const room = rooms.get(session.roomId);
    if (!room || !room.started || room.ended || room.goalPause || room.halftimePause || room.paused) {
      sendJson(res, 200, { ok: true });
      return;
    }

    const rawNumber = Number(body.number);
    const number = Number.isFinite(rawNumber) ? Math.trunc(rawNumber) : NaN;
    const index = number - 1;
    if (index < 0 || index >= room.teams[session.team].length) {
      sendJson(res, 200, { ok: true });
      return;
    }

    const carrier = room.teams[session.team].find((player) => player.hasBall) || null;
    if (carrier) {
      passToTeammateNumber(room, session.team, number, Date.now());
      sendJson(res, 200, { ok: true });
      return;
    }

    const target = room.teams[session.team][index];
    if (target && target.role === "F") {
      room.inputs[session.team].selectedId = target.id;
    }

    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/pass-number" && req.method === "POST") {
    const body = await parseBody(req);
    const session = touchSession(String(body.token || ""));
    if (!session) {
      sendJson(res, 401, { ok: false, message: "Invalid session token." });
      return;
    }

    const room = rooms.get(session.roomId);
    if (!room || !room.started || room.ended || room.goalPause || room.halftimePause || room.paused) {
      sendJson(res, 200, { ok: true });
      return;
    }

    const rawNumber = Number(body.number);
    const number = Number.isFinite(rawNumber) ? Math.trunc(rawNumber) : NaN;
    if (number < 1 || number > room.teams[session.team].length) {
      sendJson(res, 200, { ok: true });
      return;
    }

    passToTeammateNumber(room, session.team, number, Date.now());
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/action" && req.method === "POST") {
    const body = await parseBody(req);
    const session = touchSession(String(body.token || ""));
    if (!session) {
      sendJson(res, 401, { ok: false, message: "Invalid session token." });
      return;
    }

    const room = rooms.get(session.roomId);
    if (!room || !room.started || room.ended || room.goalPause || room.halftimePause || room.paused) {
      sendJson(res, 200, { ok: true });
      return;
    }

    const x = clamp(toNumber(body.x, FIELD.width / 2), 0, FIELD.width);
    const y = clamp(toNumber(body.y, FIELD.height / 2), 0, FIELD.height);
    handleDirectionalAction(room, session.team, x, y, Date.now());

    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/pause" && req.method === "POST") {
    const body = await parseBody(req);
    const session = touchSession(String(body.token || ""));
    if (!session) {
      sendJson(res, 401, { ok: false, message: "Invalid session token." });
      return;
    }

    const room = rooms.get(session.roomId);
    if (!room || !room.started || room.ended) {
      sendJson(res, 200, { ok: true, paused: false });
      return;
    }

    const desiredPaused =
      typeof body.paused === "boolean" ? body.paused : !room.paused;
    room.paused = desiredPaused;
    room.inputs[0].clicks = [];
    room.inputs[1].clicks = [];
    sendJson(res, 200, { ok: true, paused: room.paused });
    return;
  }

  if (pathname === "/api/end-match" && req.method === "POST") {
    const body = await parseBody(req);
    const session = touchSession(String(body.token || ""));
    if (!session) {
      sendJson(res, 401, { ok: false, message: "Invalid session token." });
      return;
    }

    const room = rooms.get(session.roomId);
    if (!room || !room.started || room.ended) {
      sendJson(res, 200, { ok: true });
      return;
    }

    room.paused = false;
    room.goalPause = null;
    room.halftimePause = null;
    room.ended = true;
    room.endReason = "ended";
    room.endedAt = Date.now();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/state" && req.method === "GET") {
    const token = String(searchParams.get("token") || "");
    const session = touchSession(token);
    if (!session) {
      sendJson(res, 401, {
        ok: false,
        status: "expired",
        message: "Session expired. Start or join a game again."
      });
      return;
    }

    const room = rooms.get(session.roomId);
    const response = stateResponse(session, room);
    sendJson(res, response.statusCode, response.payload);
    return;
  }

  if (pathname === "/api/leave" && req.method === "POST") {
    const body = await parseBody(req);
    leaveSession(String(body.token || ""));
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { ok: false, message: "API route not found." });
}

function serveStatic(req, res) {
  const urlPath = (req.url || "/").split("?")[0];
  let baseDir = PUBLIC_DIR;
  let requestedPath = urlPath === "/" ? "index.html" : urlPath;
  if (urlPath.startsWith("/assets/")) {
    baseDir = ASSETS_DIR;
    requestedPath = urlPath.slice("/assets/".length);
  }

  const normalized = path.normalize(String(requestedPath || "")).replace(/^[/\\]+/, "");
  const filePath = path.resolve(baseDir, normalized);

  if (filePath !== baseDir && !filePath.startsWith(`${baseDir}${path.sep}`)) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    try {
      await handleApi(req, res, url.pathname, url.searchParams);
    } catch (err) {
      sendJson(res, 400, { ok: false, message: err.message || "Bad request." });
    }
    return;
  }

  if (url.pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  serveStatic(req, res);
});

setInterval(() => {
  const now = Date.now();

  for (const room of rooms.values()) {
    if (room.mode === "online" && !room.ended) {
      let roomWasClosed = false;
      for (let team = 0; team < 2; team += 1) {
        const token = room.sessionTokens[team];
        const session = token ? sessions.get(token) : null;
        const stale = !session || now - session.lastSeen > SESSION_TIMEOUT_MS;
        if (stale) {
          if (token) {
            sessions.delete(token);
            room.sessionTokens[team] = null;
          }
          if (!room.started) {
            if (team === 0) {
              closeRoom(room.id);
              roomWasClosed = true;
            } else {
              room.profiles[1] = { name: "Waiting...", country: "Unknown" };
              room.ready = [false, false];
            }
          } else {
            room.ended = true;
            room.endReason = "opponent_left";
            room.abandonedTeam = team;
            room.endedAt = now;
          }
          break;
        }
      }
      if (roomWasClosed) {
        continue;
      }
    }

    if (room.started && !room.ended) {
      updateRoom(room, DT, now);
    }

    if (room.ended && room.endedAt && now - room.endedAt > ROOM_CLEANUP_MS) {
      closeRoom(room.id);
    }
  }
}, 1000 / TICK_RATE);

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`FIFA27 running at http://localhost:${PORT}`);
});
