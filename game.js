/* =========================================================
   STEEL CORRIDOR — a 5 km battlefield survival run
   All visuals are drawn procedurally on canvas. No assets.
   ========================================================= */

(() => {
  "use strict";

  // ---------- tiny helpers ----------
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  const chance = (p) => Math.random() < p;
  const mod = (n, m) => ((n % m) + m) % m;
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  };
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const pad2 = (n) => String(n).padStart(2, "0");
  const fmtTime = (seconds) => `${Math.floor(seconds / 60)}:${pad2(Math.floor(seconds % 60))}`;

  function roundRectPath(c, x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.lineTo(x + w - rr, y);
    c.quadraticCurveTo(x + w, y, x + w, y + rr);
    c.lineTo(x + w, y + h - rr);
    c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    c.lineTo(x + rr, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - rr);
    c.lineTo(x, y + rr);
    c.quadraticCurveTo(x, y, x + rr, y);
    c.closePath();
  }

  // ---------- dom ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const app = document.getElementById("app");
  const startScreen = document.getElementById("startScreen");
  const victoryScreen = document.getElementById("victoryScreen");
  const deathScreen = document.getElementById("deathScreen");
  const playBtn = document.getElementById("playBtn");
  const replayBtn = document.getElementById("replayBtn");
  const retryBtn = document.getElementById("retryBtn");
  const soundBtn = document.getElementById("soundBtn");
  const leftBtn = document.getElementById("leftBtn");
  const rightBtn = document.getElementById("rightBtn");
  const jumpBtn = document.getElementById("jumpBtn");
  const shootBtn = document.getElementById("shootBtn");
  const rebBtn = document.getElementById("rebBtn");
  const radioBtn = document.getElementById("radioBtn");
  const medBtn = document.getElementById("medBtn");
  const healthBar = document.getElementById("healthBar");
  const healthFill = document.getElementById("healthFill");
  const healthNum = document.getElementById("healthNum");
  const healthPanel = document.querySelector(".health-panel");
  const distanceNum = document.getElementById("distanceNum");
  const routeFill = document.getElementById("routeFill");
  const routeMarker = document.getElementById("routeMarker");
  const missionPanel = document.querySelector(".mission-panel");
  const missionStatus = document.getElementById("missionStatus");
  const killsNum = document.getElementById("killsNum");
  const objectiveEl = document.getElementById("objective");
  const objectiveText = document.getElementById("objectiveText");
  const toastEl = document.getElementById("toast");
  const damageFx = document.getElementById("damageFx");

  // ---------- canvas sizing ----------
  let W = window.innerWidth;
  let H = window.innerHeight;
  let DPR = 1;
  let groundY = H * 0.72;
  let S = 1;
  let skyCache = null;
  let menuBackdrop = null;

  const ABILITY_META = {
    reb: { max: 16, label: "REB JAMMER", btn: rebBtn },
    radio: { max: 22, label: "FPV STRIKE", btn: radioBtn },
    med: { max: 28, label: "MEDKIT", btn: medBtn },
  };

  // ---------- state ----------
  const game = {
    state: "menu",
    menuTime: 0,
    gameTime: 0,
    deathTimer: 0,
    scroll: 860,
    speed: 252,
    distance: 5000,
    health: 100,
    maxHealth: 100,
    kills: 0,
    shake: 0,
    flash: 0,
    flashColor: "255,235,180",
    bgBoom: 3.2,
    spawnGround: 3,
    spawnDrone: 4,
    player: null,
    enemies: [],
    drones: [],
    bullets: [],
    tracers: [],
    particles: [],
    shocks: [],
    strikes: [],
    ash: [],
    extraction: null,
    abilities: {
      reb: { cd: 0, max: ABILITY_META.reb.max },
      radio: { cd: 0, max: ABILITY_META.radio.max },
      med: { cd: 0, max: ABILITY_META.med.max },
    },
    checkpoint2500: false,
    checkpoint1000: false,
    victoryShown: false,
    deathShown: false,
    toastTimer: 0,
    objectiveTimer: 0,
    audioEnabled: true,
    menuDrone: { x: 0, y: 0, rotor: 0, bob: 0 },
  };

  const input = { left: false, right: false, shoot: false };

  function playerHomeX() {
    return clamp(W * 0.21, 84, W * 0.26);
  }

  function createPlayer() {
    return {
      x: playerHomeX(),
      homeX: playerHomeX(),
      yOffset: 0,
      vy: 0,
      grounded: true,
      run: 0,
      invuln: 0,
      shootCd: 0,
      muzzle: 0,
      aim: 0,
      hidden: false,
      dead: false,
      dustTimer: 0,
      boardPhase: 0,
      moving: false,
      vx: 0,
    };
  }

  function resetGame() {
    game.state = "playing";
    game.menuTime = 0;
    game.gameTime = 0;
    game.deathTimer = 0;
    game.scroll = 980;
    game.speed = 252;
    game.distance = 5000;
    game.health = game.maxHealth;
    game.kills = 0;
    game.shake = 0;
    game.flash = 0;
    game.flashColor = "255,235,180";
    game.bgBoom = 4.2;
    game.spawnGround = 2.9;
    game.spawnDrone = 4.4;
    game.player = createPlayer();
    game.enemies = [];
    game.drones = [];
    game.bullets = [];
    game.tracers = [];
    game.particles = [];
    game.shocks = [];
    game.strikes = [];
    game.extraction = null;
    game.abilities.reb.cd = 0;
    game.abilities.radio.cd = 0;
    game.abilities.med.cd = 0;
    game.checkpoint2500 = false;
    game.checkpoint1000 = false;
    game.victoryShown = false;
    game.deathShown = false;
    game.objectiveTimer = 0;
    game.toastTimer = 0;
    objectiveEl.classList.add("hidden");
    toastEl.classList.remove("show", "good", "warn", "bad");
  }

  // ---------- audio ----------
  const audio = {
    ctx: null,
    master: null,
    enabled: true,
    noiseCache: null,
    lastShot: 0,
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? 0.16 : 0;
        this.master.connect(this.ctx.destination);
      } catch (err) {
        this.ctx = null;
      }
    },
    resume() {
      if (!this.ctx) this.init();
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    },
    setEnabled(on) {
      this.enabled = on;
      if (this.master) {
        const now = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.linearRampToValueAtTime(on ? 0.16 : 0, now + 0.08);
      }
    },
    noise(duration = 0.2) {
      if (!this.ctx) return null;
      if (!this.noiseCache || this.noiseCache.duration < duration) {
        const len = Math.ceil(this.ctx.sampleRate * Math.max(0.6, duration));
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.noiseCache = buf;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseCache;
      return src;
    },
    tone(freq, duration, type = "sine", volume = 0.2, slideTo = null, delay = 0) {
      if (!this.ctx || !this.enabled) return;
      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.03);
    },
    burst(duration, volume, freq, type = "lowpass", delay = 0) {
      if (!this.ctx || !this.enabled) return;
      const now = this.ctx.currentTime + delay;
      const src = this.noise(duration);
      if (!src) return;
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      filter.type = type;
      filter.frequency.setValueAtTime(freq, now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.35), now + duration);
      gain.gain.setValueAtTime(Math.max(0.0002, volume), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(now);
      src.stop(now + duration + 0.02);
    },
    shot() {
      if (!this.ctx || !this.enabled) return;
      const now = performance.now();
      if (now - this.lastShot < 42) return;
      this.lastShot = now;
      this.burst(0.075, 0.28, 1800, "highpass");
      this.tone(110, 0.055, "square", 0.07, 55);
    },
    enemyShot() {
      this.burst(0.09, 0.16, 1100, "bandpass");
      this.tone(84, 0.08, "sawtooth", 0.045, 50);
    },
    explosion(size = 1) {
      if (!this.ctx || !this.enabled) return;
      this.burst(0.42 * size, 0.42, 620, "lowpass");
      this.tone(72, 0.34 * size, "sine", 0.3, 32);
    },
    jam() {
      this.tone(180, 0.5, "sawtooth", 0.16, 1400);
      this.tone(1400, 0.45, "square", 0.06, 180, 0.05);
      this.burst(0.6, 0.16, 2600, "highpass");
    },
    radio() {
      this.tone(760, 0.08, "square", 0.12);
      this.tone(1040, 0.1, "square", 0.1, null, 0.14);
      this.tone(760, 0.08, "square", 0.1, null, 0.3);
    },
    heal() {
      this.tone(440, 0.12, "sine", 0.12, 660);
      this.tone(660, 0.18, "sine", 0.1, 880, 0.1);
    },
    hurt() {
      this.burst(0.18, 0.2, 300, "lowpass");
      this.tone(58, 0.16, "sine", 0.22, 40);
    },
    jump() {
      this.burst(0.13, 0.1, 900, "highpass");
      this.tone(180, 0.11, "sine", 0.05, 260);
    },
    dodge() {
      this.burst(0.2, 0.13, 700, "bandpass");
      this.tone(120, 0.18, "sine", 0.06, 70);
    },
    error() {
      this.tone(170, 0.12, "square", 0.07, 120);
    },
    victory() {
      [392, 523.25, 659.25, 783.99].forEach((f, i) => {
        this.tone(f, 0.34, "triangle", 0.13, null, i * 0.13);
      });
      this.tone(1046.5, 0.7, "sine", 0.1, null, 0.54);
    },
    death() {
      this.tone(110, 0.8, "sawtooth", 0.13, 48);
      this.burst(0.7, 0.14, 220, "lowpass");
    },
  };

  // ---------- screen helpers ----------
  function showToast(text, tone = "") {
    toastEl.textContent = text;
    toastEl.className = `toast show ${tone}`.trim();
    clearTimeout(game.toastTimer);
    game.toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
    }, 1900);
  }

  function showObjective(text, duration = 5000, mode = "") {
    objectiveText.textContent = text;
    objectiveEl.className = `objective ${mode}`.trim();
    objectiveEl.classList.remove("hidden");
    clearTimeout(game.objectiveTimer);
    if (duration > 0) {
      game.objectiveTimer = setTimeout(() => {
        objectiveEl.classList.add("hidden");
      }, duration);
    }
  }

  function hideObjective() {
    clearTimeout(game.objectiveTimer);
    objectiveEl.classList.add("hidden");
  }

  function updateSoundButton() {
    soundBtn.classList.toggle("muted", !audio.enabled);
    soundBtn.setAttribute("aria-label", audio.enabled ? "Mute audio" : "Unmute audio");
  }

  // ---------- input ----------
  function jump() {
    const p = game.player;
    if (!p || p.hidden) return;
    if (game.state !== "playing" && game.state !== "extraction") return;
    if (!p.grounded || p.dodge > 0) return;
    p.vy = -760;
    p.grounded = false;
    p.dodge = 0;
    audio.jump();
    spawnDust(p.x, groundY, 7, 0.7);
  }

  function dodge() {
    const p = game.player;
    if (!p || p.hidden) return;
    if (game.state !== "playing" && game.state !== "extraction") return;
    if (p.dodgeCd > 0 || !p.grounded) return;
    p.dodge = 0.58;
    p.dodgeCd = 2.5;
    p.invuln = Math.max(p.invuln, 0.8);
    p.fireCd = Math.max(p.fireCd, 0.18);
    audio.dodge();
    spawnDust(p.x + 4, groundY, 11, 1);
    for (let i = 0; i < 4; i++) {
      addParticle({
        type: "dust", x: p.x - rand(4, 28), y: groundY - rand(2, 24),
        vx: rand(-90, -30), vy: rand(-20, 8), size: rand(4, 10), life: rand(0.3, 0.6),
        color: "138,130,112",
      });
    }
  }

  function bindAction(btn, action) {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      btn.classList.add("pressed");
      setTimeout(() => btn.classList.remove("pressed"), 120);
      action();
    });
    btn.addEventListener("click", (e) => {
      if (e.detail === 0) action();
    });
  }

  bindAction(jumpBtn, jump);

  function setMove(dir, on) {
    if (dir === "left") input.left = on;
    if (dir === "right") input.right = on;
  }
  for (const [btn, dir] of [[leftBtn, "left"], [rightBtn, "right"]]) {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      btn.classList.add("pressed");
      setMove(dir, true);
    });
    btn.addEventListener("pointerup", () => { btn.classList.remove("pressed"); setMove(dir, false); });
    btn.addEventListener("pointercancel", () => { btn.classList.remove("pressed"); setMove(dir, false); });
    btn.addEventListener("pointerleave", () => { btn.classList.remove("pressed"); setMove(dir, false); });
  }

  bindAction(shootBtn, shoot);
  shootBtn.addEventListener("pointerdown", () => { input.shoot = true; });
  shootBtn.addEventListener("pointerup", () => { input.shoot = false; });
  shootBtn.addEventListener("pointercancel", () => { input.shoot = false; });
  shootBtn.addEventListener("pointerleave", () => { input.shoot = false; });

  bindAction(rebBtn, () => useAbility("reb"));
  bindAction(radioBtn, () => useAbility("radio"));
  bindAction(medBtn, () => useAbility("med"));

  soundBtn.addEventListener("click", () => {
    audio.init();
    audio.resume();
    audio.setEnabled(!audio.enabled);
    updateSoundButton();
  });

  window.addEventListener("keydown", (e) => {
    const code = e.code;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"].includes(code)) {
      e.preventDefault();
    }
    if (code === "KeyM") {
      audio.init();
      audio.resume();
      audio.setEnabled(!audio.enabled);
      updateSoundButton();
      return;
    }
    if (game.state === "menu" && (code === "Space" || code === "Enter")) {
      startGame();
      return;
    }
    if (code === "ArrowLeft" || code === "KeyA") input.left = true;
    else if (code === "ArrowRight" || code === "KeyD") input.right = true;
    else if (code === "Space" || code === "ArrowUp" || code === "KeyW") jump();
    else if (code === "KeyF" || code === "KeyJ" || code === "Enter") shoot();
    else if (code === "Digit1") useAbility("reb");
    else if (code === "Digit2") useAbility("radio");
    else if (code === "Digit3") useAbility("med");
  }, { passive: false });

  window.addEventListener("keyup", (e) => {
    const code = e.code;
    if (code === "ArrowLeft" || code === "KeyA") input.left = false;
    else if (code === "ArrowRight" || code === "KeyD") input.right = false;
  });

  // ---------- ability actions ----------
  function useAbility(key) {
    if (game.state !== "playing" && game.state !== "extraction") return;
    const a = game.abilities[key];
    if (!a) return;
    if (a.cd > 0) {
      showToast(`${ABILITY_META[key].label} RECHARGING — ${Math.ceil(a.cd)}S`, "warn");
      audio.error();
      return;
    }
    const p = game.player;

    if (key === "reb") {
      const targets = game.drones.filter((d) => !d.dead && d.x > -70 && d.x < W + 70);
      if (!targets.length) {
        showToast("NO DRONES IN JAM RANGE", "warn");
        audio.error();
        return;
      }
      a.cd = a.max;
      audio.jam();
      targets.forEach((d, i) => {
        setTimeout(() => {
          if (!d.dead && game.state !== "menu") {
            killDrone(d, "jam");
            addJamArcs(d.x, d.y);
          }
        }, i * 55);
      });
      game.flash = Math.max(game.flash, 0.55);
      game.flashColor = "86,153,255";
      game.shake = Math.max(game.shake, 10);
      game.shocks.push({
        x: p.x + 12, y: groundY - 42, r: 12, maxR: Math.max(W, H) * 0.72,
        life: 0.9, max: 0.9, color: "100,170,255", width: 3.5,
      });
      game.shocks.push({
        x: p.x + 12, y: groundY - 42, r: 0, maxR: Math.max(W, H) * 0.42,
        life: 0.55, max: 0.55, color: "180,220,255", width: 1.5,
      });
      showToast(`REB BURST — ${targets.length} DRONE${targets.length > 1 ? "S" : ""} DOWN`, "good");
      return;
    }

    if (key === "radio") {
      const targets = game.enemies.filter((e) => !e.dead && e.x > -50 && e.x < W + 60);
      if (!targets.length) {
        showToast("NO GROUND TARGETS", "warn");
        audio.error();
        return;
      }
      a.cd = a.max;
      audio.radio();
      targets.forEach((e, i) => {
        e.frozen = true;
        e.fireCd = 99;
        game.strikes.push({
          x1: e.x - rand(250, 380), y1: -30 - rand(0, 60),
          x2: e.x, y2: groundY - 28 * S,
          t: 0, delay: i * 0.08, dur: 0.34,
          target: e,
        });
      });
      game.flash = Math.max(game.flash, 0.18);
      game.flashColor = "255,225,150";
      showToast(`FPV STRIKE INBOUND — ${targets.length} TARGET${targets.length > 1 ? "S" : ""}`, "good");
      return;
    }

    if (key === "med") {
      if (game.health >= game.maxHealth - 0.5) {
        showToast("HEALTH AT MAX", "warn");
        audio.error();
        return;
      }
      a.cd = a.max;
      const healed = Math.min(40, game.maxHealth - game.health);
      game.health = Math.min(game.maxHealth, game.health + 40);
      audio.heal();
      for (let i = 0; i < 28; i++) {
        addParticle({
          type: "heal", x: p.x + rand(-20, 20), y: groundY - rand(12, 68),
          vx: rand(-25, 25), vy: rand(-80, -25), size: rand(1.5, 4),
          life: rand(0.45, 1), color: "119,228,162", gravity: 20,
        });
      }
      game.shocks.push({
        x: p.x, y: groundY - 34, r: 6, maxR: 72, life: 0.5, max: 0.5,
        color: "119,228,162", width: 2,
      });
      showToast(`MEDKIT APPLIED — +${Math.round(healed)} HP`, "good");
    }
  }

  // ---------- start / end screens ----------
  function startGame() {
    audio.init();
    audio.resume();
    resetGame();
    app.classList.remove("is-ended");
    app.classList.add("is-playing");
    startScreen.classList.add("hidden");
    victoryScreen.classList.add("hidden");
    victoryScreen.setAttribute("aria-hidden", "true");
    deathScreen.classList.add("hidden");
    deathScreen.setAttribute("aria-hidden", "true");
    canvas.style.display = "";
    startScreen.style.backgroundImage = "";
    updateSoundButton();
    updateHud();

    // Seed the corridor with immediate contacts so the run opens hot.
    spawnGroundEnemy(W * 0.72);
    spawnGroundEnemy(W * 0.97);
    spawnDrone(W * 0.62, H * 0.23);
    showObjective("REACH THE EXTRACTION POINT — 5 KM TO NOVATOR", 5600, "");
    showToast("MANUAL CONTROLS ENGAGED · SHOOT TO CLEAR", "good");
  }

  function showVictory() {
    if (game.victoryShown) return;
    game.victoryShown = true;
    game.state = "victory";
    document.getElementById("vDistance").textContent = "5,000";
    document.getElementById("vKills").textContent = String(game.kills);
    document.getElementById("vHealth").textContent = String(Math.max(0, Math.round(game.health)));
    document.getElementById("vTime").textContent = fmtTime(game.gameTime);
    app.classList.add("is-ended");
    victoryScreen.classList.remove("hidden");
    victoryScreen.setAttribute("aria-hidden", "false");
    hideObjective();
    audio.victory();
  }

  function die() {
    if (game.state === "dead") return;
    game.state = "dead";
    game.deathTimer = 0;
    game.health = 0;
    game.player.dead = true;
    game.player.vy = -220;
    game.player.grounded = false;
    game.flash = Math.max(game.flash, 0.45);
    game.flashColor = "255,70,55";
    game.shake = 16;
    hideObjective();
    audio.death();
    setTimeout(() => {
      if (game.state !== "dead" || game.deathShown) return;
      game.deathShown = true;
      document.getElementById("dDistance").textContent = String(Math.max(0, Math.round(5000 - game.distance)));
      document.getElementById("dKills").textContent = String(game.kills);
      document.getElementById("dTime").textContent = fmtTime(game.gameTime);
      app.classList.add("is-ended");
      deathScreen.classList.remove("hidden");
      deathScreen.setAttribute("aria-hidden", "false");
    }, 1050);
  }

  playBtn.addEventListener("click", startGame);
  replayBtn.addEventListener("click", startGame);
  retryBtn.addEventListener("click", startGame);

  // ---------- spawning ----------
  function spawnGroundEnemy(xOverride) {
    const progress = 1 - game.distance / 5000;
    const x = xOverride !== undefined ? xOverride : W + rand(40, 160);
    game.enemies.push({
      kind: "ground",
      x,
      hp: 3,
      maxHp: 3,
      speed: rand(82, 126) + progress * 28,
      run: rand(0, TAU),
      fireCd: rand(0.9, 1.7),
      muzzle: 0,
      hitFlash: 0,
      dead: false,
      deathT: 0,
      frozen: false,
      y: groundY,
      bob: rand(0, TAU),
    });
  }

  function spawnDrone(xOverride, yOverride) {
    const progress = 1 - game.distance / 5000;
    const x = xOverride !== undefined ? xOverride : W + rand(50, 140);
    const y = yOverride !== undefined ? yOverride : -40;
    const targetX = clamp(game.player ? game.player.x + rand(140, Math.max(220, W * 0.42)) : W * 0.65, W * 0.45, W * 0.9);
    const targetY = rand(H * 0.13, H * 0.32);
    game.drones.push({
      kind: "drone",
      x, y,
      hp: 5,
      maxHp: 5,
      state: "enter",
      stateTimer: rand(1.1, 2),
      targetX, targetY,
      fireCd: rand(0.6, 1.4),
      shootWindup: 0,
      diveT: 0,
      diveVX: 0,
      diveVY: 0,
      rotor: rand(0, TAU),
      bob: rand(0, TAU),
      hitFlash: 0,
      dead: false,
      deathT: 0,
      rot: 0,
      vx: 0,
      vy: 0,
      size: rand(0.92, 1.1),
      speed: 90 + progress * 35,
      muzzle: 0,
      warning: 0,
    });
  }

  // ---------- HUD ----------
  function updateHud() {
    const hp = clamp(Math.round(game.health), 0, 100);
    healthFill.style.width = `${hp}%`;
    healthNum.textContent = String(hp);
    healthBar.setAttribute("aria-valuenow", String(hp));
    healthPanel.classList.toggle("low", hp <= 30);

    const shownDistance = Math.max(0, Math.ceil(game.distance));
    distanceNum.textContent = shownDistance.toLocaleString("en-US");
    const progress = clamp(1 - game.distance / 5000, 0, 1);
    routeFill.style.width = `${progress * 100}%`;
    routeMarker.style.left = `${progress * 100}%`;
    killsNum.textContent = String(game.kills);

    const isExtraction = game.state === "extraction" || game.state === "victory";
    missionPanel.classList.toggle("extraction", isExtraction);
    missionStatus.textContent = isExtraction ? "EXTRACTION" : "IN TRANSIT";

    for (const key of Object.keys(game.abilities)) {
      const a = game.abilities[key];
      const meta = ABILITY_META[key];
      const btn = meta.btn;
      const cooling = a.cd > 0.02;
      btn.classList.toggle("cooling", cooling);
      btn.classList.toggle("ready", !cooling);
      btn.style.setProperty("--cool", `${clamp(a.cd / a.max, 0, 1)}turn`);
      const timer = btn.querySelector(".ability-timer");
      timer.textContent = cooling ? String(Math.ceil(a.cd)) : "";
      btn.setAttribute("aria-disabled", cooling ? "true" : "false");
    }

  }

  function updateCooldowns(dt) {
    for (const key of Object.keys(game.abilities)) {
      const a = game.abilities[key];
      a.cd = Math.max(0, a.cd - dt);
    }
  }

  // ---------- player ----------
  function updatePlayer(dt) {
    const p = game.player;
    if (!p) return;
    p.invuln = Math.max(0, p.invuln - dt);
    p.muzzle = Math.max(0, p.muzzle - dt);
    p.shootCd = Math.max(0, p.shootCd - dt);

    if (game.state === "playing") {
      const moveSpeed = 260 * S;
      let movingH = false;
      if (input.left && !input.right) {
        p.x = clamp(p.x - moveSpeed * dt, 60 * S, W - 60 * S);
        movingH = true;
        game.scroll -= moveSpeed * 0.5 * dt;
      }
      if (input.right && !input.left) {
        p.x = clamp(p.x + moveSpeed * dt, 60 * S, W - 60 * S);
        movingH = true;
        if (game.distance > 0) {
          game.scroll += moveSpeed * dt;
          game.distance = Math.max(0, game.distance - moveSpeed * 0.12 * dt);
        }
      }
      p.moving = movingH;
      if (movingH) p.run += dt * 12.5;
      p.dustTimer -= dt;
      if (p.grounded && p.dustTimer <= 0 && movingH) {
        p.dustTimer = rand(0.08, 0.16);
        addParticle({
          type: "dust", x: p.x - 7 * S, y: groundY - rand(1, 5),
          vx: rand(-55, -22), vy: rand(-18, -4), size: rand(2.5, 6),
          life: rand(0.25, 0.5), color: "145,132,108", layer: "fg",
        });
      }

      if (input.shoot && p.shootCd <= 0) shoot();
    } else {
      p.moving = game.state === "extraction";
    }

    if (!p.grounded) {
      p.vy += 2140 * dt;
      p.yOffset += p.vy * dt;
      if (p.yOffset >= 0) {
        p.yOffset = 0;
        p.vy = 0;
        p.grounded = true;
        spawnDust(p.x, groundY, 5, 0.55);
      }
    }

    if (game.state === "extraction" && game.extraction && game.extraction.phase === "run") {
      const target = game.extraction.targetX - 100 * S;
      p.x = Math.min(target, p.x + (125 + W * 0.055) * dt);
      p.run += dt * 5;
      p.dustTimer -= dt;
      if (p.dustTimer <= 0) {
        p.dustTimer = rand(0.05, 0.1);
        addParticle({
          type: "dust", x: p.x - 8 * S, y: groundY - rand(1, 6),
          vx: rand(-70, -20), vy: rand(-22, -4), size: rand(3, 8),
          life: rand(0.3, 0.6), color: "153,138,111",
        });
      }
    }
  }

  function playerMuzzle() {
    const p = game.player;
    const foot = groundY + p.yOffset;
    const localX = 17;
    const localY = -38;
    const aim = p.aim;
    const mx = p.x + (localX + 22 * Math.cos(aim)) * S;
    const my = foot + (localY + 22 * Math.sin(aim)) * S;
    return { x: mx, y: my, sx: p.x + localX * S, sy: foot + localY * S };
  }

  function shoot() {
    const p = game.player;
    if (!p || p.hidden || (game.state !== "playing" && game.state !== "extraction")) return;
    if (p.shootCd > 0) return;
    p.shootCd = 0.2;
    p.muzzle = 0.08;
    p.aim = 0;
    const m = playerMuzzle();
    game.tracers.push({
      x1: m.x, y1: m.y, x2: m.x + 180 * S, y2: m.y,
      life: 0.06, max: 0.06, width: rand(1, 1.6), color: "255,238,178", trail: 1,
    });
    game.bullets.push({
      x: m.x, y: m.y, vx: 820, vy: 0,
      life: 1.1, max: 1.1, radius: 3.2, color: "255,232,160", kind: "player",
    });
    addParticle({
      type: "ember", x: m.sx, y: m.sy,
      vx: rand(20, 70), vy: rand(-80, -30), size: 1.5,
      life: rand(0.25, 0.55), color: "255,196,90", gravity: 620, drag: 0.3,
    });
    audio.shot();
  }

  // ---------- enemy updates ----------
  function updateSpawns(dt) {
    const progress = clamp(1 - game.distance / 5000, 0, 1);
    const groundAlive = game.enemies.filter((e) => !e.dead).length;
    const dronesAlive = game.drones.filter((d) => !d.dead).length;

    game.spawnGround -= dt;
    if (game.spawnGround <= 0) {
      if (groundAlive < 3 + Math.floor(progress * 2)) spawnGroundEnemy();
      game.spawnGround = lerp(3.05, 1.5, progress) + rand(0, 1.05);
    }

    game.spawnDrone -= dt;
    if (game.spawnDrone <= 0) {
      if (dronesAlive < 2 + Math.floor(progress * 1.7)) spawnDrone();
      game.spawnDrone = lerp(4.8, 2.5, progress) + rand(0, 1.15);
    }
  }

  function updateGroundEnemies(dt) {
    const p = game.player;
    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const e = game.enemies[i];
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.muzzle = Math.max(0, e.muzzle - dt);

      if (e.dead) {
        e.deathT += dt;
        if (e.deathT > 1.35) game.enemies.splice(i, 1);
        continue;
      }
      if (e.frozen) continue;

      e.run += dt * 11;
      if (e.x > p.x + 115 * S) {
        e.x -= e.speed * dt;
      } else {
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          enemyShoot(e);
          e.fireCd = rand(1.55, 2.5);
        }
      }

      if (Math.abs(e.x - p.x) < 43 * S && p.yOffset > -70 * S) {
        damagePlayer(10, e.x, groundY - 26 * S);
        e.x += 34 * S;
        e.fireCd = Math.max(e.fireCd, 1.2);
      }
    }
  }

  function enemyShoot(e) {
    const p = game.player;
    const sx = e.x - 17 * S;
    const sy = groundY - 35 * S;
    const tx = p.x + rand(-8, 8);
    const ty = groundY + p.yOffset - 31 * S;
    const a = Math.atan2(ty - sy, tx - sx);
    const speed = 390 + (1 - game.distance / 5000) * 70;
    game.bullets.push({
      x: sx, y: sy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      life: 2.4, max: 2.4, radius: 4.5, color: "255,106,62", kind: "enemy",
    });
    e.muzzle = 0.075;
    audio.enemyShot();
    spawnMuzzleSmoke(sx, sy, -1);
  }

  function updateDrones(dt) {
    const p = game.player;
    for (let i = game.drones.length - 1; i >= 0; i--) {
      const d = game.drones[i];
      d.rotor += dt * 34;
      d.bob += dt * 3.2;
      d.hitFlash = Math.max(0, d.hitFlash - dt);
      d.muzzle = Math.max(0, d.muzzle - dt);
      d.warning = Math.max(0, d.warning - dt);

      if (d.dead) {
        d.deathT += dt;
        d.vy += 540 * dt;
        d.y += d.vy * dt;
        d.x += d.vx * dt;
        d.rot += dt * 7;
        if (chance(dt * 18)) {
          addParticle({
            type: "smoke", x: d.x + rand(-10, 10), y: d.y + rand(-6, 6),
            vx: rand(-15, 15), vy: rand(-25, -5), size: rand(4, 9),
            life: rand(0.4, 0.9), color: "60,66,64", layer: "fg",
          });
        }
        if (d.deathT > 1.6) game.drones.splice(i, 1);
        continue;
      }

      if (d.state === "enter") {
        const dx = d.targetX - d.x;
        const dy = d.targetY - d.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 12) {
          d.state = "attack";
          d.stateTimer = rand(1.1, 2.1);
        } else {
          const sp = Math.min(330, 90 + d.speed * 1.6);
          d.x += (dx / dist) * sp * dt;
          d.y += (dy / dist) * sp * dt;
        }
      } else if (d.state === "attack") {
        d.x += Math.sin(d.bob) * 8 * dt;
        d.y += Math.cos(d.bob * 0.7) * 7 * dt;
        d.fireCd -= dt;
        if (d.fireCd <= 0 && d.shootWindup <= 0) {
          d.shootWindup = 0.42;
          d.warning = 0.42;
          d.fireCd = rand(1.45, 2.25);
        }
        if (d.shootWindup > 0) {
          d.shootWindup -= dt;
          if (d.shootWindup <= 0) droneShoot(d);
        }
        d.stateTimer -= dt;
        if (d.stateTimer <= 0) {
          d.state = "dive";
          d.diveT = 0;
          const tx = p.x;
          const ty = groundY + p.yOffset - 30 * S;
          const ang = Math.atan2(ty - d.y, tx - d.x);
          const sp = 390 + (1 - game.distance / 5000) * 80;
          d.diveVX = Math.cos(ang) * sp;
          d.diveVY = Math.sin(ang) * sp;
          d.warning = 0.8;
        }
      } else if (d.state === "dive") {
        d.diveT += dt;
        d.x += d.diveVX * dt;
        d.y += d.diveVY * dt;
        if (chance(dt * 14)) {
          addParticle({
            type: "smoke", x: d.x + rand(-8, 8), y: d.y + rand(-4, 4),
            vx: rand(-10, 10), vy: rand(-12, 10), size: rand(2, 5),
            life: rand(0.2, 0.45), color: "96,102,98", layer: "fg",
          });
        }
        const hitDist = Math.hypot(d.x - p.x, d.y - (groundY + p.yOffset - 31 * S));
        if (hitDist < 37 * S) {
          damagePlayer(16, d.x, d.y);
          killDrone(d, "impact");
        } else if (d.diveT > 1.35 || d.y > groundY - 18 * S) {
          d.state = "recover";
          d.stateTimer = 0;
        }
      } else if (d.state === "recover") {
        const tx = clamp(p.x + rand(-80, 220), W * 0.36, W * 0.9);
        const ty = rand(H * 0.15, H * 0.3);
        const dx = tx - d.x;
        const dy = ty - d.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 16) {
          d.state = "attack";
          d.stateTimer = rand(1.2, 2.1);
          d.fireCd = rand(0.4, 1);
        } else {
          d.x += (dx / dist) * 260 * dt;
          d.y += (dy / dist) * 260 * dt;
        }
      }

      if (d.x < -130 || d.y > H + 120) game.drones.splice(i, 1);
    }
  }

  function droneShoot(d) {
    const p = game.player;
    const sx = d.x;
    const sy = d.y + 10 * S;
    const tx = p.x + rand(-10, 10);
    const ty = groundY + p.yOffset - 30 * S;
    const a = Math.atan2(ty - sy, tx - sx);
    const speed = 360 + (1 - game.distance / 5000) * 80;
    game.bullets.push({
      x: sx, y: sy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      life: 2.6, max: 2.6, radius: 4, color: "255,82,62", kind: "drone",
    });
    d.muzzle = 0.08;
    audio.enemyShot();
  }

  function updateBullets(dt) {
    const p = game.player;
    for (let i = game.bullets.length - 1; i >= 0; i--) {
      const b = game.bullets[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.y > groundY + 12 || b.x < -80 || b.x > W + 80) {
        game.bullets.splice(i, 1);
        continue;
      }
      if (b.kind === "player") {
        let hit = false;
        for (const e of game.enemies) {
          if (e.dead) continue;
          if (Math.hypot(b.x - e.x, b.y - (groundY - 31 * S)) < (16 + b.radius) * S) {
            e.hp -= 1;
            e.hitFlash = 0.1;
            spawnHitSparks(e.x, groundY - 28 * S, "255,200,120", 5);
            if (e.hp <= 0) killGroundEnemy(e, "rifle");
            hit = true;
            break;
          }
        }
        if (!hit) {
          for (const d of game.drones) {
            if (d.dead) continue;
            if (Math.hypot(b.x - d.x, b.y - d.y) < (20 + b.radius) * S) {
              d.hp -= 1;
              d.hitFlash = 0.1;
              spawnHitSparks(d.x, d.y, "190,215,230", 5);
              if (d.hp <= 0) killDrone(d, "rifle");
              hit = true;
              break;
            }
          }
        }
        if (hit) game.bullets.splice(i, 1);
      } else {
        const px = p.x;
        const py = groundY + p.yOffset - 31 * S;
        if (Math.hypot(b.x - px, b.y - py) < (18 + b.radius) * S) {
          if (damagePlayer(b.kind === "drone" ? 8 : 7, b.x, b.y)) {
            game.bullets.splice(i, 1);
          }
        }
      }
    }
  }

  // ---------- damage & deaths ----------
  function damagePlayer(amount, x, y) {
    const p = game.player;
    if (!p || p.invuln > 0 || game.state !== "playing") return false;
    game.health = Math.max(0, game.health - amount);
    p.invuln = 0.82;
    game.shake = Math.min(24, game.shake + 7);
    game.flash = Math.max(game.flash, 0.26);
    game.flashColor = "255,76,62";
    damageFx.classList.remove("hit");
    void damageFx.offsetWidth;
    damageFx.classList.add("hit");
    audio.hurt();
    spawnHitSparks(x, y, "255,88,64", 10);
    for (let i = 0; i < 7; i++) {
      addParticle({
        type: "dust", x: p.x + rand(-9, 9), y: groundY + p.yOffset - rand(20, 55),
        vx: rand(-70, 70), vy: rand(-70, 20), size: rand(2, 5),
        life: rand(0.3, 0.7), color: "150,74,58",
      });
    }
    if (game.health <= 0) die();
    return true;
  }

  function killGroundEnemy(e, cause = "rifle") {
    if (e.dead) return;
    e.dead = true;
    e.deathT = 0;
    e.frozen = true;
    game.kills += 1;
    const big = cause === "radio" || cause === "support";
    explode(e.x, groundY - 28 * S, big ? 1.1 : 0.65, big ? "255,170,80" : "255,150,80");
    if (big) {
      game.shake = Math.min(24, game.shake + 4);
      audio.explosion(0.65);
    }
  }

  function killDrone(d, cause = "rifle") {
    if (d.dead) return;
    d.dead = true;
    d.deathT = 0;
    d.hp = 0;
    d.vx = rand(-90, 90);
    d.vy = cause === "jam" ? rand(-60, 30) : rand(-20, 40);
    d.rot = rand(-0.4, 0.4);
    game.kills += 1;
    const jam = cause === "jam";
    explode(d.x, d.y, jam ? 1.25 : 0.85, jam ? "110,180,255" : "255,160,80");
    if (jam) addJamArcs(d.x, d.y);
    audio.explosion(jam ? 0.8 : 0.55);
  }

  // ---------- extraction ----------
  function beginExtraction() {
    if (game.state !== "playing") return;
    game.state = "extraction";
    game.distance = 0;
    game.speed = 0;
    game.bullets = [];
    game.strikes = [];
    hideObjective();

    const targetX = Math.min(W * 0.79, W - 150);
    game.extraction = {
      t: 0,
      phase: "arrive",
      vehicleX: W + 310,
      targetX,
      targetPlayerX: targetX - 100 * S,
      arrived: false,
      boardT: 0,
      driveT: 0,
      supportCd: 0.2,
      vehicleMuzzle: 0,
      comradeMuzzle: [0, 0],
      dustCd: 0,
      honked: false,
    };

    for (const e of game.enemies) if (!e.dead) killGroundEnemy(e, "support");
    for (const d of game.drones) if (!d.dead) killDrone(d, "jam");
    game.enemies = game.enemies.filter((e) => !e.dead);
    game.drones = game.drones.filter((d) => !d.dead);
    game.flash = Math.max(game.flash, 0.45);
    game.flashColor = "255,225,160";
    game.shake = Math.max(game.shake, 8);
    showObjective("EXTRACTION POINT SECURED — NOVATOR INBOUND", 0, "extraction");
    showToast("DISTANCE 0M — EXTRACTION WINDOW OPEN", "good");
    audio.radio();
  }

  function updateExtraction(dt) {
    const ex = game.extraction;
    if (!ex) return;
    const p = game.player;
    ex.t += dt;
    ex.vehicleMuzzle = Math.max(0, ex.vehicleMuzzle - dt);
    ex.comradeMuzzle[0] = Math.max(0, ex.comradeMuzzle[0] - dt);
    ex.comradeMuzzle[1] = Math.max(0, ex.comradeMuzzle[1] - dt);

    if (ex.phase === "arrive") {
      const diff = ex.targetX - ex.vehicleX;
      ex.vehicleX += diff * (1 - Math.exp(-dt * 2.45));
      if (Math.abs(diff) < 4) {
        ex.vehicleX = ex.targetX;
        ex.arrived = true;
        ex.phase = "run";
        showObjective("NOVATOR ON STATION — REACH THE VEHICLE", 0, "extraction");
        showToast("NOVATOR ON STATION — MOVE", "good");
        audio.tone(130, 0.5, "sawtooth", 0.1, 90);
        spawnDust(ex.vehicleX - 60 * S, groundY, 18, 1.4);
      }
    } else if (ex.phase === "run") {
      // updatePlayer advances the soldier toward the rear ramp.
      if (p.x >= ex.targetPlayerX - 3) {
        ex.phase = "board";
        ex.boardT = 0;
        showObjective("EMBARK — NOVATOR", 0, "extraction");
        p.grounded = true;
        p.yOffset = 0;
      }
    } else if (ex.phase === "board") {
      ex.boardT += dt;
      const bt = ex.boardT;
      if (bt < 0.42) {
        p.x = Math.min(ex.vehicleX - 55 * S, p.x + 180 * dt);
        p.run += dt * 12;
      } else if (bt < 1.12) {
        const k = clamp((bt - 0.42) / 0.7, 0, 1);
        p.x = lerp(p.x, ex.vehicleX - 48 * S, 1 - Math.exp(-dt * 6));
        p.yOffset = -Math.sin(k * Math.PI) * 58 * S;
        p.run += dt * 4;
      } else {
        p.hidden = true;
        p.yOffset = 0;
      }
      if (bt > 1.42 && ex.phase === "board") {
        ex.phase = "drive";
        ex.driveT = 0;
        showObjective("EXTRACTION COMPLETE", 0, "extraction");
        spawnDust(ex.vehicleX - 40 * S, groundY, 26, 1.8);
        audio.tone(84, 0.65, "sawtooth", 0.18, 52);
      }
    }

    if (ex.phase === "drive" || (ex.phase === "board" && ex.boardT > 0.9)) {
      ex.driveT += dt;
      if (ex.phase === "drive") {
        ex.vehicleX += (80 + ex.driveT * 235) * dt;
        ex.dustCd -= dt;
        if (ex.dustCd <= 0) {
          ex.dustCd = 0.05;
          for (let i = 0; i < 3; i++) {
            addParticle({
              type: "dust", x: ex.vehicleX - 95 * S + rand(-20, 20), y: groundY - rand(0, 16),
              vx: rand(-130, -40), vy: rand(-45, -5), size: rand(8, 22),
              life: rand(0.5, 1.2), color: "142,125,95",
            });
          }
        }
        game.shake = Math.max(game.shake, Math.min(5, ex.driveT * 2));
      }
      if (ex.driveT > 1.05 && !game.victoryShown) showVictory();
    }

    // Covering fire from the Novator and dismounts.
    if (ex.phase !== "drive" || ex.driveT < 0.35) {
      ex.supportCd -= dt;
      if (ex.supportCd <= 0) {
        ex.supportCd = rand(0.2, 0.45);
        const fromX = ex.vehicleX + rand(20, 78) * S;
        const fromY = groundY - rand(52, 76) * S;
        game.tracers.push({
          x1: fromX, y1: fromY, x2: W + rand(30, 160), y2: groundY - rand(24, 100) * S,
          life: 0.12, max: 0.12, width: rand(1, 2), color: "255,229,156",
        });
        ex.vehicleMuzzle = 0.07;
        ex.comradeMuzzle[Math.random() < 0.5 ? 0 : 1] = 0.07;
        audio.shot();
        if (chance(0.1)) {
          addBgFlash(W * rand(0.82, 1), groundY - rand(40, 140) * S, rand(0.6, 1.1));
          audio.explosion(0.35);
        }
      }
    }
  }

  function checkCheckpoints() {
    if (!game.checkpoint2500 && game.distance <= 2500) {
      game.checkpoint2500 = true;
      showToast("HALFWAY — DRONE ACTIVITY INCREASING", "warn");
      showObjective("HALFWAY — HOLD THE CORRIDOR", 3800, "");
      game.flash = Math.max(game.flash, 0.14);
      game.flashColor = "255,205,90";
    }
    if (!game.checkpoint1000 && game.distance <= 1000) {
      game.checkpoint1000 = true;
      showToast("EXTRACTION CLOSE — 1 KM", "good");
      showObjective("EXTRACTION CLOSE — PUSH TO THE NOVATOR", 4200, "");
    }
  }

  // ---------- particles & effects ----------
  function addParticle(opts) {
    const p = {
      type: "dust",
      x: 0, y: 0, vx: 0, vy: 0,
      size: 3, life: 0.5, color: "140,130,110",
      gravity: 0, drag: 0, grow: 0,
      layer: "fg", rot: rand(0, TAU), vr: rand(-2, 2),
    };
    Object.assign(p, opts);
    p.max = p.life;
    game.particles.push(p);
    if (game.particles.length > 680) game.particles.splice(0, game.particles.length - 680);
    return p;
  }

  function spawnDust(x, y, count = 6, power = 1) {
    for (let i = 0; i < count; i++) {
      addParticle({
        type: "dust",
        x: x + rand(-8, 8) * S,
        y: y - rand(0, 8) * S,
        vx: rand(-95, -20) * power,
        vy: rand(-45, -5) * power,
        size: rand(3, 9) * power,
        life: rand(0.35, 0.85),
        color: "150,137,112",
        gravity: 20,
        drag: 1.2,
      });
    }
  }

  function spawnHitSparks(x, y, color = "255,210,130", count = 6) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const sp = rand(70, 260);
      addParticle({
        type: "spark",
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - rand(10, 80),
        size: rand(1, 2.2),
        life: rand(0.12, 0.35),
        color,
        gravity: 420,
        drag: 1.8,
      });
    }
  }

  function spawnMuzzleSmoke(x, y, dir = 1) {
    for (let i = 0; i < 3; i++) {
      addParticle({
        type: "smoke",
        x: x + dir * rand(0, 8), y: y + rand(-3, 3),
        vx: dir * rand(20, 65), vy: rand(-30, -6),
        size: rand(2, 5), life: rand(0.18, 0.38),
        color: "164,158,140", grow: 12, drag: 1.4,
      });
    }
  }

  function addJamArcs(x, y) {
    for (let i = 0; i < 10; i++) {
      addParticle({
        type: "electric",
        x: x + rand(-30, 30), y: y + rand(-24, 24),
        vx: rand(-40, 40), vy: rand(-40, 40),
        size: rand(1.2, 2.6), life: rand(0.15, 0.45),
        color: "110,180,255", gravity: 0, drag: 1,
      });
    }
  }

  function explode(x, y, size = 1, color = "255,150,70") {
    game.shocks.push({
      x, y,
      r: 4 * size,
      maxR: 52 * size * S,
      life: 0.42,
      max: 0.42,
      color,
      width: 2.6 * size,
    });
    const sparks = Math.round(11 * size);
    for (let i = 0; i < sparks; i++) {
      const a = rand(0, TAU);
      const sp = rand(80, 340) * size;
      addParticle({
        type: "spark",
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - rand(20, 100),
        size: rand(1.2, 3.1),
        life: rand(0.2, 0.65),
        color,
        gravity: 520,
        drag: 1.6,
      });
    }
    for (let i = 0; i < Math.round(6 * size); i++) {
      addParticle({
        type: "smoke",
        x: x + rand(-10, 10) * size,
        y: y + rand(-10, 10) * size,
        vx: rand(-55, 55) * size,
        vy: rand(-85, -15) * size,
        size: rand(7, 18) * size,
        life: rand(0.7, 1.6),
        color: i % 3 === 0 ? "54,55,50" : "77,71,60",
        grow: rand(16, 30),
        drag: 0.8,
      });
    }
    for (let i = 0; i < Math.round(4 * size); i++) {
      addParticle({
        type: "ember",
        x, y,
        vx: rand(-120, 120) * size,
        vy: rand(-180, -50) * size,
        size: rand(1, 2.6),
        life: rand(0.5, 1.2),
        color: "255,190,90",
        gravity: 200,
        drag: 0.7,
      });
    }
    game.shake = Math.min(26, game.shake + 3.5 * size);
    game.flash = Math.max(game.flash, 0.12 * size);
    game.flashColor = color;
  }

  function addBgFlash(x, y, size = 1) {
    game.particles.push({
      type: "flash", x, y, vx: 0, vy: 0,
      size: 60 * size * S, life: 0.5, max: 0.5,
      color: "255,164,80", gravity: 0, drag: 0,
      layer: "bg", rot: 0, vr: 0,
    });
    for (let i = 0; i < 4; i++) {
      addParticle({
        type: "smoke",
        x: x + rand(-20, 20), y: y + rand(-6, 6),
        vx: rand(-18, 18), vy: rand(-70, -25),
        size: rand(18, 38) * size, life: rand(1.8, 3.6),
        color: "56,58,54", grow: rand(18, 34), drag: 0.3,
        layer: "bg",
      });
    }
  }

  function updateParticles(dt) {
    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        game.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      if (p.drag) {
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d;
        p.vy *= d;
      }
      if (p.grow) p.size += p.grow * dt;
      p.rot += p.vr * dt;
    }
  }

  function updateStrikes(dt) {
    for (let i = game.strikes.length - 1; i >= 0; i--) {
      const s = game.strikes[i];
      s.t += dt;
      if (s.t >= s.delay + s.dur) {
        if (s.target && !s.target.dead) {
          killGroundEnemy(s.target, "radio");
          audio.explosion(0.55);
        }
        game.strikes.splice(i, 1);
      } else if (s.target && s.target.dead) {
        game.strikes.splice(i, 1);
      }
    }
  }

  function initAsh() {
    game.ash = [];
    const count = Math.round(clamp(W / 18, 38, 96));
    for (let i = 0; i < count; i++) {
      game.ash.push({
        x: rand(0, W),
        y: rand(0, H),
        z: rand(0.25, 1),
        speed: rand(8, 28),
        drift: rand(-12, 9),
        phase: rand(0, TAU),
        size: rand(0.6, 2.2),
      });
    }
  }

  function updateAsh(dt) {
    for (const a of game.ash) {
      a.y += a.speed * a.z * dt;
      a.x += (a.drift + Math.sin(game.menuTime * 0.8 + a.phase) * 5) * a.z * dt;
      if (a.y > H + 6) {
        a.y = -6;
        a.x = rand(0, W);
      }
      if (a.x < -8) a.x = W + 8;
      if (a.x > W + 8) a.x = -8;
    }
  }

  function updateAmbient(dt) {
    game.shake *= Math.exp(-dt * 7.5);
    game.flash = Math.max(0, game.flash - dt * 2.15);
    updateParticles(dt);
    updateAsh(dt);

    for (let i = game.shocks.length - 1; i >= 0; i--) {
      const s = game.shocks[i];
      s.life -= dt;
      if (s.life <= 0) {
        game.shocks.splice(i, 1);
        continue;
      }
      const k = 1 - s.life / s.max;
      s.r = lerp(4, s.maxR, easeOutCubic(k));
    }

    for (let i = game.tracers.length - 1; i >= 0; i--) {
      const t = game.tracers[i];
      t.life -= dt;
      if (t.life <= 0) game.tracers.splice(i, 1);
    }

    game.bgBoom -= dt;
    if (game.bgBoom <= 0) {
      game.bgBoom = rand(5.2, 11.5);
      addBgFlash(rand(W * 0.1, W * 0.92), rand(H * 0.32, H * 0.55), rand(0.55, 1.25));
    }
  }

  // ---------- master update ----------
  function update(dt) {
    game.menuTime += dt;
    updateAmbient(dt);

    if (game.state === "menu") {
      game.scroll += dt * 7;
      game.menuDrone.rotor += dt * 20;
      game.menuDrone.bob += dt * 1.6;
      if (game.player) game.player.run += dt * 1.3;
      return;
    }

    if (game.state === "playing") {
      game.gameTime += dt;
      const progress = clamp(1 - game.distance / 5000, 0, 1);
      game.speed = 252 + progress * 54;
      updateCooldowns(dt);
      updatePlayer(dt);
      updateSpawns(dt);
      updateGroundEnemies(dt);
      updateDrones(dt);
      updateBullets(dt);
      updateStrikes(dt);
      checkCheckpoints();
      if (game.health <= 0) die();
      else if (game.distance <= 0) beginExtraction();
    } else if (game.state === "extraction") {
      updateCooldowns(dt);
      updatePlayer(dt);
      updateExtraction(dt);
      updateStrikes(dt);
      updateBullets(dt);
    } else if (game.state === "victory") {
      updateCooldowns(dt);
      updateExtraction(dt);
      updateStrikes(dt);
    } else if (game.state === "dead") {
      game.deathTimer += dt;
      const p = game.player;
      if (p && !p.grounded) {
        p.vy += 2140 * dt;
        p.yOffset += p.vy * dt;
        if (p.yOffset >= 0) {
          p.yOffset = 0;
          p.grounded = true;
        }
      }
    }

    updateHud();
  }

  // ---------- resize ----------
  function resize() {
    const oldW = W || window.innerWidth;
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(W * DPR));
    canvas.height = Math.max(1, Math.round(H * DPR));
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    groundY = H * 0.72;
    S = clamp(H / 570, 1, 1.72);
    skyCache = null;
    menuBackdrop = null;

    if (game.player) {
      if (game.extraction && (game.state === "extraction" || game.state === "victory")) {
        const ratio = W / Math.max(1, oldW);
        game.player.x *= ratio;
        game.extraction.vehicleX *= ratio;
        game.extraction.targetX = Math.min(W * 0.79, W - 150);
        game.extraction.targetPlayerX = game.extraction.targetX - 100 * S;
      } else if (game.state === "playing") {
        game.player.x = clamp(game.player.x, playerHomeX() - 2, playerHomeX() + 2);
        game.player.homeX = playerHomeX();
      } else {
        game.player.x = playerHomeX();
        game.player.homeX = playerHomeX();
      }
    }
    game.menuDrone.x = W * 0.82;
    game.menuDrone.y = H * 0.24;
    initAsh();
    if (game.state === "menu" && game.player) {
      menuBackdrop = null;
      buildMenuBackdrop();
      canvas.style.display = "none";
    }
  }

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(resize, 120), { passive: true });

  // =========================================================
  //  RENDER — background
  // =========================================================
  function drawSmokeBlob(x, y, r, alpha, color = "36,41,40") {
    ctx.fillStyle = `rgba(${color},${alpha})`;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(
        x + (i - 1.5) * r * 0.38,
        y - Math.abs(i - 1.5) * r * 0.1,
        r * (0.55 + i * 0.08),
        r * (0.18 + i * 0.02),
        (i - 1.5) * 0.08,
        0,
        TAU
      );
      ctx.fill();
    }
  }

  function drawSmokeColumn(x, baseY, height, width, seed, alpha = 0.12) {
    const n = 9;
    const drift = Math.sin(game.menuTime * 0.16 + seed) * width * 0.42;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const sway = Math.sin(game.menuTime * 0.24 + seed + i * 0.75) * width * (0.12 + k * 0.18);
      const sx = x + drift * k + sway;
      const sy = baseY - height * k;
      const r = width * (0.62 - k * 0.24) + i * 1.5;
      const a = alpha * (1 - k * 0.58);
      ctx.fillStyle = `rgba(${i < 2 ? "63,60,52" : "34,39,38"},${a})`;
      for (let j = 0; j < 4; j++) {
        const h = hash(seed * 9.1 + i * 3.7 + j * 1.3);
        const ox = (j - 1.5) * r * 0.42 + Math.sin(game.menuTime * 0.3 + i + j) * r * 0.16;
        const oy = (h - 0.5) * r * 0.42;
        ctx.beginPath();
        ctx.arc(sx + ox, sy + oy, r * (0.48 + h * 0.3), 0, TAU);
        ctx.fill();
      }
    }
  }

  function buildSkyCache() {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(W));
    c.height = Math.max(1, Math.round(groundY + 22));
    const g = c.getContext("2d");
    const sky = g.createLinearGradient(0, 0, 0, groundY + 20);
    sky.addColorStop(0, "#0e181f");
    sky.addColorStop(0.24, "#1d2c33");
    sky.addColorStop(0.48, "#3f484a");
    sky.addColorStop(0.67, "#715a46");
    sky.addColorStop(0.84, "#a0714c");
    sky.addColorStop(1, "#b27c50");
    g.fillStyle = sky;
    g.fillRect(0, 0, c.width, c.height);

    const sx = W * 0.73;
    const sy = H * 0.27;
    const glow = g.createRadialGradient(sx, sy, 0, sx, sy, W * 0.5);
    glow.addColorStop(0, "rgba(255,199,122,0.48)");
    glow.addColorStop(0.16, "rgba(253,164,82,0.26)");
    glow.addColorStop(0.5, "rgba(206,116,61,0.11)");
    glow.addColorStop(1, "rgba(80,50,35,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, c.width, c.height);

    const low = g.createRadialGradient(W * 0.64, groundY - 10, 0, W * 0.64, groundY - 10, W * 0.4);
    low.addColorStop(0, "rgba(255,160,80,0.16)");
    low.addColorStop(1, "rgba(255,152,74,0)");
    g.fillStyle = low;
    g.fillRect(0, H * 0.36, c.width, c.height - H * 0.36);
    skyCache = c;
  }

  function drawSky() {
    if (!skyCache) buildSkyCache();
    ctx.drawImage(skyCache, 0, 0, W, groundY + 22);

    // Long, low cloud banks lit from beneath by the burning horizon.
    for (let i = 0; i < 5; i++) {
      const cx = mod(i * W * 0.31 - game.scroll * 0.012 + Math.sin(game.menuTime * 0.08 + i) * 36, W + 520) - 260;
      const cy = H * (0.13 + hash(i * 5 + 3) * 0.26);
      drawSmokeBlob(cx, cy, 130 + hash(i * 7 + 2) * 180, 0.1 + hash(i + 9) * 0.04, i % 2 ? "63,66,63" : "75,71,63");
      ctx.fillStyle = "rgba(255,168,97,0.035)";
      ctx.beginPath();
      ctx.ellipse(cx + 30, cy + 16, 190, 12, 0, 0, TAU);
      ctx.fill();
    }

    // Heavy smoke columns climbing out of the horizon.
    const smokeScroll = game.scroll * 0.022;
    const columns = [
      { x: W * 0.16, h: H * 0.38, w: 88, a: 0.18, s: 1.4 },
      { x: W * 0.48, h: H * 0.28, w: 68, a: 0.13, s: 3.2 },
      { x: W * 0.82, h: H * 0.43, w: 104, a: 0.19, s: 5.6 },
    ];
    for (const c of columns) {
      const x = mod(c.x - smokeScroll, W + 360) - 180;
      const underglow = ctx.createRadialGradient(x, groundY - 12, 0, x, groundY - 12, c.w * 2.2);
      underglow.addColorStop(0, "rgba(255,145,62,0.22)");
      underglow.addColorStop(0.45, "rgba(238,113,49,0.08)");
      underglow.addColorStop(1, "rgba(200,84,34,0)");
      ctx.fillStyle = underglow;
      ctx.fillRect(x - c.w * 2.2, groundY - c.w * 2.2 - 8, c.w * 4.4, c.w * 2.2 + 8);
      drawSmokeColumn(x, groundY - 2, c.h, c.w, c.s, c.a);
    }

    const haze = ctx.createLinearGradient(0, H * 0.34, 0, groundY + 8);
    haze.addColorStop(0, "rgba(219,156,98,0)");
    haze.addColorStop(0.62, "rgba(210,144,88,0.13)");
    haze.addColorStop(1, "rgba(240,169,99,0.27)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, H * 0.34, W, groundY - H * 0.34 + 8);

    // A flare drifts down beyond the skyline, trailing smoke.
    const flareX = W * 0.82 + Math.sin(game.menuTime * 0.24) * W * 0.035;
    const flareY = H * 0.14 + mod(game.menuTime * 7.5, H * 0.26);
    const flare = ctx.createRadialGradient(flareX, flareY, 0, flareX, flareY, 68);
    flare.addColorStop(0, "rgba(255,248,198,0.9)");
    flare.addColorStop(0.12, "rgba(255,198,101,0.46)");
    flare.addColorStop(0.48, "rgba(255,130,65,0.14)");
    flare.addColorStop(1, "rgba(255,120,55,0)");
    ctx.fillStyle = flare;
    ctx.beginPath();
    ctx.arc(flareX, flareY, 68, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(102,98,82,0.2)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(flareX + 4, flareY - 6);
    ctx.quadraticCurveTo(flareX - 20, flareY - 84, flareX + 2, flareY - 156);
    ctx.stroke();

    // Distant flak and tracer arcs keep the sky alive without stealing focus.
    for (let i = 0; i < 4; i++) {
      const fx = W * (0.14 + hash(i * 6 + 2) * 0.7) - mod(game.scroll * 0.035, W * 0.18);
      const fy = H * (0.16 + hash(i * 9 + 4) * 0.2);
      const pulse = 0.3 + Math.sin(game.menuTime * 1.2 + i * 2.1) * 0.18;
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 24);
      fg.addColorStop(0, `rgba(255,238,190,${0.35 * pulse})`);
      fg.addColorStop(0.25, `rgba(255,166,88,${0.18 * pulse})`);
      fg.addColorStop(1, "rgba(255,150,80,0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(fx, fy, 24, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,196,120,${0.14 * pulse})`;
      ctx.lineWidth = 0.8;
      for (let k = 0; k < 3; k++) {
        const a = -0.7 + k * 0.62;
        ctx.beginPath();
        ctx.moveTo(fx + Math.cos(a) * 5, fy + Math.sin(a) * 5);
        ctx.lineTo(fx + Math.cos(a) * 21, fy + Math.sin(a) * 21);
        ctx.stroke();
      }
    }
  }

  function drawFarCity() {
    const p = 0.075;
    const spacing = 98;
    const wo = game.scroll * p;
    const start = Math.floor(wo / spacing) - 2;
    const end = start + Math.ceil(W / spacing) + 4;
    const base = groundY - 8;

    for (let gi = start; gi <= end; gi++) {
      const x = gi * spacing - wo;
      const r = hash(gi * 1.17 + 8);
      const w = 42 + r * 48;
      const h = 26 + hash(gi * 2.31 + 4) * 96;
      const broken = hash(gi * 4.7 + 1);
      ctx.fillStyle = `rgba(17,26,30,${0.78 + r * 0.14})`;
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.lineTo(x, base - h * 0.75);
      if (broken > 0.68) {
        ctx.lineTo(x + w * 0.22, base - h * 0.75);
        ctx.lineTo(x + w * 0.22, base - h * 0.58);
        ctx.lineTo(x + w * 0.45, base - h * 0.58);
      }
      ctx.lineTo(x + w * 0.45, base - h);
      if (broken > 0.4) {
        ctx.lineTo(x + w * 0.68, base - h);
        ctx.lineTo(x + w * 0.68, base - h * 0.82);
      }
      ctx.lineTo(x + w, base - h * 0.82);
      ctx.lineTo(x + w, base);
      ctx.closePath();
      ctx.fill();

      if (h > 72) {
        ctx.strokeStyle = "rgba(14,21,24,0.85)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, base - h);
        ctx.lineTo(x + w * 0.5, base - h - 15);
        ctx.stroke();
      }

      const cols = Math.floor(w / 13);
      const rows = Math.floor(h / 19);
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if (hash(gi * 17 + cx * 5 + cy * 11) > 0.82) {
            ctx.fillStyle = `rgba(255,157,70,${0.12 + hash(gi + cx + cy) * 0.22})`;
            ctx.fillRect(x + 7 + cx * 12, base - h + 11 + cy * 18, 2, 3);
          }
        }
      }
    }
  }

  function drawMidGround() {
    const p = 0.28;
    const spacing = 232;
    const wo = game.scroll * p;
    const start = Math.floor(wo / spacing) - 2;
    const end = start + Math.ceil(W / spacing) + 4;
    const base = groundY - 3;

    for (let gi = start; gi <= end; gi++) {
      const x = gi * spacing - wo;
      const r = hash(gi * 3.7 + 21);
      if (r < 0.2) continue;
      const w = 85 + hash(gi * 1.9 + 4) * 100;
      const h = 54 + hash(gi * 2.4 + 13) * 128;
      const topCut = hash(gi * 5.1 + 7);
      ctx.fillStyle = `rgba(11,19,21,${0.9 + r * 0.08})`;
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.lineTo(x, base - h * 0.72);
      ctx.lineTo(x + w * 0.13, base - h * 0.72);
      ctx.lineTo(x + w * 0.13, base - h * 0.9);
      ctx.lineTo(x + w * 0.35, base - h * 0.9);
      if (topCut > 0.45) {
        ctx.lineTo(x + w * 0.35, base - h * 0.66);
        ctx.lineTo(x + w * 0.52, base - h * 0.66);
      }
      ctx.lineTo(x + w * 0.52, base - h);
      ctx.lineTo(x + w * 0.78, base - h);
      ctx.lineTo(x + w * 0.78, base - h * 0.74);
      ctx.lineTo(x + w, base - h * 0.74);
      ctx.lineTo(x + w, base);
      ctx.closePath();
      ctx.fill();

      for (let wx = 0; wx < 4; wx++) {
        for (let wy = 0; wy < 4; wy++) {
          if (hash(gi * 19 + wx * 7 + wy * 3) > 0.62) {
            const px = x + 13 + wx * (w / 5);
            const py = base - h * 0.79 + wy * 20;
            ctx.fillStyle = "rgba(2,6,7,0.55)";
            ctx.fillRect(px, py, 8, 11);
            if (hash(gi * 3 + wx + wy * 9) > 0.84) {
              ctx.fillStyle = "rgba(255,144,57,0.24)";
              ctx.fillRect(px + 1, py + 2, 4, 5);
            }
          }
        }
      }

      if (r > 0.62) {
        const smokeX = x + w * 0.68;
        const smokeY = base - h * 0.9;
        for (let k = 0; k < 5; k++) {
          const drift = Math.sin(game.menuTime * 0.23 + k + gi) * (9 + k * 3);
          drawSmokeBlob(
            smokeX + drift + k * 4,
            smokeY - k * 24,
            12 + k * 8,
            0.075 - k * 0.009,
            "31,36,36"
          );
        }
      }
    }

    const poleP = 0.44;
    const poleSpacing = 315;
    const pwo = game.scroll * poleP;
    const pstart = Math.floor(pwo / poleSpacing) - 1;
    const pend = pstart + Math.ceil(W / poleSpacing) + 2;
    for (let gi = pstart; gi <= pend; gi++) {
      const x = gi * poleSpacing - pwo;
      const lean = (hash(gi * 4.2 + 1) - 0.5) * 11;
      ctx.strokeStyle = "rgba(8,14,15,0.9)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, groundY - 8);
      ctx.lineTo(x + lean, groundY - 94);
      ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + lean - 13, groundY - 85);
      ctx.lineTo(x + lean + 13, groundY - 85);
      ctx.stroke();
      if (gi < pend) {
        const nx = (gi + 1) * poleSpacing - pwo;
        const nlean = (hash((gi + 1) * 4.2 + 1) - 0.5) * 11;
        ctx.strokeStyle = "rgba(8,14,15,0.55)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x + lean - 11, groundY - 84);
        ctx.quadraticCurveTo((x + nx) / 2, groundY - 63, nx + nlean - 11, groundY - 84);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + lean + 11, groundY - 84);
        ctx.quadraticCurveTo((x + nx) / 2, groundY - 67, nx + nlean + 11, groundY - 84);
        ctx.stroke();
      }
    }

    const treeP = 0.55;
    const treeSpacing = 277;
    const two = game.scroll * treeP;
    const tstart = Math.floor(two / treeSpacing) - 1;
    const tend = tstart + Math.ceil(W / treeSpacing) + 2;
    for (let gi = tstart; gi <= tend; gi++) {
      if (hash(gi * 7.3 + 4) < 0.45) continue;
      const x = gi * treeSpacing - two;
      const h = 46 + hash(gi * 2.2 + 1) * 58;
      ctx.strokeStyle = "rgba(7,12,13,0.92)";
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(x, groundY - 2);
      ctx.lineTo(x + 4, groundY - h);
      ctx.stroke();
      ctx.lineWidth = 1.8;
      for (let b = 0; b < 4; b++) {
        const by = groundY - h * (0.42 + b * 0.12);
        const dir = b % 2 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(x + 2, by);
        ctx.lineTo(x + dir * (12 + b * 4), by - 12 - b * 4);
        ctx.stroke();
      }
    }
  }

  function drawNearGround() {
    const ridge = ctx.createLinearGradient(0, groundY - 55, 0, groundY + 4);
    ridge.addColorStop(0, "rgba(7,12,13,0)");
    ridge.addColorStop(1, "rgba(7,12,13,0.82)");
    ctx.fillStyle = ridge;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    const rp = 0.63;
    const spacing = 210;
    const wo = game.scroll * rp;
    const start = Math.floor(wo / spacing) - 1;
    const end = start + Math.ceil(W / spacing) + 2;
    for (let gi = start; gi <= end; gi++) {
      const x = gi * spacing - wo;
      const h = 12 + hash(gi * 2.8 + 7) * 36;
      ctx.lineTo(x, groundY - h);
      ctx.lineTo(x + spacing * 0.52, groundY - h * 0.45);
      ctx.lineTo(x + spacing, groundY);
    }
    ctx.lineTo(W, groundY);
    ctx.closePath();
    ctx.fill();

    const bagP = 0.83;
    const bagSpacing = 168;
    const bwo = game.scroll * bagP;
    const bstart = Math.floor(bwo / bagSpacing) - 1;
    const bend = bstart + Math.ceil(W / bagSpacing) + 2;
    for (let gi = bstart; gi <= bend; gi++) {
      if (hash(gi * 4.9 + 11) < 0.42) continue;
      const x = gi * bagSpacing - bwo;
      const y = groundY - 4;
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 4 - row; col++) {
          const bx = x + col * 18 + row * 9;
          const by = y - row * 8;
          ctx.fillStyle = row === 0 ? "#3d382b" : "#494332";
          ctx.beginPath();
          ctx.ellipse(bx, by - 4, 11, 5.5, -0.06, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = "rgba(15,16,12,0.42)";
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    const wireP = 0.95;
    const wireSpacing = 205;
    const wwo = game.scroll * wireP;
    const wstart = Math.floor(wwo / wireSpacing) - 1;
    const wend = wstart + Math.ceil(W / wireSpacing) + 2;
    ctx.strokeStyle = "rgba(6,10,11,0.8)";
    ctx.lineWidth = 1;
    for (let gi = wstart; gi <= wend; gi++) {
      const x = gi * wireSpacing - wwo;
      const y = groundY - 28;
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x - 4, y);
      ctx.stroke();
      for (let line = 0; line < 3; line++) {
        const ly = y + line * 8;
        ctx.beginPath();
        ctx.moveTo(x - 4, ly);
        ctx.quadraticCurveTo(x + wireSpacing / 2, ly + 4, x + wireSpacing - 4, ly);
        ctx.stroke();
        for (let b = 1; b < 5; b++) {
          const bx = x + (wireSpacing / 5) * b;
          ctx.beginPath();
          ctx.moveTo(bx - 2, ly - 2);
          ctx.lineTo(bx + 2, ly + 2);
          ctx.moveTo(bx + 2, ly - 2);
          ctx.lineTo(bx - 2, ly + 2);
          ctx.stroke();
        }
      }
    }
  }

  function drawGround() {
    const g = ctx.createLinearGradient(0, groundY - 4, 0, H);
    g.addColorStop(0, "#5c4a34");
    g.addColorStop(0.08, "#45392a");
    g.addColorStop(0.32, "#332c21");
    g.addColorStop(0.68, "#211f19");
    g.addColorStop(1, "#0d0f0c");
    ctx.fillStyle = g;
    ctx.fillRect(0, groundY - 3, W, H - groundY + 3);

    const horizonGlow = ctx.createLinearGradient(0, groundY - 4, 0, groundY + 34);
    horizonGlow.addColorStop(0, "rgba(255,174,94,0.24)");
    horizonGlow.addColorStop(0.35, "rgba(207,137,76,0.09)");
    horizonGlow.addColorStop(1, "rgba(90,62,40,0)");
    ctx.fillStyle = horizonGlow;
    ctx.fillRect(0, groundY - 4, W, 38);

    ctx.strokeStyle = "rgba(255,211,143,0.4)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, groundY - 2);
    for (let x = 0; x <= W; x += 45) {
      ctx.lineTo(x, groundY - 2 + Math.sin((x + game.scroll * 0.7) * 0.02) * 1.5);
    }
    ctx.stroke();

    // The track itself: darker mud with pale, churned edges.
    ctx.fillStyle = "rgba(14,15,12,0.25)";
    ctx.beginPath();
    ctx.moveTo(0, groundY + 18);
    ctx.lineTo(W, groundY + 14);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    for (let line = 0; line < 3; line++) {
      ctx.strokeStyle = line === 0 ? "rgba(9,10,8,0.52)" : line === 1 ? "rgba(150,124,86,0.16)" : "rgba(6,8,6,0.35)";
      ctx.lineWidth = line === 0 ? 16 : line === 1 ? 3 : 8;
      ctx.beginPath();
      for (let x = -30; x <= W + 30; x += 34) {
        const y = groundY + 48 + line * 46 + Math.sin((x + game.scroll) * 0.007 + line * 1.7) * (11 + line * 3);
        if (x === -30) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Reflective puddles catch the burning sky.
    const cSpacing = 388;
    const cstart = Math.floor(game.scroll / cSpacing) - 1;
    const cend = cstart + Math.ceil(W / cSpacing) + 2;
    for (let gi = cstart; gi <= cend; gi++) {
      if (hash(gi * 3.4 + 8) < 0.18) continue;
      const x = gi * cSpacing - game.scroll;
      const y = groundY + 44 + hash(gi * 7.1 + 2) * 116;
      const rw = 40 + hash(gi * 5.2 + 1) * 64;
      const rh = 8 + hash(gi * 2.8 + 4) * 14;
      ctx.fillStyle = "rgba(5,7,6,0.62)";
      ctx.beginPath();
      ctx.ellipse(x, y, rw, rh, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,177,103,0.24)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y - 1.5, rw * 0.9, rh * 0.72, 0, Math.PI * 1.04, Math.PI * 1.94);
      ctx.stroke();
      ctx.strokeStyle = "rgba(196,217,214,0.1)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(x - rw * 0.12, y - 2, rw * 0.48, rh * 0.3, 0, Math.PI * 1.1, Math.PI * 1.78);
      ctx.stroke();
    }

    // Craters and broken ground.
    const dSpacing = 156;
    const dstart = Math.floor(game.scroll / dSpacing) - 1;
    const dend = dstart + Math.ceil(W / dSpacing) + 2;
    for (let gi = dstart; gi <= dend; gi++) {
      const x = gi * dSpacing - game.scroll;
      const y = groundY + 9 + hash(gi * 4.4 + 3) * 142;
      const r = hash(gi * 2.7 + 9);
      if (r > 0.58) {
        ctx.fillStyle = "rgba(8,10,8,0.9)";
        ctx.beginPath();
        ctx.ellipse(x, y, 9 + r * 11, 3 + r * 3, hash(gi + 8) * TAU, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "rgba(169,139,95,0.16)";
        ctx.lineWidth = 1.4;
        ctx.stroke();
      } else if (r > 0.42) {
        ctx.fillStyle = "rgba(81,72,55,0.62)";
        ctx.beginPath();
        ctx.ellipse(x, y, 4 + r * 8, 2 + r * 3, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "rgba(29,27,21,0.8)";
        ctx.fillRect(x + 3, y - 1, 5 + r * 5, 1.5);
      } else {
        ctx.fillStyle = "rgba(102,82,55,0.5)";
        ctx.fillRect(x, y, 1.4, 3 + r * 4);
      }
    }

    // Grass and weeds cling to the verges.
    const gSpacing = 64;
    const gstart = Math.floor(game.scroll / gSpacing) - 1;
    const gend = gstart + Math.ceil(W / gSpacing) + 2;
    ctx.strokeStyle = "rgba(92,91,57,0.8)";
    ctx.lineWidth = 1;
    for (let gi = gstart; gi <= gend; gi++) {
      const x = gi * gSpacing - game.scroll;
      const y = groundY + 2 + hash(gi * 5.8 + 2) * 38;
      const h = 5 + hash(gi * 2.1 + 1) * 14;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y - h);
      ctx.moveTo(x + 1, y);
      ctx.lineTo(x + 5, y - h * 0.82);
      ctx.moveTo(x + 2, y);
      ctx.lineTo(x + 1, y - h * 0.55);
      ctx.stroke();
      if (hash(gi * 9.2 + 4) > 0.76) {
        ctx.fillStyle = "rgba(172,144,92,0.45)";
        ctx.fillRect(x + 3, y - h * 0.5, 1.4, 2.4);
      }
    }

    const fg = ctx.createLinearGradient(0, H - Math.max(140, H * 0.2), 0, H);
    fg.addColorStop(0, "rgba(4,7,6,0)");
    fg.addColorStop(1, "rgba(3,6,5,0.6)");
    ctx.fillStyle = fg;
    ctx.fillRect(0, H - Math.max(140, H * 0.2), W, Math.max(140, H * 0.2));
  }

  function drawFireGlow(x, y, r, alpha = 0.35) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, `rgba(255,217,139,${alpha})`);
    glow.addColorStop(0.22, `rgba(255,140,54,${alpha * 0.6})`);
    glow.addColorStop(0.62, `rgba(214,80,31,${alpha * 0.18})`);
    glow.addColorStop(1, "rgba(180,60,20,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  function drawFlame(x, y, s, seed = 0) {
    const t = game.menuTime * 7 + seed;
    const h = (18 + Math.sin(t) * 4 + Math.sin(t * 1.7) * 3) * s;
    const w = (8 + Math.sin(t * 0.8) * 1.6) * s;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const fg = ctx.createLinearGradient(0, y, 0, y - h);
    fg.addColorStop(0, "rgba(255,236,167,0.95)");
    fg.addColorStop(0.35, "rgba(255,158,54,0.86)");
    fg.addColorStop(0.76, "rgba(255,83,30,0.42)");
    fg.addColorStop(1, "rgba(190,44,18,0)");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 1.3, y - h * 0.45, x - w * 0.2, y - h);
    ctx.quadraticCurveTo(x + w * 0.2, y - h * 0.6, x + w, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,248,205,0.72)";
    ctx.beginPath();
    ctx.ellipse(x, y - h * 0.24, w * 0.28, h * 0.2, 0.08, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawBurningWreck(x, y, s = 1, seed = 0) {
    const flip = hash(seed * 3.3 + 7) > 0.5 ? 1 : -1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip * s, s);
    ctx.fillStyle = "rgba(0,0,0,0.46)";
    ctx.beginPath();
    ctx.ellipse(0, 2, 70, 9, 0, 0, TAU);
    ctx.fill();

    // Blown tracks and road wheels.
    ctx.fillStyle = "#11130f";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(-43 + i * 21, -8, 8, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = "#2e2c22";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-57, -9);
    ctx.lineTo(45, -9);
    ctx.stroke();

    // Burnt hull with torn plates.
    const hull = ctx.createLinearGradient(0, -46, 0, -8);
    hull.addColorStop(0, "#3b382c");
    hull.addColorStop(0.45, "#292a22");
    hull.addColorStop(1, "#161813");
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(-61, -9);
    ctx.lineTo(-57, -34);
    ctx.lineTo(-32, -42);
    ctx.lineTo(23, -42);
    ctx.lineTo(47, -31);
    ctx.lineTo(56, -11);
    ctx.lineTo(39, -7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#0b0d0a";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "rgba(85,74,51,0.28)";
    ctx.fillRect(-38, -34, 42, 7);
    ctx.fillStyle = "rgba(4,6,5,0.6)";
    ctx.beginPath();
    ctx.moveTo(9, -41);
    ctx.lineTo(24, -41);
    ctx.lineTo(30, -29);
    ctx.lineTo(4, -30);
    ctx.closePath();
    ctx.fill();

    // Snapped barrel.
    ctx.strokeStyle = "#1a1c16";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(20, -38);
    ctx.lineTo(66, -50);
    ctx.stroke();
    ctx.strokeStyle = "rgba(191,177,137,0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, -39);
    ctx.lineTo(64, -49.5);
    ctx.stroke();

    // Warm rim from the fire inside.
    ctx.strokeStyle = "rgba(255,150,72,0.38)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-55, -31);
    ctx.lineTo(-30, -40);
    ctx.lineTo(23, -40);
    ctx.stroke();

    ctx.restore();

    drawFireGlow(x - 22 * s * flip, y - 16 * s, 90 * s, 0.36);
    drawFlame(x - 22 * s * flip, y - 10 * s, 1.1 * s, seed);
    drawFlame(x + 14 * s * flip, y - 12 * s, 0.7 * s, seed + 2.7);
    for (let i = 0; i < 4; i++) {
      drawSmokeBlob(
        x - (10 + i * 5) * s * flip + Math.sin(game.menuTime * 0.4 + i + seed) * 10,
        y - (40 + i * 21) * s,
        (16 + i * 7) * s,
        0.12 - i * 0.018,
        "45,45,39"
      );
    }
  }

  function drawBarrelFire(x, y, s = 1, seed = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.beginPath();
    ctx.ellipse(0, 2, 23, 5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#262a20";
    roundRectPath(ctx, -11, -28, 22, 28, 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(148,132,94,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-11, -20);
    ctx.lineTo(11, -20);
    ctx.moveTo(-11, -9);
    ctx.lineTo(11, -9);
    ctx.stroke();
    ctx.fillStyle = "#151710";
    ctx.beginPath();
    ctx.ellipse(0, -28, 11, 3.5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    drawFireGlow(x, y - 30 * s, 70 * s, 0.34);
    drawFlame(x, y - 27 * s, 0.9 * s, seed + 1.9);
    for (let i = 0; i < 3; i++) {
      drawSmokeBlob(x + Math.sin(game.menuTime * 0.5 + i + seed) * 6, y - (46 + i * 17) * s, (9 + i * 5) * s, 0.1 - i * 0.02, "53,51,43");
    }
  }

  function drawDragonTeeth(x, y, s = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = "rgba(0,0,0,0.34)";
    ctx.beginPath();
    ctx.ellipse(0, 2, 54, 6, 0, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const px = -34 + i * 34;
      ctx.fillStyle = i === 1 ? "#595345" : "#4b4639";
      ctx.beginPath();
      ctx.moveTo(px - 15, 0);
      ctx.lineTo(px, -24);
      ctx.lineTo(px + 15, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(14,15,12,0.75)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.strokeStyle = "rgba(210,188,139,0.24)";
      ctx.beginPath();
      ctx.moveTo(px - 12, -2);
      ctx.lineTo(px, -21);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRoadSign(x, y, s = 1, seed = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((hash(seed) - 0.5) * 0.06);
    ctx.scale(s, s);
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.beginPath();
    ctx.ellipse(0, 2, 12, 3, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#34382e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -58);
    ctx.stroke();
    ctx.fillStyle = "#293a30";
    roundRectPath(ctx, -44, -92, 88, 34, 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(196,214,185,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(226,238,216,0.72)";
    ctx.font = "700 9px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("EXTRACT", 0, -77);
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.moveTo(17, -69);
    ctx.lineTo(33, -69);
    ctx.lineTo(27, -74);
    ctx.lineTo(37, -69);
    ctx.lineTo(27, -64);
    ctx.lineTo(33, -69);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,210,63,0.55)";
    ctx.fillRect(-35, -68, 11, 2);
    ctx.restore();
  }

  function drawRuinedBus(x, y, s = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 2, 75, 8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#313328";
    ctx.beginPath();
    ctx.moveTo(-70, -8);
    ctx.lineTo(-67, -48);
    ctx.lineTo(-38, -57);
    ctx.lineTo(58, -57);
    ctx.lineTo(72, -43);
    ctx.lineTo(69, -8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#141611";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = "rgba(7,10,9,0.75)";
    for (let i = 0; i < 5; i++) {
      roundRectPath(ctx, -55 + i * 22, -49, 16, 17, 1.5);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,153,71,0.12)";
    ctx.fillRect(-54, -47, 9, 13);
    ctx.fillStyle = "rgba(100,91,67,0.35)";
    ctx.fillRect(-64, -25, 126, 4);
    ctx.fillStyle = "#0f120e";
    for (const wx of [-45, 42]) {
      ctx.beginPath();
      ctx.arc(wx, -6, 12, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#383a2d";
      ctx.beginPath();
      ctx.arc(wx, -6, 5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#0f120e";
    }
    ctx.strokeStyle = "rgba(255,154,78,0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-66, -46);
    ctx.lineTo(-38, -54);
    ctx.lineTo(56, -54);
    ctx.stroke();
    ctx.restore();
  }

  function drawWatchtower(x, y, s = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = "rgba(11,15,14,0.92)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(-12, -92);
    ctx.moveTo(22, 0);
    ctx.lineTo(12, -92);
    ctx.moveTo(-17, -37);
    ctx.lineTo(17, -37);
    ctx.moveTo(-14, -66);
    ctx.lineTo(14, -66);
    ctx.stroke();
    ctx.fillStyle = "#111815";
    ctx.fillRect(-24, -104, 48, 15);
    ctx.fillStyle = "rgba(255,84,62,0.72)";
    ctx.beginPath();
    ctx.arc(0, -99, 1.6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(10,14,13,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -104);
    ctx.lineTo(0, -118);
    ctx.stroke();
    ctx.restore();
  }

  function drawBattlefieldProps() {
    const p = 0.74;
    const spacing = 760;
    const wo = game.scroll * p;
    const start = Math.floor(wo / spacing) - 2;
    const end = start + Math.ceil(W / spacing) + 2;
    for (let gi = start; gi <= end; gi++) {
      const x = gi * spacing - wo;
      if (x < -220 || x > W + 220) continue;
      const type = mod(gi, 5);
      const s = 0.82 + hash(gi * 2.1 + 4) * 0.3;
      if (type === 0) drawRoadSign(x, groundY + 1, 0.88 + hash(gi + 8) * 0.2, gi);
      else if (type === 1) drawBarrelFire(x, groundY + 1, 0.9 + hash(gi + 2) * 0.3, gi);
      else if (type === 2) drawBurningWreck(x, groundY + 1, s, gi);
      else if (type === 3) drawDragonTeeth(x, groundY + 2, 0.8 + hash(gi + 5) * 0.3);
      else drawRuinedBus(x, groundY + 1, 0.78 + hash(gi + 3) * 0.26);
    }

    // A watchtower sits farther back in the haze.
    const towerP = 0.46;
    const towerSpacing = 1240;
    const two = game.scroll * towerP;
    const tstart = Math.floor(two / towerSpacing) - 1;
    const tend = tstart + Math.ceil(W / towerSpacing) + 2;
    for (let gi = tstart; gi <= tend; gi++) {
      if (hash(gi * 6.1 + 3) < 0.35) continue;
      const x = gi * towerSpacing - two;
      drawWatchtower(x, groundY - 2, 0.8 + hash(gi + 9) * 0.25);
    }
  }

  function drawForegroundDetails() {
    const p = 1.16;
    const spacing = 330;
    const wo = game.scroll * p;
    const start = Math.floor(wo / spacing) - 1;
    const end = start + Math.ceil(W / spacing) + 2;
    for (let gi = start; gi <= end; gi++) {
      const x = gi * spacing - wo;
      if (x < -80 || x > W + 80) continue;
      const y = H - 14 - hash(gi * 4.4 + 1) * 20;
      const h = 10 + hash(gi * 7.3 + 2) * 24;
      ctx.strokeStyle = "rgba(8,11,8,0.86)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 8, y - h);
      ctx.moveTo(x + 1, y);
      ctx.lineTo(x + 10, y - h * 0.9);
      ctx.moveTo(x + 2, y);
      ctx.lineTo(x + 2, y - h * 0.62);
      ctx.stroke();
      if (hash(gi * 2.9 + 7) > 0.55) {
        ctx.fillStyle = "rgba(14,17,12,0.8)";
        ctx.beginPath();
        ctx.ellipse(x + 18, y + 1, 13 + hash(gi) * 8, 3.5, 0.12, 0, TAU);
        ctx.fill();
      }
    }
  }

  // =========================================================
  //  RENDER — particles, tracers, effects
  // =========================================================
  function drawParticles(layer = "fg") {
    for (const p of game.particles) {
      if ((p.layer || "fg") !== layer) continue;
      const k = clamp(p.life / p.max, 0, 1);
      if (p.type === "smoke" || p.type === "dust") {
        const alpha = (p.type === "smoke" ? 0.2 : 0.28) * k;
        ctx.fillStyle = `rgba(${p.color},${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, TAU);
        ctx.fill();
      } else if (p.type === "spark" || p.type === "ember") {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(${p.color},${k * 0.95})`;
        ctx.lineWidth = Math.max(0.6, p.size * k);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018);
        ctx.stroke();
        ctx.fillStyle = `rgba(${p.color},${k * 0.9})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size * 0.55), 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      } else if (p.type === "flash") {
        const rad = p.size * (1.5 - k * 0.6);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
        g.addColorStop(0, `rgba(255,226,170,${0.5 * k})`);
        g.addColorStop(0.18, `rgba(${p.color},${0.34 * k})`);
        g.addColorStop(0.5, `rgba(${p.color},${0.12 * k})`);
        g.addColorStop(1, `rgba(${p.color},0)`);
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      } else if (p.type === "electric") {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(${p.color},${k * 0.9})`;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x - 12, p.y);
        ctx.lineTo(p.x - 5, p.y - 7);
        ctx.lineTo(p.x, p.y + 3);
        ctx.lineTo(p.x + 6, p.y - 6);
        ctx.lineTo(p.x + 12, p.y + 1);
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      } else if (p.type === "heal") {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(${p.color},${k * 0.85})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x - 3, p.y);
        ctx.lineTo(p.x + 3, p.y);
        ctx.moveTo(p.x, p.y - 3);
        ctx.lineTo(p.x, p.y + 3);
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      }
    }
  }

  function drawShocks() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const s of game.shocks) {
      const k = clamp(s.life / s.max, 0, 1);
      ctx.strokeStyle = `rgba(${s.color},${k * 0.55})`;
      ctx.lineWidth = Math.max(0.5, s.width * k);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTracers() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const t of game.tracers) {
      const k = clamp(t.life / t.max, 0, 1);
      const trail = t.trail === undefined ? 1 : t.trail;
      const sx = lerp(t.x1, t.x2, 1 - trail);
      const sy = lerp(t.y1, t.y2, 1 - trail);
      ctx.strokeStyle = `rgba(${t.color},${k * 0.18})`;
      ctx.lineWidth = (t.width || 1.4) * 4.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
      const grad = ctx.createLinearGradient(sx, sy, t.x2, t.y2);
      grad.addColorStop(0, `rgba(${t.color},0)`);
      grad.addColorStop(0.35, `rgba(${t.color},${k * 0.7})`);
      grad.addColorStop(1, `rgba(${t.color},${k * 0.98})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = t.width || 1.4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,235,${k * 0.8})`;
      ctx.beginPath();
      ctx.arc(t.x2, t.y2, 1.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBullets() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const b of game.bullets) {
      const k = clamp(b.life / b.max, 0, 1);
      const tx = b.x - b.vx * 0.032;
      const ty = b.y - b.vy * 0.032;
      ctx.strokeStyle = `rgba(${b.color},${0.22 * k})`;
      ctx.lineWidth = b.radius * 2.2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,225,190,${0.85 * k})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,110,70,${0.9 * k})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.1, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawStrikes() {
    for (const s of game.strikes) {
      const local = clamp((s.t - s.delay) / s.dur, 0, 1);
      if (local <= 0) continue;
      const x = lerp(s.x1, s.x2, local);
      const y = lerp(s.y1, s.y2, local);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(255,208,90,${0.22 + local * 0.5})`;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 7]);
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(255,221,135,${0.42 * local})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x - (x - s.x1) * 0.05, y - (y - s.y1) * 0.05);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(s.y2 - s.y1, s.x2 - s.x1));
      ctx.fillStyle = "#1a201e";
      ctx.fillRect(-7, -2.5, 14, 5);
      ctx.strokeStyle = "rgba(180,205,205,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-5, -5);
      ctx.lineTo(5, 5);
      ctx.moveTo(5, -5);
      ctx.lineTo(-5, 5);
      ctx.stroke();
      ctx.fillStyle = "#ff4438";
      ctx.beginPath();
      ctx.arc(7, 0, 1.8, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawAsh() {
    ctx.save();
    for (const a of game.ash) {
      const alpha = 0.08 + a.z * 0.18;
      ctx.fillStyle = a.z > 0.72 ? `rgba(205,190,161,${alpha})` : `rgba(132,135,124,${alpha})`;
      ctx.fillRect(a.x, a.y, a.size * a.z, a.size * a.z * 1.7);
    }
    ctx.restore();
  }

  // =========================================================
  //  RENDER — characters & vehicles
  // =========================================================
  const PAL_PLAYER = {
    uniform: "#6d7d4f", uniformDark: "#465334", vest: "#39472f",
    skin: "#e0b087", skinDark: "#a97a57", helmet: "#4a563d",
    boot: "#20241a", pack: "#42502f", accent: "#5b9dff", accent2: "#ffe05f",
  };
  const PAL_ENEMY = {
    uniform: "#7a6747", uniformDark: "#534734", vest: "#403a2d",
    skin: "#cf9d73", skinDark: "#966849", helmet: "#4b4534",
    boot: "#1f1e17", pack: "#453e2f", accent: "#ff5a48", accent2: "#ff5a48",
  };

  function drawMuzzleFlash(x, y, angle, size = 1, color = "255,226,150") {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 13 * size);
    g.addColorStop(0, "rgba(255,255,224,0.95)");
    g.addColorStop(0.22, `rgba(${color},0.88)`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 13 * size, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,244,196,0.95)";
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 10 * size : 3.2 * size;
      const a = (i / 8) * TAU;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawSoldier(x, footY, opts = {}) {
    const s = opts.scale || S;
    const facing = opts.facing || 1;
    const pal = opts.enemy ? PAL_ENEMY : PAL_PLAYER;
    const run = opts.run || 0;
    const moving = opts.moving !== false;
    const air = !!opts.air;
    const dead = !!opts.dead;
    const dodge = opts.dodge || 0;
    const muzzle = opts.muzzle || 0;
    const aim = opts.aim || 0;

    ctx.save();
    ctx.translate(x, footY);
    ctx.globalAlpha = opts.alpha !== undefined ? opts.alpha : 1;
    if (dead) {
      ctx.translate(0, -5);
      ctx.rotate(-facing * 1.4);
      ctx.globalAlpha *= 0.72;
    }
    if (dodge > 0) {
      const k = Math.sin(clamp(1 - dodge / 0.58, 0, 1) * Math.PI);
      ctx.translate(0, -5 * k);
      ctx.rotate(-facing * 0.8 * k);
    }
    ctx.scale(facing * s, s);

    const phase = air ? 0 : moving ? run : 0.6;
    const swingA = Math.sin(phase);
    const swingB = Math.sin(phase + Math.PI);
    const bob = air ? 0 : Math.abs(Math.sin(phase * 2)) * 1.2;
    ctx.translate(0, -bob);

    function drawLeg(swing, back) {
      const lift = air ? 7 + Math.max(0, swing) * 2 : Math.max(0, -swing) * 4.2;
      const kneeX = swing * 5.5;
      const kneeY = -16 - (air ? 5 : 0) - Math.max(0, swing) * 2.2;
      const footX = swing * 11 + (air ? 5 : 0);
      const footY = air ? -9 - Math.max(0, swing) * 2 : -lift;
      ctx.strokeStyle = back ? pal.uniformDark : pal.uniform;
      ctx.lineWidth = back ? 6.6 : 7.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(-1, -29);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, footY - 1);
      ctx.stroke();
      ctx.fillStyle = pal.boot;
      roundRectPath(ctx, footX - 3.5, footY - 3, 11, 4.6, 1.6);
      ctx.fill();
    }

    drawLeg(swingB, true);

    ctx.fillStyle = pal.pack;
    roundRectPath(ctx, -14, -46, 9, 20, 3);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(-12.5, -42, 5, 12);

    ctx.fillStyle = pal.uniform;
    ctx.beginPath();
    ctx.moveTo(-9, -49);
    ctx.lineTo(7.5, -48);
    ctx.lineTo(9, -29);
    ctx.lineTo(-7, -27.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.vest;
    roundRectPath(ctx, -7.5, -46, 15.5, 15.5, 2.5);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "rgba(122,129,94,0.25)";
    ctx.fillRect(-4.5, -42, 4, 5);
    ctx.fillRect(1.5, -42, 4, 5);
    ctx.fillStyle = "rgba(14,16,11,0.8)";
    ctx.fillRect(-7, -30.5, 15, 2.3);

    ctx.fillStyle = pal.accent;
    ctx.fillRect(-8.5, -47, 4.2, 2.2);
    if (!opts.enemy) {
      ctx.fillStyle = pal.accent2;
      ctx.fillRect(-8.5, -44.8, 4.2, 1.6);
    }

    // Warm rim light from the burning horizon.
    ctx.strokeStyle = opts.enemy ? "rgba(255,146,104,0.32)" : "rgba(157,207,255,0.34)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(8.4, -47.5);
    ctx.lineTo(9, -29.5);
    ctx.stroke();

    ctx.fillStyle = pal.skinDark;
    ctx.fillRect(-1, -53, 4, 5);
    ctx.fillStyle = pal.skin;
    ctx.beginPath();
    ctx.arc(0.5, -56.5, 5.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(38,24,18,0.55)";
    ctx.fillRect(1, -57.3, 4.5, 1.7);
    ctx.fillStyle = pal.helmet;
    ctx.beginPath();
    ctx.arc(0.3, -58.6, 7.4, Math.PI, TAU);
    ctx.lineTo(8, -57.2);
    ctx.lineTo(-7.4, -57.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.ellipse(-1, -62, 5.4, 2.1, -0.1, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = opts.enemy ? "rgba(255,155,120,0.3)" : "rgba(150,200,255,0.28)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(0.3, -58.6, 7.1, -0.22, 1.18);
    ctx.stroke();
    ctx.fillStyle = "rgba(12,14,11,0.7)";
    ctx.fillRect(-5.5, -57.4, 11, 1.4);

    ctx.strokeStyle = pal.uniform;
    ctx.lineWidth = 5.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(4, -44);
    ctx.lineTo(10.5, -36);
    ctx.lineTo(16, -37.5);
    ctx.stroke();
    ctx.fillStyle = pal.skin;
    ctx.beginPath();
    ctx.arc(16, -37.5, 2.5, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(16, -37.5);
    ctx.rotate(aim);
    ctx.fillStyle = "#13160f";
    roundRectPath(ctx, -9, -2.2, 30, 4.4, 1);
    ctx.fill();
    ctx.fillStyle = "#66573b";
    roundRectPath(ctx, -10, -2.6, 8, 5.2, 1);
    ctx.fill();
    ctx.fillStyle = "#0c0f0a";
    ctx.fillRect(2, 1.2, 4, 5.5);
    ctx.fillRect(16, -1.4, 12, 2.8);
    ctx.fillStyle = "rgba(215,221,196,0.18)";
    ctx.fillRect(15, -1.4, 10, 0.8);
    if (muzzle > 0) {
      drawMuzzleFlash(30, 0, 0, 0.9 + muzzle * 4, "255,222,145");
    }
    ctx.restore();

    ctx.strokeStyle = pal.uniformDark;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(5, -43);
    ctx.lineTo(13, -40.5);
    ctx.stroke();

    ctx.restore();
  }

  function drawDrone(d) {
    const s = S * (d.size || 1);
    const bob = d.dead ? 0 : Math.sin(d.bob) * 3;
    const px = d.x;
    const py = d.y + bob;

    if (!d.dead) {
      const p = game.player;
      if (d.warning > 0 && p) {
        const alpha = 0.12 + Math.abs(Math.sin(game.menuTime * 18)) * 0.28;
        ctx.save();
        ctx.strokeStyle = `rgba(255,72,52,${alpha})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 7]);
        ctx.beginPath();
        ctx.moveTo(px, py + 8 * s);
        ctx.lineTo(p.x, groundY + p.yOffset - 31 * S);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = clamp(0.3 - (groundY - py) / H * 0.22, 0.05, 0.26);
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(px, groundY + 2, 22 * s, 5 * s, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(px, py);
    if (d.dead) ctx.rotate(d.rot);
    ctx.scale(s, s);
    const hot = d.hitFlash > 0;

    const arms = [
      [-15, -7, -26, -14],
      [15, -7, 26, -14],
      [-15, 7, -26, 14],
      [15, 7, 26, 14],
    ];
    ctx.strokeStyle = "#121817";
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    for (const a of arms) {
      ctx.beginPath();
      ctx.moveTo(a[0] * 0.45, a[1] * 0.45);
      ctx.lineTo(a[2], a[3]);
      ctx.stroke();
      ctx.save();
      ctx.translate(a[2], a[3]);
      ctx.rotate(d.rotor + a[0] * 0.04);
      ctx.fillStyle = "rgba(174,195,193,0.18)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 2.3, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(206,224,218,0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 2.3, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = hot ? "#a6b1ae" : "#252d2c";
    ctx.beginPath();
    ctx.moveTo(-11, -7);
    ctx.lineTo(-7, -12);
    ctx.lineTo(7, -12);
    ctx.lineTo(11, -7);
    ctx.lineTo(10, 7);
    ctx.lineTo(5, 11);
    ctx.lineTo(-5, 11);
    ctx.lineTo(-10, 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#080c0b";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.beginPath();
    ctx.moveTo(-6, -9);
    ctx.lineTo(6, -9);
    ctx.lineTo(4, -5);
    ctx.lineTo(-4, -5);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.shadowColor = "rgba(255,52,38,0.9)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = hot ? "#fff" : "#ff3b2f";
    ctx.beginPath();
    ctx.arc(0, 1, 2.7, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(255,68,52,0.5)";
    ctx.fillRect(-8, 6, 3, 1.2);

    ctx.strokeStyle = "#141a19";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(-1, -19);
    ctx.stroke();
    ctx.fillStyle = "#ff5a42";
    ctx.beginPath();
    ctx.arc(-1, -19.5, 1.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#171c1a";
    roundRectPath(ctx, -3, 10, 6, 5, 1.5);
    ctx.fill();

    if (d.muzzle > 0) drawMuzzleFlash(0, 14, Math.PI / 2, 0.55, "255,105,70");
    ctx.restore();

    if (!d.dead && d.hp < d.maxHp) {
      const w = 34 * s;
      ctx.fillStyle = "rgba(3,7,8,0.75)";
      ctx.fillRect(px - w / 2, py - 26 * s, w, 3);
      ctx.fillStyle = "#ff5548";
      ctx.fillRect(px - w / 2 + 1, py - 25 * s, (w - 2) * clamp(d.hp / d.maxHp, 0, 1), 1.4);
    }
  }

  function drawGroundEnemy(e) {
    const p = game.player;
    const y = groundY;
    ctx.save();
    ctx.globalAlpha = clamp(0.28 - Math.abs(e.x - p.x) / W * 0.1, 0.08, 0.25);
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(e.x, groundY + 2, 19 * S, 4.5 * S, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    drawSoldier(e.x, y, {
      enemy: true,
      facing: -1,
      run: e.run,
      moving: !e.dead && e.x > p.x + 115 * S,
      air: false,
      dead: e.dead,
      aim: 0.03,
      muzzle: e.muzzle,
      alpha: e.dead ? 1 : (e.frozen ? 0.75 : 1),
    });

    if (!e.dead && e.hp < e.maxHp) {
      const w = 32 * S;
      ctx.fillStyle = "rgba(3,7,8,0.72)";
      ctx.fillRect(e.x - w / 2, groundY - 74 * S, w, 3);
      ctx.fillStyle = "#ff6b58";
      ctx.fillRect(e.x - w / 2 + 1, groundY - 73 * S, (w - 2) * clamp(e.hp / e.maxHp, 0, 1), 1.4);
    }
  }

  function drawNovator(x, opts = {}) {
    const s = clamp(Math.min(W / 900, H / 760) * 1.2, 0.78, 1.35);
    const moving = opts.moving || 0;
    const muzzle = opts.muzzle || 0;
    ctx.save();
    ctx.translate(x, groundY + 1);
    ctx.scale(s, s);

    ctx.fillStyle = "rgba(0,0,0,0.48)";
    ctx.beginPath();
    ctx.ellipse(0, 4, 124, 13, 0, 0, TAU);
    ctx.fill();

    for (let i = 0; i < 6; i++) {
      const wx = -84 + i * 34;
      ctx.fillStyle = "#080b0a";
      ctx.beginPath();
      ctx.arc(wx, -16, 15, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#252b24";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(wx, -16, 10, 0, TAU);
      ctx.stroke();
      ctx.save();
      ctx.translate(wx, -16);
      ctx.rotate(moving * 1.6 + i);
      ctx.strokeStyle = "rgba(128,137,114,0.28)";
      ctx.lineWidth = 1.4;
      for (let k = 0; k < 3; k++) {
        ctx.rotate(TAU / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -8);
        ctx.stroke();
      }
      ctx.restore();
    }

    const hull = ctx.createLinearGradient(0, -72, 0, -18);
    hull.addColorStop(0, "#49543c");
    hull.addColorStop(0.45, "#343d2c");
    hull.addColorStop(1, "#22281d");
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(-112, -19);
    ctx.lineTo(-106, -60);
    ctx.lineTo(-82, -70);
    ctx.lineTo(72, -70);
    ctx.lineTo(103, -51);
    ctx.lineTo(114, -26);
    ctx.lineTo(108, -18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#151a12";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "rgba(13,18,12,0.4)";
    ctx.fillRect(-98, -56, 40, 27);
    ctx.fillStyle = "rgba(104,112,78,0.16)";
    ctx.fillRect(-54, -62, 52, 7);
    ctx.fillStyle = "rgba(19,24,15,0.35)";
    ctx.beginPath();
    ctx.ellipse(-40, -43, 23, 9, -0.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(40, -37, 18, 7, 0.2, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "#0c1212";
    ctx.fillRect(48, -59, 22, 11);
    ctx.fillStyle = "rgba(141,180,176,0.14)";
    ctx.fillRect(50, -57, 18, 3);
    ctx.strokeStyle = "rgba(12,16,11,0.65)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-8, -70);
    ctx.lineTo(-8, -56);
    ctx.lineTo(30, -56);
    ctx.stroke();

    ctx.fillStyle = "#293023";
    ctx.beginPath();
    ctx.moveTo(-112, -52);
    ctx.lineTo(-92, -55);
    ctx.lineTo(-92, -20);
    ctx.lineTo(-108, -20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(8,11,8,0.8)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = "rgba(218,225,196,0.52)";
    ctx.font = "700 8px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("NOVATOR", -34, -28);
    ctx.fillStyle = "#2f72e8";
    ctx.fillRect(-91, -79, 16, 5);
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(-91, -74, 16, 5);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-91, -79, 16, 10);

    ctx.fillStyle = "#3e4833";
    ctx.beginPath();
    ctx.moveTo(0, -70);
    ctx.lineTo(46, -70);
    ctx.lineTo(52, -80);
    ctx.lineTo(30, -88);
    ctx.lineTo(-6, -87);
    ctx.lineTo(-12, -79);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#141910";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = "#1c2218";
    roundRectPath(ctx, -6, -89, 19, 5, 2);
    ctx.fill();

    ctx.strokeStyle = "#171c14";
    ctx.lineWidth = 4.4;
    ctx.beginPath();
    ctx.moveTo(32, -80);
    ctx.lineTo(92, -81);
    ctx.stroke();
    ctx.strokeStyle = "rgba(190,200,168,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(34, -81.5);
    ctx.lineTo(91, -82.5);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,225,150,0.9)";
    ctx.fillRect(109, -43, 3, 4);
    ctx.fillStyle = "rgba(255,70,55,0.8)";
    ctx.fillRect(-109, -44, 2.5, 3);

    if (muzzle > 0) drawMuzzleFlash(94, -81, 0, 1.2, "255,220,140");
    ctx.restore();
  }

  // =========================================================
  //  RENDER — scene composition
  // =========================================================
  function drawPlayer() {
    const p = game.player;
    if (!p || p.hidden) return;
    const foot = groundY + p.yOffset;
    const shadowScale = clamp(1 + p.yOffset / (H * 0.8), 0.45, 1);
    ctx.save();
    ctx.globalAlpha = 0.42 * shadowScale;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(p.x, groundY + 2, 23 * S * shadowScale, 5 * S * shadowScale, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    const flicker = p.invuln > 0 ? 0.62 + Math.abs(Math.sin(game.menuTime * 44)) * 0.38 : 1;

    drawSoldier(p.x, foot, {
      run: p.run,
      moving: p.moving || game.state === "extraction",
      air: !p.grounded,
      muzzle: p.muzzle,
      aim: p.aim,
      dead: p.dead,
      alpha: flicker,
    });
  }

  function drawExtractionScene() {
    const ex = game.extraction;
    if (!ex) return;
    const sV = clamp(Math.min(W / 900, H / 760) * 1.2, 0.78, 1.35);

    drawNovator(ex.vehicleX, {
      moving: ex.phase === "drive" ? ex.driveT + 0.2 : 0,
      muzzle: ex.vehicleMuzzle,
    });

    // Green smoke marks the rear ramp.
    for (let i = 0; i < 5; i++) {
      const drift = Math.sin(game.menuTime * 0.8 + i * 0.7) * (4 + i * 2);
      drawSmokeBlob(
        ex.vehicleX - (100 + i * 2) * sV + drift,
        groundY - 8 - i * 13,
        10 + i * 4,
        0.09 - i * 0.012,
        "89,153,104"
      );
    }

    // Two comrades lay down covering fire, then board.
    for (let i = 0; i < 2; i++) {
      let cx = ex.vehicleX - (124 + i * 30) * S;
      let cy = groundY;
      let hidden = false;
      const start = i === 0 ? 0.1 : 0.42;
      const t = ex.boardT - start;
      if (ex.phase === "board" && t > 0) {
        const k = clamp(t / 0.55, 0, 1);
        cx = lerp(cx, ex.vehicleX - 58 * S, k);
        cy = groundY - Math.sin(k * Math.PI) * 46 * S;
        if (t > 0.58) hidden = true;
      }
      if (hidden) continue;
      drawSoldier(cx, cy, {
        run: game.menuTime * 9 + i * 2,
        moving: ex.phase !== "board",
        air: ex.phase === "board" && t > 0,
        muzzle: ex.comradeMuzzle[i],
        aim: 0.02,
        scale: S * 0.94,
      });
    }

    drawPlayer();

    drawTracers();
    drawBullets();
    drawShocks();

    // Extraction marker over the ramp.
    if (ex.phase === "arrive" || ex.phase === "run") {
      const pulse = 0.55 + Math.sin(game.menuTime * 3.5) * 0.22;
      const mx = ex.vehicleX - 82 * sV;
      const my = groundY - 105 * sV + Math.sin(game.menuTime * 2.2) * 4;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = "#77e4a2";
      ctx.beginPath();
      ctx.moveTo(mx, my + 14);
      ctx.lineTo(mx - 8, my);
      ctx.lineTo(mx + 8, my);
      ctx.closePath();
      ctx.fill();
      ctx.font = "700 7px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("EXTRACT", mx, my - 7);
      ctx.restore();
    }
  }

  function drawMenuScene() {
    const idleX = W > 820 ? W * 0.71 : W * 0.78;
    const p = game.player;
    if (p) {
      ctx.save();
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(idleX, groundY + 2, 23 * S, 5 * S, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      drawSoldier(idleX, groundY, {
        run: p.run * 0.45,
        moving: false,
        aim: -0.02,
        muzzle: 0,
      });
    }

    const d = game.menuDrone;
    const fakeDrone = {
      x: d.x,
      y: d.y + Math.sin(d.bob) * 7,
      rotor: d.rotor,
      bob: d.bob,
      size: 1.15,
      hp: 5,
      maxHp: 5,
      dead: false,
      hitFlash: 0,
      warning: 0,
      muzzle: 0,
      rot: 0,
    };
    drawDrone(fakeDrone);

    // A faint second contact, far out.
    drawDrone({
      x: W * 0.94,
      y: H * 0.16,
      rotor: d.rotor * 0.7,
      bob: d.bob + 2,
      size: 0.65,
      hp: 5,
      maxHp: 5,
      dead: false,
      hitFlash: 0,
      warning: 0,
      muzzle: 0,
      rot: 0,
    });
  }

  function drawBattleScene() {
    for (const e of game.enemies) drawGroundEnemy(e);
    for (const d of game.drones) drawDrone(d);
    drawPlayer();
    drawTracers();
    drawBullets();
    drawStrikes();
    drawShocks();
  }

  function buildMenuBackdrop() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawSky();
    drawFarCity();
    drawMidGround();
    drawNearGround();
    drawGround();
    drawBattlefieldProps();
    drawForegroundDetails();
    drawMenuScene();
    drawAsh();
    const c = document.createElement("canvas");
    c.width = canvas.width;
    c.height = canvas.height;
    c.getContext("2d").drawImage(canvas, 0, 0);
    menuBackdrop = c;
    try {
      startScreen.style.backgroundImage = `url(${c.toDataURL("image/jpeg", 0.82)})`;
      startScreen.style.backgroundSize = "cover";
      startScreen.style.backgroundPosition = "center";
    } catch (e) {}
  }

  function drawScreenFlash() {
    if (game.flash <= 0.002) return;
    ctx.save();
    ctx.fillStyle = `rgba(${game.flashColor},${clamp(game.flash * 0.32, 0, 0.32)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (game.shake > 0.25) {
      ctx.translate(rand(-game.shake, game.shake), rand(-game.shake, game.shake));
    }

    if (game.state === "menu") {
      if (!menuBackdrop) buildMenuBackdrop();
      ctx.drawImage(menuBackdrop, 0, 0, W, H);
      drawMenuScene();
      drawAsh();
      ctx.restore();
      return;
    }

    drawSky();
    drawFarCity();
    drawMidGround();
    drawNearGround();
    drawGround();
    drawBattlefieldProps();
    drawParticles("bg");

    if (game.state === "menu") {
      drawMenuScene();
    } else if (game.state === "extraction" || game.state === "victory") {
      drawExtractionScene();
    } else {
      drawBattleScene();
    }

    drawForegroundDetails();
    drawParticles("fg");
    drawAsh();
    ctx.restore();
    drawScreenFlash();
  }

  // =========================================================
  //  BOOT
  // =========================================================
  if (new URLSearchParams(window.location.search).has("debug")) {
    window.__steel = {
      game,
      startGame,
      resetGame,
      beginExtraction,
      showVictory,
      useAbility,
      shoot,
      spawnGroundEnemy,
      spawnDrone,
    };
  }

  let lastFrame = performance.now();

  function loop(now) {
    let dt = (now - lastFrame) / 1000;
    lastFrame = now;
    if (game.state === "menu") {
      requestAnimationFrame(loop);
      return;
    }
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.05);
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  resize();
  game.player = createPlayer();
  game.menuDrone.x = W * 0.82;
  game.menuDrone.y = H * 0.24;
  buildMenuBackdrop();
  canvas.style.display = "none";
  updateHud();
  updateSoundButton();
  requestAnimationFrame(loop);
})();
