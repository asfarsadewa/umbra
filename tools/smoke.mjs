/**
 * Headless smoke test: loads the built game in Chrome, captures console errors,
 * verifies the WebGL scene built, exercises the real input layer, checks the
 * title screen and several levels, and saves screenshots.
 *
 * Usage: node tools/smoke.mjs [url]
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const URL = process.argv[2] ?? "http://localhost:4173/";
const PORT = 9333;
const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];

const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chromePath) {
  console.error("No Chrome/Edge found");
  process.exit(1);
}
mkdirSync(resolve(".smoke"), { recursive: true });

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--enable-unsafe-swiftshader",
    "--autoplay-policy=no-user-gesture-required",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    `--remote-debugging-port=${PORT}`,
    "--window-size=1280,800",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${resolve(".smoke/profile")}`,
    URL,
  ],
  { stdio: ["ignore", "ignore", "ignore"], cwd: process.cwd() },
);

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTargets() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // not ready
    }
    await delay(250);
  }
  throw new Error("Chrome DevTools endpoint not ready");
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      } else if (message.method) {
        this.events.push(message);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function main() {
  const target = await getTargets();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const cdp = new CDP(ws);
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Page.enable");

  await delay(3800);

  const evaluate = async (expression) => {
    const result = await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) return { error: result.exceptionDetails.text };
    return result.result.value;
  };

  // Start from a clean profile so the campaign opens on level 001.
  await evaluate(`localStorage.clear()`);
  await cdp.send("Page.reload");
  await delay(3800);

  const key = (k) =>
    evaluate(
      `window.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', bubbles: true, cancelable: true }))`,
    );

  /** Choose a sun direction and wait until the turn has actually resolved. */
  const sunAndWait = async (k) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const before = await evaluate(`window.umbra.game().state.turn`);
      await key(k);
      for (let i = 0; i < 60; i++) {
        const status = await evaluate(
          `(() => ({
            turn: window.umbra.game().state.turn,
            mode: window.umbra.game().mode,
            overlay: !document.getElementById('overlay').classList.contains('hidden'),
          }))()`,
        );
        const settled =
          status &&
          status.turn > before &&
          (status.mode === "waiting" || status.overlay);
        if (settled) {
          await delay(status.overlay ? 600 : 180);
          return;
        }
        await delay(120);
      }
    }
    const debug = await evaluate(
      `(() => ({
        turn: window.umbra.game().state.turn,
        mode: window.umbra.game().mode,
        level: window.umbra.game().state.levelId,
        overlay: !document.getElementById('overlay').classList.contains('hidden'),
        uiActive: document.activeElement?.tagName ?? null,
      }))()`,
    );
    throw new Error(`sun input ${k} did not resolve: ${JSON.stringify(debug)}`);
  };

  const info = await evaluate(`(() => {
    try {
      const canvas = document.querySelector('canvas');
      const hook = window.umbra;
      if (!hook) return { error: 'no window.umbra hook' };
      const game = hook.game();
      const gl = hook.renderer.gl;
      const scene = hook.renderer.sceneBuilder.scene;
      const cam = hook.renderer.cameraController.camera;
      gl.render(scene, cam);
      const ctx = gl.getContext();
      const w = ctx.drawingBufferWidth, h = ctx.drawingBufferHeight;
      const px = new Uint8Array(w * h * 4);
      ctx.readPixels(0, 0, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
      let nonDark = 0, lumSum = 0;
      for (let i = 0; i < px.length; i += 4) {
        const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        if (l > 25) nonDark++;
        lumSum += l;
      }
      const names = [];
      scene.traverse((o) => { if (o.name) names.push(o.name); });
      return {
        hasCanvas: !!canvas,
        canvasW: canvas ? canvas.width : 0,
        canvasH: canvas ? canvas.height : 0,
        hasContext: !!(canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'))),
        sceneChildren: scene.children.length,
        hasBoard: names.includes('Board'),
        hasCasters: names.includes('Casters'),
        hasShadows: names.includes('Shadows'),
        hasShades: names.includes('Shades'),
        hasSunRig: names.includes('SunRig'),
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        glError: ctx.getError(),
        readNonDark: +(nonDark / (w * h)).toFixed(4),
        readLuminance: +(lumSum / (w * h)).toFixed(1),
        frustum: [cam.left, cam.right, cam.top, cam.bottom].map((n) => +n.toFixed(2)),
        level: game.state.levelId,
        width: game.state.width,
        height: game.state.height,
      };
    } catch (e) {
      return { error: String((e && e.stack) || e) };
    }
  })()`);

  // The pre-title gateway must be present, capture a gesture, then reveal the
  // title screen (this is what lets the browser start audio).
  const gate = await evaluate(`(() => {
    const overlay = document.getElementById('overlay');
    return {
      gateMode: overlay.classList.contains('gate-mode'),
      hasVeil: !!document.querySelector('.gate-veil'),
      hasCorona: !!document.querySelector('.gate-corona'),
      kicker: document.querySelector('.gate-kicker')?.textContent ?? null,
      button: (document.querySelector('.gate-begin')?.textContent ?? '').trim() || null,
      titlePresent: !!document.querySelector('.title-screen'),
    };
  })()`);
  const gateShot = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(".smoke/gate.png", Buffer.from(gateShot.data, "base64"));

  await evaluate(`document.querySelector('.gate-begin')?.click()`);
  await delay(1900);
  const gateOpened = await evaluate(`(() => ({
    gateGone: !document.querySelector('.gate-veil'),
    titleMode: document.getElementById('overlay').classList.contains('title-mode'),
    word: document.querySelector('.title-word')?.textContent ?? null,
  }))()`);

  // Inspect the opening screen.
  const title = await evaluate(`(() => {
    const overlay = document.getElementById('overlay');
    const hook = window.umbra;
    return {
      visible: !overlay.classList.contains('hidden'),
      titleMode: overlay.classList.contains('title-mode'),
      word: document.querySelector('.title-word')?.textContent ?? null,
      tagline: (document.querySelector('.title-tagline')?.textContent ?? '').trim() || null,
      primary: (document.querySelector('.title-actions button.primary')?.textContent ?? '').trim() || null,
      scenes: {
        titleVisible: hook.renderer.titleScene.group.visible,
        boardVisible: hook.renderer.sceneBuilder.scene.getObjectByName('Board')?.visible,
      },
      mode: hook.renderer.isTitle ? 'title' : 'game',
    };
  })()`);

  const titleShot = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(".smoke/title.png", Buffer.from(titleShot.data, "base64"));

  // BEGIN captures a gesture, keeps audio running, and enters the first courtyard.
  await evaluate(`document.querySelector('.title-actions button.primary')?.click()`);
  await delay(1400);

  const started = await evaluate(`(() => {
    const hook = window.umbra;
    const g = hook.game();
    return {
      level: g.state.levelId,
      name: g.state.levelName,
      sun: g.state.sun,
      turn: g.state.turn,
      status: g.state.status,
      overlayHidden: document.getElementById('overlay').classList.contains('hidden'),
      sunText: document.getElementById('sun-indicator')?.textContent ?? null,
      hintVisible: document.getElementById('hint')?.classList.contains('visible'),
      titleVisible: hook.renderer.titleScene.group.visible,
      audioCtx: hook.audio.ctx ? hook.audio.ctx.state : null,
      music: hook.audio.currentRequest?.name ?? null,
    };
  })()`);

  const levelShot = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(".smoke/level.png", Buffer.from(levelShot.data, "base64"));

  // Prove the AI shade's rig and clips are actually bound: a bone quaternion
  // must change while the idle clip plays.
  const boneExpr = `(() => {
    const r = window.umbra.renderer;
    const views = [...r.shadeRenderer.views.values()];
    const v = views[0];
    if (!v) return { error: 'no shade view' };
    let bone = null;
    v.root.traverse((o) => { if (!bone && o.isBone && o.name === 'Spine') bone = o; });
    let skinned = 0;
    v.root.traverse((o) => { if (o.isSkinnedMesh) skinned++; });
    return {
      mixer: !!v.mixer,
      idle: !!v.idleAction,
      walk: !!v.walkAction,
      skinned,
      bone: bone ? bone.quaternion.toArray().map((n) => +n.toFixed(4)) : null,
    };
  })()`;
  const rigA = await evaluate(boneExpr);
  await delay(900);
  const rigB = await evaluate(boneExpr);
  const models = {
    ...rigB,
    boneAnimated:
      Array.isArray(rigA.bone) &&
      Array.isArray(rigB.bone) &&
      JSON.stringify(rigA.bone) !== JSON.stringify(rigB.bone),
  };

  // Level 001's solution is S → S (sun south twice).
  await sunAndWait("ArrowDown");
  const afterOne = await evaluate(`(() => {
    const g = window.umbra.game();
    return {
      turn: g.state.turn,
      sun: g.state.sun,
      shade: g.state.shades[0].position,
      hintVisible: document.getElementById('hint')?.classList.contains('visible'),
    };
  })()`);
  await sunAndWait("ArrowDown");
  await delay(600);
  const solved = await evaluate(`(() => {
    const g = window.umbra.game();
    const overlay = document.getElementById('overlay');
    return {
      status: g.state.status,
      turn: g.state.turn,
      overlayVisible: !overlay.classList.contains('hidden'),
      kicker: document.querySelector('.panel-kicker')?.textContent ?? null,
      turnsHud: document.getElementById('turn-count')?.textContent ?? null,
    };
  })()`);

  // Advance through the solved panel, then exercise undo / restart / pause.
  await evaluate(`document.querySelector('.panel-actions button.primary')?.click()`);
  await delay(900);
  const level2 = await evaluate(`window.umbra.game().state.levelId`);
  await sunAndWait("ArrowDown");
  const beforeUndo = await evaluate(`window.umbra.game().state.turn`);
  await key("z");
  await delay(650);
  const afterUndo = await evaluate(`window.umbra.game().state.turn`);

  // Restart and pause via real input.
  await key("r");
  await delay(600);
  const afterRestart = await evaluate(`window.umbra.game().state.turn`);
  await key("Escape");
  await delay(500);
  const pause = await evaluate(`(() => ({
    visible: !document.getElementById('overlay').classList.contains('hidden'),
    kicker: document.querySelector('.panel-kicker')?.textContent ?? null,
    cards: document.querySelectorAll('.level-card').length,
  }))()`);
  const camBefore = await evaluate(`+window.umbra.renderer.cameraController.camera.position.y.toFixed(3)`);
  await evaluate(
    `[...document.querySelectorAll('.camera-option')].find((b) => b.dataset.camera === 'elevated')?.click()`,
  );
  await delay(1200);
  const camAfter = await evaluate(`+window.umbra.renderer.cameraController.camera.position.y.toFixed(3)`);
  await evaluate(
    `[...document.querySelectorAll('.camera-option')].find((b) => b.dataset.camera === 'classic')?.click()`,
  );
  await delay(400);
  await evaluate(`window.umbra.ui.hideOverlay()`);
  const navigation = { level2, beforeUndo, afterUndo, afterRestart, pause, camBefore, camAfter };

  // Sunset: force one unit of daylight, then spend it.
  await evaluate(`window.umbra.startLevel(15)`);
  await delay(700);
  const daylightBefore = await evaluate(`(() => {
    const g = window.umbra.game();
    g.state.daylight = 1;
    window.umbra.ui.setStateHud(g.state);
    return { daylight: g.state.daylight, hud: document.getElementById('daylight')?.textContent };
  })()`);
  await sunAndWait("ArrowUp");
  await delay(1200);
  const sunset = await evaluate(`(() => {
    const g = window.umbra.game();
    return {
      status: g.state.status,
      daylight: g.state.daylight,
      overlayVisible: !document.getElementById('overlay').classList.contains('hidden'),
      kicker: document.querySelector('.panel-kicker')?.textContent ?? null,
    };
  })()`);

  // The low-daylight styling must clear when returning to an unlimited level.
  await evaluate(`window.umbra.startLevel(15)`);
  await delay(600);
  await evaluate(
    `(() => { const g = window.umbra.game(); g.state.daylight = 2; window.umbra.ui.setStateHud(g.state); })()`,
  );
  const daylightLow = await evaluate(
    `document.getElementById('daylight').classList.contains('low')`,
  );
  await evaluate(`window.umbra.startLevel(0)`);
  await delay(600);
  const daylightLowCleared = await evaluate(`(() => ({
    low: document.getElementById('daylight').classList.contains('low'),
    text: document.getElementById('daylight').textContent,
  }))()`);
  const daylightClass = { lowOnSunset: daylightLow, afterUnlimited: daylightLowCleared };

  // ---- Postgame: the ending, the choice, and both branches ----
  await evaluate(`window.umbra.startLevel(window.umbra.levelById("018"))`);
  await delay(600);
  await evaluate(`window.umbra.showEnding()`);
  await delay(3200);
  const ending = await evaluate(`(() => {
    const screen = document.querySelector('.postgame-screen');
    const choices = [...document.querySelectorAll('.postgame-choice')].map((b) =>
      (b.querySelector('.postgame-choice-label')?.textContent ?? '').trim(),
    );
    return {
      present: !!screen,
      title: document.querySelector('.postgame-title')?.textContent ?? null,
      kicker: document.querySelector('.postgame-kicker')?.textContent ?? null,
      choices,
      hudFaded: getComputedStyle(document.getElementById('hud')).opacity,
    };
  })()`);
  const endingShot = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(".smoke/ending.png", Buffer.from(endingShot.data, "base64"));

  // Deep Umbra must run on the original rules.
  await evaluate(
    `[...document.querySelectorAll('.postgame-choice')].find((b) => b.classList.contains('deep'))?.click()`,
  );
  await delay(900);
  const deep = await evaluate(`(() => {
    const g = window.umbra.game();
    return {
      level: g.state.levelId,
      name: g.state.levelName,
      rules: g.state.rules,
      entities: g.state.shades.map((e) => e.kind),
      par: g.state.par,
    };
  })()`);

  // Penumbra: the half-light reveal, then P001 with a Wraith.
  await evaluate(`window.umbra.startLevel(window.umbra.levelById("018"))`);
  await delay(400);
  // Force the first-time path so the half-light reveal itself is exercised.
  await evaluate(`(() => { window.umbra.save.data.seenPostgameChoice = false; })()`);
  await evaluate(`window.umbra.enterPenumbra()`);
  await delay(1400);
  const penumbraIntro = await evaluate(`(() => ({
    word: document.querySelector('.penumbra-word')?.textContent ?? null,
    line: document.querySelector('.penumbra-line')?.textContent ?? null,
  }))()`);
  const introShot = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(".smoke/penumbra-intro.png", Buffer.from(introShot.data, "base64"));
  await delay(2600);
  const penumbra = await evaluate(`(() => {
    const g = window.umbra.game();
    const r = window.umbra.renderer;
    const view = [...r.shadeRenderer.views.values()][0];
    let skinned = 0;
    if (view) view.root.traverse((o) => { if (o.isSkinnedMesh) skinned++; });
    return {
      level: g.state.levelId,
      rules: g.state.rules,
      entities: g.state.shades.map((e) => e.kind),
      legendVisible: document.getElementById('legend')?.classList.contains('visible'),
      legendText: document.getElementById('legend')?.textContent ?? null,
      skinned,
      animated: !!(view && view.mixer),
    };
  })()`);
  await evaluate(
    `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))`,
  );
  await delay(1200);
  const penumbraAfterMove = await evaluate(`(() => {
    const g = window.umbra.game();
    return { turn: g.state.turn, status: g.state.status, pos: g.state.shades[0].position };
  })()`);
  const penumbraShot = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(".smoke/penumbra.png", Buffer.from(penumbraShot.data, "base64"));

  // Level select must separate the postgame from the campaign (the ending
  // normally marks 018 complete; the debug trigger does not, so set it here).
  await evaluate(
    `(() => { const s = window.umbra.save; s.data.campaignComplete = true; s.data.postgameUnlocked = true; if (!s.data.completed.includes("018")) s.data.completed.push("018"); })()`,
  );
  await evaluate(`window.umbra.ui.showLevelSelect(window.umbra.levels, window.umbra.campaignCount, window.umbra.save.data)`);
  await delay(400);
  const select = await evaluate(`(() => {
    const labels = [...document.querySelectorAll('.chapter-label, .section-label')].map((n) => n.textContent);
    return { labels, cards: document.querySelectorAll('.level-card').length, divider: !!document.querySelector('.postgame-divider') };
  })()`);
  await evaluate(`window.umbra.ui.hideOverlay()`);

  const postgame = { ending, deep, penumbraIntro, penumbra, penumbraAfterMove, select };

  // Every level must frame inside the orthographic frustum.
  const framing = [];
  for (let i = 0; i < 18; i++) {
    await evaluate(`window.umbra.startLevel(${i})`);
    await delay(300);
    const frame = await evaluate(`(() => {
      try {
        const hook = window.umbra;
        const game = hook.game();
        const cam = hook.renderer.cameraController.camera;
        hook.renderer.gl.render(hook.renderer.sceneBuilder.scene, cam);
        const hw = game.state.width / 2, hh = game.state.height / 2;
        let minX = 9, maxX = -9, minY = 9, maxY = -9;
        for (const sx of [-hw, hw]) for (const sz of [-hh, hh]) for (const y of [-1.2, 2.2]) {
          const v = cam.position.clone().set(sx, y, sz).project(cam);
          minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
          minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
        }
        return {
          id: game.state.levelId,
          bounds: [minX, maxX, minY, maxY].map((n) => +n.toFixed(2)),
          fits: minX > -1.02 && maxX < 1.02 && minY > -1.02 && maxY < 1.02,
        };
      } catch (e) {
        return { error: String(e) };
      }
    })()`);
    framing.push(frame);
  }

  // Targeted screenshots for the stones and eclipse chapters.
  for (const [index, name] of [[13, "stones"], [15, "eclipse"]]) {
    await evaluate(`window.umbra.startLevel(${index})`);
    await delay(800);
    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`.smoke/${name}.png`, Buffer.from(shot.data, "base64"));
  }

  // Finale screenshot.
  await evaluate(`window.umbra.startLevel(17)`);
  await delay(700);
  const finalShot = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(".smoke/finale.png", Buffer.from(finalShot.data, "base64"));

  const errors = cdp.events
    .filter(
      (e) =>
        e.method === "Runtime.exceptionThrown" ||
        (e.method === "Log.entryAdded" && e.params.entry.level === "error") ||
        (e.method === "Runtime.consoleAPICalled" && e.params.type === "error"),
    )
    .map((e) => JSON.stringify(e.params).slice(0, 400));

  console.log(
    JSON.stringify(
      {
        info,
        gate,
        gateOpened,
        title,
        started,
        models,
        afterOne,
        solved,
        navigation,
        daylightBefore,
        sunset,
        daylightClass,
        postgame,
        framing,
        errors,
      },
      null,
      2,
    ),
  );
  ws.close();
}

main()
  .catch((error) => {
    console.error("SMOKE FAILED:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    chrome.kill();
    setTimeout(() => process.exit(process.exitCode ?? 0), 300);
  });
