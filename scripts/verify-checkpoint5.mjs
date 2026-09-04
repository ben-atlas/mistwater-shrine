import puppeteer from "../../valley-of-giants-404/node_modules/puppeteer/lib/puppeteer/puppeteer.js";
import { writeFile } from "node:fs/promises";

const url = process.argv[2] || "http://127.0.0.1:4177/?deterministicCapture=1";
const out = "/Users/atlas/telegram-workspace/outputs/goal7-checkpoint5-rescue-hub";
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
await page.evaluate(() => { window.__COMBAT_TEST__.teleport(.2, -22.2); window.__STEP__(45); });
const game = await page.evaluate(() => structuredClone(window.__GAME__));
await page.screenshot({ path: `${out}.png` });
const assertions = {
  floodedIslandHub: game.hub.islands >= 6,
  branchingLoops: game.hub.loops >= 3,
  gatedShortcut: game.hub.shortcuts >= 1,
  centralPagoda: game.hub.pagoda === "CentralRescuePagoda",
  rescueObjectives: game.hub.rescueBeacons === 3,
  authoredEnemyPosts: game.hub.enemyPosts === 3 && game.combat.enemiesAlive === 3,
  priorLightingPreserved: game.atmosphere.mistBanks === 8 && game.horizon.cloudLayers >= 5,
  cleanRuntime: errors.length === 0,
};
const report = { url, game, errors, assertions };
await writeFile(`${out}-report.json`, JSON.stringify(report, null, 2));
await browser.close();
if (Object.values(assertions).some((value) => !value)) {
  console.error(JSON.stringify(report, null, 2)); process.exit(1);
}
console.log(JSON.stringify(assertions));
