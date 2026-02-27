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

const FIELD = {
  width: 1000,
  height: 620,
  goalWidth: 220
};

const BALL_RADIUS = 7;
const PLAYER_RADIUS = 19;
const CLICK_SELECT_RADIUS = PLAYER_RADIUS + 9;
const OUTFIELD_SPEED = 120;
const DEFENDER_SPEED = 110;
const PASS_SPEED = 280;
const SHOT_SPEED = 360;

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

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
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
      radius: BALL_RADIUS,
      ownerId: null,
      lastTouchTeam: 0,
      lockUntil: 0,
      stealLockUntil: 0
    },
    score: [0, 0],
    timeLeftMs: MATCH_TIME_MS,
    started: false,
    ready: [false, false],
    kickoffUntil: 0,
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

function isHumanTeam(room, team) {
  return room.mode === "online" ? true : team === 0;
}

function isCpuTeam(room, team) {
  return room.mode === "cpu" && team === 1;
}

function getOutfieldSpeedForTeam(room, team) {
  return isCpuTeam(room, team) ? OUTFIELD_SPEED * 0.8 : OUTFIELD_SPEED;
}

function getDefenderSpeedForTeam(room, team) {
  return isCpuTeam(room, team) ? DEFENDER_SPEED * 0.78 : DEFENDER_SPEED;
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
  room.ball.x = player.x + player.dirX * (player.radius + room.ball.radius + 1);
  room.ball.y = player.y + player.dirY * (player.radius + room.ball.radius + 1);
  room.ball.lockUntil = now + 120;
  room.ball.stealLockUntil = now + POSSESSION_PROTECTION_MS;

  if (isHumanTeam(room, player.team) && player.role === "F") {
    room.inputs[player.team].selectedId = player.id;
  }
}

function releaseBall(room, vx, vy, now) {
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
  releaseBall(room, (dx / distance) * speed, (dy / distance) * speed, now);
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
  releaseBall(room, (dx / distance) * speed, (dy / distance) * speed, now);
  room.ball.lastTouchTeam = from.team;
  room.nextAiDecisionAt[from.team] = now + 480;
  return true;
}

