import { addUser, deleteUser, listUsers } from "../WGUserManager.js";
import express from "express";
import crypto from "node:crypto";

const router = express.Router();

// Middleware

// API Routes

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({ status: "ok", message: "WireGuard API server is running" });
});

// Server configuration endpoints
router.get("/server", (req, res) => {
  // Return server information according to the API specification
  const serverInfo = {
    name: "WireGuard VPN Server",
    serverId: "wireguard-server-001",
    metricsEnabled: false,
    createdTimestampMs: Date.now(),
    portForNewAccessKeys: 12345,
  };

  res.json(serverInfo);
});

// Access keys management endpoints
router.post("/access-keys", (req, res) => {
  try {
    const name =
      req.body.name ?? Math.round(Math.random() * 1000000000).toString(36);
    console.log(JSON.stringify(req.body));
    console.log("Creating a key for", name);

    // Validate required fields
    if (!name || typeof name !== "string") {
      console.log("error!");
      return res.status(400).json({
        code: "INVALID_REQUEST",
        message: "Name is required",
      });
    }

    console.log("Name is valid");

    // Add user using WGUserManager
    const result = addUser(name);

    console.log("created", result.ip);

    // Return access key information according to API spec
    const accessKey = {
      id: result.username,
      name: result.username,
      password: "",
      port: 12345,
      method: "chacha20-ietf-poly1305",
      accessUrl: result.config,
    };

    res.status(201).json(accessKey);
  } catch (error) {
    console.error("Error creating access key:", error);
    res.status(500).json({
      code: "SERVER_ERROR",
      message: "Internal server error",
    });
  }
});

router.get("/access-keys", (req, res) => {
  try {
    // Get all users using WGUserManager
    const result = listUsers();

    // Convert users to access keys format according to API spec
    const accessKeys = result.map((user) => ({
      id: user.username,
      name: user.username,
      password: "",
      port: 12345,
      method: "chacha20-ietf-poly1305",
      accessUrl: user.config,
    }));

    res.json({ accessKeys });
  } catch (error) {
    console.error("Error retrieving access keys:", error);
    res.status(500).json({
      code: "SERVER_ERROR",
      message: "Internal server error",
    });
  }
});

router.get("/access-keys/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Get all users to find the specific one
    const result = listUsers();

    // Find the specific user by ID
    const user = result.find((u) => u.username === id);

    if (!user) {
      return res.status(404).json({
        code: "ACCESS_KEY_NOT_FOUND",
        message: "Access key not found",
      });
    }

    // Convert user to access key format
    const accessKey = {
      id: user.username,
      name: user.username,
      password: "",
      port: 12345,
      method: "chacha20-ietf-poly1305",
      accessUrl: user.config,
    };

    res.json(accessKey);
  } catch (error) {
    console.error("Error retrieving access key:", error);
    res.status(500).json({
      code: "SERVER_ERROR",
      message: "Internal server error",
    });
  }
});

router.delete("/access-keys/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Delete user using WGUserManager
    const result = deleteUser(id);

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting access key:", error);
    res.status(500).json({
      code: "SERVER_ERROR",
      message: "Internal server error",
    });
  }
});

router.get("/metrics/transfer", (req, res) => {
  res.json({
    upload: 12345,
    download: 54321,
  });
});

export default router;
