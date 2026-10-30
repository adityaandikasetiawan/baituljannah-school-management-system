import "dotenv/config";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/client.js";
const app = createApp();
const server = app.listen(env.API_PORT, () => console.info(`Baituljannah API listening on http://localhost:${env.API_PORT}`));
async function shutdown() { server.close(); await pool.end(); }
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