function resetForKickoff(room, kickoffTeam, now) {
  for (const player of room.allPlayers) {
    player.x = player.baseX;
    player.y = player.baseY;
    player.targetX = player.baseX;
    player.targetY = player.baseY;
    player.moveSpeed = getDefenderSpeedForTeam(room, player.team);
    player.hasBall = false;
    player.kickLockUntil = 0;
    player.dirX = player.team === 0 ? 1 : -1;
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

  kickoffPlayer.x = FIELD.width / 2 + (kickoffTeam === 0 ? -28 : 28);
  kickoffPlayer.y = centerY;
  kickoffPlayer.targetX = kickoffPlayer.x;
  kickoffPlayer.targetY = kickoffPlayer.y;
  kickoffPlayer.dirX = kickoffTeam === 0 ? 1 : -1;
  kickoffPlayer.dirY = 0;

  support.x = FIELD.width / 2 + (kickoffTeam === 0 ? -85 : 85);
  support.y = centerY + 52;
  support.targetX = support.x;
  support.targetY = support.y;

  opponent.x = FIELD.width / 2 + (kickoffTeam === 0 ? 85 : -85);
  opponent.y = centerY;
  opponent.targetX = opponent.x;
  opponent.targetY = opponent.y;

  setBallOwner(room, kickoffPlayer, now);
  room.ball.x = kickoffPlayer.x;
  room.ball.y = kickoffPlayer.y;
  room.ball.vx = 0;
  room.ball.vy = 0;
  room.ball.lockUntil = now + 180;
  room.kickoffUntil = now + KICKOFF_DELAY_MS;
}

function scoreGoal(room, scoringTeam, now) {
  room.score[scoringTeam] += 1;
  room.goalPause = {
    stage: "goal",
    scoringTeam,
    kickoffTeam: 1 - scoringTeam,
    startedAt: now,
    goalUntil: now + GOAL_GIF_MS,
    scoreUntil: now + GOAL_GIF_MS + GOAL_SCORE_MS
  };

  room.ball.ownerId = null;
  room.ball.vx = 0;
  room.ball.vy = 0;
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
  const direction = team === 0 ? 1 : -1;
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
  const attackGoalX = team === 0 ? FIELD.width + 30 : -30;
  const attackGoalY = FIELD.height / 2;
  const distanceToGoal = Math.hypot(attackGoalX - player.x, attackGoalY - player.y);

  if (now >= room.nextAiDecisionAt[team]) {
    if (distanceToGoal < (cpuTeam ? 165 : 210)) {
      const spread = (Math.random() - 0.5) * (cpuTeam ? 130 : 80);
      const shotY = clamp(
        attackGoalY + spread,
        FIELD.height / 2 - FIELD.goalWidth / 2 + 16,
        FIELD.height / 2 + FIELD.goalWidth / 2 - 16
      );
      shootBall(room, player, attackGoalX, shotY, now, cpuTeam ? SHOT_SPEED * 0.82 : SHOT_SPEED);
      room.nextAiDecisionAt[team] = now + (cpuTeam ? 1250 : 920);
      return;
    }
  }

  const direction = team === 0 ? 1 : -1;
  const laneOffset = (player.baseY - attackGoalY) * 0.18;
  player.targetX = clamp(player.x + direction * (cpuTeam ? 155 : 170), 40, FIELD.width - 40);
  player.targetY = clamp(
    attackGoalY + laneOffset + (room.ball.y - attackGoalY) * 0.08,
    40,
    FIELD.height - 40
  );
  player.moveSpeed = getOutfieldSpeedForTeam(room, team) * (cpuTeam ? 0.95 : 0.92);
}

function setOutfieldTarget(room, player, context, now) {
  const team = player.team;
  const input = room.inputs[team];
  const human = isHumanTeam(room, team);
  const isSelected = human && input.selectedId === player.id;
  const outfieldSpeed = getOutfieldSpeedForTeam(room, team);
  const defenderSpeed = getDefenderSpeedForTeam(room, team);

  if (isSelected) {
    player.targetX = clamp(input.cursor.x, 0, FIELD.width);
    player.targetY = clamp(input.cursor.y, 0, FIELD.height);
    player.moveSpeed = player.hasBall ? outfieldSpeed * 0.92 : outfieldSpeed;
    return;
  }

  if (player.hasBall) {
    runAiCarrierLogic(room, player, now);
    return;
  }

  if (!context.owner && context.closestFree && context.closestFree.id === player.id) {
    player.targetX = room.ball.x;
    player.targetY = room.ball.y;
    player.moveSpeed = outfieldSpeed * 0.98;
    return;
  }

  if (
    context.owner &&
    context.owner.team !== team &&
    context.closestToOwner &&
    context.closestToOwner.id === player.id
  ) {
    player.targetX = context.owner.x;
    player.targetY = context.owner.y;
    player.moveSpeed = outfieldSpeed;
    return;
  }

  const direction = team === 0 ? 1 : -1;
  let tx = player.baseX;
  if (context.possessionTeam === team) {
    tx += direction * 125;
  } else if (context.possessionTeam === 1 - team) {
    tx -= direction * 70;
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

  let winner = null;
  let bestDistance = Infinity;

  for (const challenger of room.teams[1 - owner.team]) {
    if (now <= challenger.kickLockUntil) {
      continue;
    }
    let reach = challenger.radius + owner.radius + 2;
    if (room.mode === "cpu") {
      if (challenger.team === 1) {
        reach -= 2.2;
      } else if (owner.team === 1) {
        reach += 1.8;
      }
    }
    const d = dist2(challenger.x, challenger.y, owner.x, owner.y);
    if (d < reach * reach && d < bestDistance) {
      bestDistance = d;
      winner = challenger;
    }
  }

  if (winner && now > owner.kickLockUntil) {
    setBallOwner(room, winner, now);
    room.nextAiDecisionAt[winner.team] = now + 280;
  }
}

function updateBallPhysics(room, dt, now) {
  const owner = getBallOwner(room);
  if (owner) {
    room.ball.x = owner.x + owner.dirX * (owner.radius + room.ball.radius + 1);
    room.ball.y = owner.y + owner.dirY * (owner.radius + room.ball.radius + 1);
    room.ball.vx = 0;
    room.ball.vy = 0;
    return;
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

  const goalTop = FIELD.height / 2 - FIELD.goalWidth / 2;
  const goalBottom = FIELD.height / 2 + FIELD.goalWidth / 2;

  if (room.ball.x <= room.ball.radius) {
    if (room.ball.y >= goalTop && room.ball.y <= goalBottom) {
      scoreGoal(room, 1, now);
      return;
    }
    room.ball.x = room.ball.radius;
    room.ball.vx = Math.abs(room.ball.vx) * 0.72;
  } else if (room.ball.x >= FIELD.width - room.ball.radius) {
    if (room.ball.y >= goalTop && room.ball.y <= goalBottom) {
      scoreGoal(room, 0, now);
      return;
    }
    room.ball.x = FIELD.width - room.ball.radius;
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
    const pickupRadius = player.radius + room.ball.radius + 2;
    const d = dist2(player.x, player.y, room.ball.x, room.ball.y);
    if (d < pickupRadius * pickupRadius && d < bestDistance) {
      bestDistance = d;
      picked = player;
    }
  }

  if (picked) {
    setBallOwner(room, picked, now);
  }
}

function updateRoom(room, dt, now) {
  if (!room.started || room.ended) {
    return;
  }

  if (room.goalPause) {
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
  const contexts = [
    {
      owner,
      possessionTeam,
      closestFree: owner ? null : getClosestOutfield(room, 0, room.ball.x, room.ball.y),
      closestToOwner:
        owner && owner.team !== 0 ? getClosestOutfield(room, 0, owner.x, owner.y) : null
    },
    {
      owner,
      possessionTeam,
      closestFree: owner ? null : getClosestOutfield(room, 1, room.ball.x, room.ball.y),
      closestToOwner:
        owner && owner.team !== 1 ? getClosestOutfield(room, 1, owner.x, owner.y) : null
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
    ended: room.ended,
    players: room.allPlayers.map((player) => ({
      id: player.id,
      team: player.team,
      role: player.role,
      x: round1(player.x),
      y: round1(player.y),
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
          scoringTeam: room.goalPause.scoringTeam
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
    const cpuCountry = (typeof body.cpuCountry === "string" ? body.cpuCountry : "")
      .trim()
      .slice(0, 40);
    const room = createRoom("cpu");
    room.profiles[0] = profile;
    room.profiles[1] = { name: "CPU", country: cpuCountry || randomCpuCountry() };
    room.started = true;
    room.timeLeftMs = MATCH_TIME_MS;
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
      room.started = true;
      room.timeLeftMs = MATCH_TIME_MS;
      room.goalPause = null;
      resetForKickoff(room, Math.random() < 0.5 ? 0 : 1, Date.now());
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
    if (!room || !room.started || room.ended || room.goalPause) {
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

    if (room.goalPause) {
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
    if (!room || !room.started || room.ended || room.goalPause) {
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
    if (!room || !room.started || room.ended || room.goalPause) {
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
    if (!room || !room.started || room.ended || room.goalPause) {
      sendJson(res, 200, { ok: true });
      return;
    }

    const x = clamp(toNumber(body.x, FIELD.width / 2), 0, FIELD.width);
    const y = clamp(toNumber(body.y, FIELD.height / 2), 0, FIELD.height);
    handleDirectionalAction(room, session.team, x, y, Date.now());

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
  console.log(`Mouse Soccer running at http://localhost:${PORT}`);
});
