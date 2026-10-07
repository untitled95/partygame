(function () {
  "use strict";
  const { levels, createState, step, patrolAt } = Platformer;
  const $ = (id) => document.getElementById(id);
  const canvas = $("game"),
    ctx = canvas.getContext("2d");
  const overlay = $("overlay"),
    primary = $("primary-action");
  const keys = new Set(),
    pointers = new Map();
  let jumpQueued = false,
    state = createState(),
    raf = 0,
    last = 0,
    accumulator = 0,
    noticeTimer;
  let view = { width: 960, height: 440, scale: 1, dpr: 1 },
    camera = 0;
  const storageKey = "partygame:platformer:v1";
  let progress = { unlocked: 1, records: [null, null, null] };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && Number.isInteger(saved.unlocked))
      progress.unlocked = Math.max(1, Math.min(3, saved.unlocked));
    if (Array.isArray(saved?.records))
      progress.records = levels.map((level, i) => {
        const r = saved.records[i];
        return r &&
          Number.isFinite(r.time) &&
          r.time > 0 &&
          Number.isInteger(r.stars) &&
          r.stars >= 0 &&
          r.stars <= level.coins.length
          ? r
          : null;
      });
  } catch {}
  const cat = new Image();
  cat.src = "/huarongdao/assets/cao.png";
  cat.onload = draw;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const formatTime = (t) =>
    `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  function clearInput() {
    keys.clear();
    pointers.clear();
    jumpQueued = false;
    document
      .querySelectorAll("[data-control]")
      .forEach((b) => b.classList.remove("pressed"));
  }
  function held(action) {
    return keys.has(action) || [...pointers.values()].includes(action);
  }
  function announce(message) {
    $("game-status").textContent = message;
  }
  function notice(message) {
    clearTimeout(noticeTimer);
    $("checkpoint-notice").textContent = message;
    noticeTimer = setTimeout(
      () => ($("checkpoint-notice").textContent = ""),
      2000,
    );
    announce(message);
  }
  function updateStats() {
    $("stars").textContent =
      `${state.collected.size} / ${levels[state.index].coins.length}`;
    $("time").textContent = formatTime(state.time);
    $("deaths").textContent = state.deaths;
  }
  function refreshLevels() {
    document.querySelectorAll("[data-level]").forEach((b) => {
      const i = Number(b.dataset.level);
      b.disabled = i >= progress.unlocked;
      b.classList.toggle("active", i === state.index);
      b.setAttribute("aria-pressed", String(i === state.index));
      b.title = i >= progress.unlocked ? "通过前一关后解锁" : levels[i].name;
    });
    const best = progress.records[state.index];
    $("best-note").textContent = best
      ? `最佳用时 ${formatTime(best.time)} · 最多星光 ${best.stars}/${levels[state.index].coins.length}`
      : "星光可选收集，放心探索。";
  }
  function showOverlay(kicker, title, description, button) {
    clearInput();
    overlay.hidden = false;
    $("overlay-kicker").textContent = kicker;
    $("overlay-title").textContent = title;
    $("overlay-description").textContent = description;
    primary.textContent = button;
    $("pause").disabled = state.phase === "ready" || state.phase === "won";
    $("pause").textContent = state.phase === "paused" ? "继续" : "暂停";
  }
  function loadLevel(index) {
    if (index >= progress.unlocked) return;
    cancelAnimationFrame(raf);
    state = createState(index);
    camera = 0;
    clearInput();
    clearTimeout(noticeTimer);
    $("checkpoint-notice").textContent = "";
    $("level-description").textContent = levels[index].subtitle;
    $("progress-note").textContent =
      "到达终点解锁下一关。检查点会记住你的落脚处。";
    refreshLevels();
    updateStats();
    showOverlay(
      `第 ${index + 1} 关 · ${levels[index].name}`,
      "出发，去找星光。",
      "跳过断崖，收集沿途星光。走到路的尽头，就能开启下一程。",
      "开始远行",
    );
    draw();
  }
  function start() {
    clearInput();
    state.phase = "playing";
    overlay.hidden = true;
    $("pause").disabled = false;
    $("pause").textContent = "暂停";
    canvas.focus({ preventScroll: true });
    last = 0;
    accumulator = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
    announce(
      `第 ${state.index + 1} 关，${levels[state.index].name}。左右移动，空格跳跃。`,
    );
  }
  function pause() {
    if (state.phase !== "playing") return;
    state.phase = "paused";
    cancelAnimationFrame(raf);
    showOverlay(
      levels[state.index].name,
      "歇一会，再出发。",
      "进度保留在这里。准备好了就继续。",
      "继续远行",
    );
    announce("游戏已暂停");
    draw();
  }
  function won() {
    const old = progress.records[state.index];
    progress.records[state.index] = {
      time: Math.min(old?.time || Infinity, state.time),
      stars: Math.max(old?.stars || 0, state.collected.size),
    };
    progress.unlocked = Math.max(
      progress.unlocked,
      Math.min(3, state.index + 2),
    );
    try {
      localStorage.setItem(storageKey, JSON.stringify(progress));
    } catch {}
    refreshLevels();
    const final = state.index === levels.length - 1;
    showOverlay(
      `第 ${state.index + 1} 关完成`,
      final ? "星光到家，你也到了。" : "这一程，走得漂亮。",
      `收集 ${state.collected.size}/${levels[state.index].coins.length} 颗星光，用时 ${formatTime(state.time)}，重试 ${state.deaths} 次。`,
      final ? "再走一遍" : "前往下一关",
    );
    $("progress-note").textContent = final
      ? "三关全部完成！可以选择任意关卡，再挑战全星光。"
      : "下一关已解锁，通关记录已保存。";
    announce(final ? "恭喜，三关全部通关！" : "本关完成，下一关已解锁。");
    primary.focus({ preventScroll: true });
  }
  function tick(now) {
    if (state.phase !== "playing") return;
    if (!last) last = now;
    accumulator += Math.min((now - last) / 1000, 0.1);
    last = now;
    while (accumulator >= 1 / 120 && state.phase === "playing") {
      step(
        state,
        {
          left: held("left"),
          right: held("right"),
          jumpPressed: jumpQueued,
          jumpHeld: held("jump"),
        },
        1 / 120,
      );
      jumpQueued = false;
      accumulator -= 1 / 120;
      if (state.event === "checkpoint") notice("检查点已点亮");
      if (state.event === "respawn") {
        clearInput();
        notice(
          state.checkpoint >= 0
            ? "回到检查点，再试一次。"
            : "没关系，再来一次。",
        );
      }
      if (state.event === "won") won();
    }
    updateStats();
    draw();
    if (state.phase === "playing") raf = requestAnimationFrame(tick);
  }
  function rect(x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }
  function hill(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  function draw() {
    if (!ctx) return;
    const level = levels[state.index],
      dark = document.documentElement.dataset.theme === "dark";
    const palettes = {
      meadow: dark
        ? ["#253335", "#34494a", "#405c51", "#759887", "#425549"]
        : ["#e9eddf", "#d9e2cb", "#b2c4a3", "#78936d", "#b6c3a1"],
      sunset: dark
        ? ["#382d2c", "#513e37", "#72534a", "#b78c6f", "#64504a"]
        : ["#f2e7d7", "#e4cfb7", "#d0ab91", "#ad7e62", "#c6aa92"],
      cloud: dark
        ? ["#292f3b", "#3b4356", "#4c5c71", "#91a9ba", "#485769"]
        : ["#e4eaed", "#cddae0", "#afc4ce", "#819ca8", "#a8b9c2"],
    };
    const [sky, far, near, grass, stone] = palettes[level.palette];
    ctx.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, 0, 0);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, view.width, 440);
    camera = Math.max(
      0,
      Math.min(level.width - view.width, state.player.x - view.width * 0.34),
    );
    hill(view.width - 110, 88, 31, 31, dark ? "#ded4bb" : "#fbf5d9");
    for (let i = -1; i < 7; i++) {
      const x = i * 310 - ((camera * 0.15) % 310);
      hill(x, 335, 255, 175, far);
      hill(x + 170, 390, 225, 155, near);
      const cloudX = i * 290 - ((camera * 0.08) % 290);
      hill(cloudX + 90, 84, 43, 10, dark ? "#617476" : "#f6f6ed");
      hill(cloudX + 75, 77, 24, 14, dark ? "#617476" : "#f6f6ed");
    }
    for (let i = -1; i < 12; i++) {
      const x = i * 180 - ((camera * 0.4) % 180);
      rect(x, 280, 7, 88, 2, near);
      hill(x + 4, 269, 25, 43, near);
      hill(x + 20, 292, 22, 31, near);
    }
    ctx.save();
    ctx.translate(-camera, 0);
    for (const [x, y, w, h] of [...level.floors, ...level.platforms]) {
      if (x + w < camera || x > camera + view.width) continue;
      rect(x, y, w, h, 5, stone);
      rect(x, y, w, 7, 3, grass);
      ctx.fillStyle = dark ? "#ffffff12" : "#4b514018";
      for (let bx = x + 18; bx < x + w - 10; bx += 35) {
        ctx.fillRect(bx, y + 17, 9, 3);
        if (h > 30) ctx.fillRect(bx + 8, y + 43, 13, 3);
      }
    }
    for (const [x, y, w, h] of level.spikes) {
      ctx.fillStyle = dark ? "#e6a493" : "#99594e";
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      const count = Math.max(2, Math.round(w / 14));
      for (let i = 0; i < count; i++) {
        ctx.lineTo(x + ((i + 0.5) * w) / count, y);
        ctx.lineTo(x + ((i + 1) * w) / count, y + h);
      }
      ctx.fill();
    }
    for (const hazard of level.patrols) {
      const p = patrolAt(hazard, state.time);
      hill(p.x + 13, p.y + 13, 14, 14, dark ? "#efad95" : "#b86550");
      ctx.fillStyle = dark ? "#3f302e" : "#faf0db";
      ctx.fillRect(p.x + 6, p.y + 8, 4, 5);
      ctx.fillRect(p.x + 16, p.y + 8, 4, 5);
    }
    level.coins.forEach(([x, y], i) => {
      if (state.collected.has(i)) return;
      const offset = reduced.matches ? 0 : Math.sin(state.time * 3 + i) * 2;
      hill(x, y + offset, 8, 8, dark ? "#e4c282" : "#dfb96b");
      ctx.strokeStyle = dark ? "#f5dfad" : "#a47d3e";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y + offset, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#fff3ce";
      ctx.fillRect(x - 1, y + offset - 4, 2, 8);
      ctx.fillRect(x - 4, y + offset - 1, 8, 2);
    });
    level.checkpoints.forEach((point, i) => {
      rect(point.x, 310, 3, 60, 1, grass);
      ctx.fillStyle = i <= state.checkpoint ? "#c76c52" : near;
      ctx.beginPath();
      ctx.moveTo(point.x + 3, 310);
      ctx.lineTo(point.x + 25, 318);
      ctx.lineTo(point.x + 3, 326);
      ctx.fill();
    });
    const goal = level.goal;
    rect(goal.x - 4, goal.y, goal.w + 8, goal.h, 25, grass);
    rect(
      goal.x + 4,
      goal.y + 9,
      goal.w - 8,
      goal.h - 9,
      19,
      dark ? "#dec1a3" : "#f8e3bb",
    );
    ctx.fillStyle = dark ? "#2c3536" : "#596750";
    ctx.font = "500 12px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("终点", goal.x + goal.w / 2, goal.y - 12);
    const p = state.player;
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    ctx.scale(p.facing, 1);
    if (state.respawn > 0) ctx.globalAlpha = 0.45;
    ctx.imageSmoothingEnabled = false;
    if (cat.complete && cat.naturalWidth) ctx.drawImage(cat, -24, -25, 48, 48);
    else {
      rect(-14, -18, 28, 36, 8, "#c98b5c");
      rect(-10, -22, 7, 10, 2, "#c98b5c");
      rect(4, -22, 7, 10, 2, "#c98b5c");
    }
    ctx.restore();
    ctx.restore();
  }
  function resize() {
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    view.scale = box.height / 440;
    view.width = box.width / view.scale;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(box.width * view.dpr);
    canvas.height = Math.round(box.height * view.dpr);
    draw();
  }
  new ResizeObserver(resize).observe(canvas);
  new MutationObserver(draw).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  const keyMap = {
    ArrowLeft: "left",
    a: "left",
    A: "left",
    ArrowRight: "right",
    d: "right",
    D: "right",
    ArrowUp: "jump",
    w: "jump",
    W: "jump",
    " ": "jump",
  };
  document.addEventListener("keydown", (event) => {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)
    )
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      state.phase === "playing" ? pause() : state.phase === "paused" && start();
      return;
    }
    const action = keyMap[event.key];
    if (!action || state.phase !== "playing") return;
    if (event.key === " " && event.target.closest("button")) return;
    event.preventDefault();
    if (action === "jump" && !keys.has(action) && !event.repeat)
      jumpQueued = true;
    keys.add(action);
  });
  document.addEventListener("keyup", (event) => {
    const action = keyMap[event.key];
    if (action) {
      keys.delete(action);
      if (state.phase === "playing") event.preventDefault();
    }
  });
  document.querySelectorAll("[data-control]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      if (state.phase !== "playing") return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, button.dataset.control);
      button.classList.add("pressed");
      if (button.dataset.control === "jump") jumpQueued = true;
    });
    const release = (event) => {
      pointers.delete(event.pointerId);
      if (![...pointers.values()].includes(button.dataset.control))
        button.classList.remove("pressed");
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("contextmenu", (event) => event.preventDefault());
  });
  primary.addEventListener("click", () => {
    if (state.phase === "won")
      loadLevel(state.index === 2 ? 0 : state.index + 1);
    start();
  });
  $("pause").addEventListener("click", () =>
    state.phase === "playing" ? pause() : state.phase === "paused" && start(),
  );
  $("restart").addEventListener("click", () => loadLevel(state.index));
  document
    .querySelectorAll("[data-level]")
    .forEach((b) =>
      b.addEventListener("click", () => loadLevel(Number(b.dataset.level))),
    );
  window.addEventListener("blur", () => {
    clearInput();
    pause();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearInput();
      pause();
    }
  });
  window.addEventListener("pagehide", () => {
    clearInput();
    cancelAnimationFrame(raf);
    clearTimeout(noticeTimer);
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      state.phase = "paused";
      showOverlay(
        levels[state.index].name,
        "准备继续？",
        "离开前的位置保留在这里。",
        "继续远行",
      );
      draw();
    }
  });
  loadLevel(0);
  resize();
})();
