import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const buildRoot = resolve(".ci-workspaces/snake-game/build");

function startServer(): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolveReady, reject) => {
    const server = createServer(async (req, res) => {
      try {
        if (req.url === "/" || req.url === "/index.html") {
          res.setHeader("content-type", "text/html; charset=utf-8");
          res.end(await readFile(resolve(buildRoot, "index.html"), "utf8"));
          return;
        }
        if (req.url === "/src/main.js") {
          res.setHeader("content-type", "text/javascript; charset=utf-8");
          res.end(await readFile(resolve(buildRoot, "src/main.js"), "utf8"));
          return;
        }
        res.statusCode = 404;
        res.end("not found");
      } catch (error) {
        res.statusCode = 500;
        res.end(error instanceof Error ? error.message : "server error");
      }
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("runtime server address unavailable"));
      resolveReady({
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise<void>((done, closeReject) => server.close((error) => error ? closeReject(error) : done())),
      });
    });
  });
}

test("generated Snake loads and responds in Chromium without runtime errors", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });

  const server = await startServer();
  try {
    await page.goto(server.url, { waitUntil: "networkidle" });
    const canvas = page.locator("#game");
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute("width", "360");
    await expect(canvas).toHaveAttribute("height", "640");

    const before = await canvas.screenshot();
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(250);
    const after = await canvas.screenshot();

    expect(Buffer.compare(before, after)).not.toBe(0);
    expect(runtimeErrors).toEqual([]);
  } finally {
    await server.close();
  }
});
