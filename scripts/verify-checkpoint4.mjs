import puppeteer from "../../valley-of-giants-404/node_modules/puppeteer/lib/puppeteer/puppeteer.js";
import { writeFile } from "node:fs/promises";

const url = process.argv[2] || "http://127.0.0.1:4177/?deterministicCapture=1";
const out = "/Users/atlas/telegram-workspace/outputs/goal7-checkpoint4-horizon";
const browser = await puppeteer.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--no-sandbox", "--use-angle=swiftshader"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction(() => window.__READY__ === true, { timeout: 90000 });
await page.evaluate(() => window.__START__());
await page.evaluate(() => { window.__COMBAT_TEST__.teleport(0.4, -42.2); window.__STEP__(24); });
const game = await page.evaluate(() => structuredClone(window.__GAME__));
await page.screenshot({ path: `${out}.png` });
const assertions = {
  layeredClouds: game.horizon.cloudLayers >= 5,
  atmosphericMountains: game.horizon.mountainLayers >= 2,
  bambooSilhouettes: game.horizon.bambooSilhouettes >= 18,
  submergedRuins: game.horizon.submergedRuins >= 4,
  birdsPresent: game.horizon.birds >= 7,
  driftingHorizonMist: game.horizon.mistBands >= 3,
  combatStillPlayable: game.combat.enemiesAlive === 3 && game.health === 100,
  lightingStillActive: game.atmosphere.mistBanks === 8 && game.atmosphere.lanternPools === 3,
  cleanRuntime: errors.length === 0,
};
const report = { url, game, errors, assertions };
await writeFile(`${out}-report.json`, JSON.stringify(report, null, 2));
await browser.close();
if (Object.values(assertions).some((value) => !value)) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(assertions));
