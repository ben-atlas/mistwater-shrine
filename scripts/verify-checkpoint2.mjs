import puppeteer from "../../valley-of-giants-404/node_modules/puppeteer/lib/puppeteer/puppeteer.js";
import { writeFile } from "node:fs/promises";

const url = process.argv[2] || "http://127.0.0.1:4177/?deterministicCapture=1";
const out = "/Users/atlas/telegram-workspace/outputs/goal7-checkpoint2-combat";
const browser = await puppeteer.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--no-sandbox", "--use-angle=swiftshader"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction(() => window.__READY__ === true, { timeout: 90000 });
await page.evaluate(() => window.__START__());
const initial = await page.evaluate(() => window.__GAME__);

// Face and strike the first melee warden. Priming only shortens the audit;
// the hit still travels through the production input and damage path.
await page.evaluate(() => window.__COMBAT_TEST__.teleport(.55, -15.7));
await page.evaluate(() => window.__COMBAT_TEST__.primeEnemy(0));
await page.keyboard.down("KeyW"); await page.evaluate(() => window.__STEP__(2)); await page.keyboard.up("KeyW");
await page.keyboard.press("KeyJ"); await page.evaluate(() => window.__STEP__(2));
const afterMelee = await page.evaluate(() => ({ game: window.__GAME__, enemy: window.__COMBAT_TEST__.enemy(0) }));

// Enter ranged aggro and catch both the warning/bomb and eventual damage.
await page.evaluate(() => window.__COMBAT_TEST__.teleport(-3.35, -20.05));
await page.evaluate(() => window.__COMBAT_TEST__.launchBomb(1));
await page.evaluate(() => window.__STEP__(20));
const telegraph = await page.evaluate(() => window.__GAME__);
await page.screenshot({ path: `${out}.png` });
await page.evaluate(() => window.__STEP__(45));
const afterBomb = await page.evaluate(() => window.__GAME__);

// Confirm moving K produces an invulnerable dodge state.
await page.keyboard.down("KeyD"); await page.evaluate(() => window.__STEP__(6)); await page.keyboard.down("KeyK");
const dodge = await page.evaluate(() => { window.__STEP__(2); return window.__GAME__; });
await page.keyboard.up("KeyK"); await page.keyboard.up("KeyD");
const report = { url, initial, afterMelee, telegraph, afterBomb, dodge, errors, assertions: {
  rolesPresent: initial.combat.enemiesAlive === 3,
  meleeDefeated: afterMelee.enemy.alive === false && afterMelee.game.combat.hits >= 1,
  rangedBombTelegraphed: telegraph.combat.bombs > 0,
  bombResolved: afterBomb.combat.bombs === 0,
  playerDamaged: afterBomb.health < 100,
  dodgeActivated: dodge.combat.dodging === true,
  cleanRuntime: errors.length === 0,
} };
await writeFile(`${out}-report.json`, JSON.stringify(report, null, 2));
await browser.close();
if (Object.values(report.assertions).some(v => !v)) { console.error(JSON.stringify(report, null, 2)); process.exit(1); }
console.log(JSON.stringify(report.assertions));
