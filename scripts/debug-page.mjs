// Debug rapide : que contient la page d'accueil ?
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://localhost:3100", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);
const html = await page.content();
console.log("BODY (500 premiers caractères visibles) :");
console.log((await page.locator("body").innerText()).slice(0, 500));
console.log("\nINPUTS:", await page.locator("input").count());
console.log("ERREURS CONSOLE:", errors.slice(0, 5));
await browser.close();
