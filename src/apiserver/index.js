#!/usr/bin/env node

import express from "express";
import https from "node:https";
import router from "./router.js";
import fs from "node:fs";
import ensureSSLCertificate from "./certificate.js";
import config from "../../config.js";

const app = express();

// Initialize SSL certificate
const fingerprint = ensureSSLCertificate();

app.use("/" + config.ADMIN.SECRET_ENDPOINT, router);

app.all("*", (req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] : ${req.method} ${req.originalUrl}`,
  );
  next();
});

// Default catch-all endpoint for logging unimplemented routes
app.all("*", (req, res) => {
  console.log(
    `[${new Date().toISOString()}] Unimplemented endpoint: ${req.method} ${req.originalUrl}`,
  );
  res.status(404).json({
    code: "ENDPOINT_NOT_FOUND",
    message: `Endpoint ${req.method} ${req.originalUrl} not implemented`,
  });
});

if (!fs.existsSync(config.ADMIN.HTTPS_KEY)) {
  exit(1);
}

https
  .createServer(
    {
      key: fs.readFileSync(config.ADMIN.HTTPS_KEY, "utf8"),
      cert: fs.readFileSync(config.ADMIN.HTTPS_KEY, "utf8"),
    },
    app,
  )
  .listen(config.ADMIN.ADMIN_PORT, () => {
    console.log(
      `WireGuard API server running on HTTPS port ${config.ADMIN.ADMIN_PORT}`,
    );
    console.log(`Available endpoints:`);
    console.log(`  GET    /health              - Health check`);
    console.log(`  GET    /server              - Get server info`);
    console.log(`  POST   /access-keys         - Create access key`);
    console.log(`  GET    /access-keys         - List access keys`);
    console.log(`  GET    /access-keys/:id     - Get specific access key`);
    console.log(`  DELETE /access-keys/:id     - Delete access key`);
    const cfg = {
      apiUrl: `https://${config.SERVER_IP.serverIP}:${config.ADMIN.ADMIN_PORT}/${config.ADMIN.SECRET_ENDPOINT}`,
      certSha256: fingerprint,
    };
    console.log(JSON.stringify(cfg, null, 2));
  });
