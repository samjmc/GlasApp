import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Polyfill for import.meta.dirname (Node.js <20.11.0 compatibility)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Serve the built client from the public directory.
 *
 * This lives apart from ./vite so the production bundle never imports vite, the vite
 * config, or the react plugin: those are devDependencies and are not installed in the
 * production image.
 */
export function serveStatic(app: Express, distPath = path.resolve(__dirname, "public")) {
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // A missing file under these is a 404, not the page. An open tab from before a deploy asks
  // for old hashed /assets files; index.html with a 200 gives it a MIME error instead.
  app.use(["/assets", "/uploads"], (_req, res) => {
    res.sendStatus(404);
  });

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
