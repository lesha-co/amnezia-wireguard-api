#!/usr/bin/env node

import express from "express";
import { addUser, deleteUser, listUsers } from "./WGUserManager.js";
import fs from "fs";

const app = express();
const PORT = files.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test WireGuard functions availability
try {
  // Just test that the functions are available
  if (typeof addUser !== "function") {
    throw new Error("WireGuard functions not available");
  }
} catch (error) {
  console.error("Failed to load WireGuard functions:", error.message);
  process.exit(1);
}

// API Routes

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "WireGuard API server is running" });
});

// Get all users
app.get("/users", (req, res) => {
  try {
    const users = listUsers();
    res.json({
      success: true,
      users,
      count: users.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to get users",
      message: error.message,
    });
  }
});

// Add new user
app.post("/users", (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({
      success: false,
      error: "Username is required",
      message: "Please provide a username in the request body",
    });
  }

  try {
    const configFile = addUser(username);
    res.status(201).json({
      success: true,
      message: `User ${username} created successfully`,
      username,
      configFile,
      downloadUrl: `/users/${username}/config`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: "Failed to create user",
      message: error.message,
    });
  }
});

// Get user configuration file
app.get("/users/:username/config", (req, res) => {
  const { username } = req.params;
  const configFile = `${username}.conf`;

  if (!fs.existsSync(configFile)) {
    return res.status(404).json({
      success: false,
      error: "Configuration not found",
      message: `Configuration file for user ${username} does not exist`,
    });
  }

  try {
    const configContent = fs.readFileSync(configFile, "utf8");

    // Set headers for file download
    res.setHeader("Content-Type", "text/plain");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${configFile}"`,
    );
    res.send(configContent);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to read configuration",
      message: error.message,
    });
  }
});

// Get user configuration as JSON
app.get("/users/:username/config/json", (req, res) => {
  const { username } = req.params;
  const configFile = `${username}.conf`;

  if (!fs.existsSync(configFile)) {
    return res.status(404).json({
      success: false,
      error: "Configuration not found",
      message: `Configuration file for user ${username} does not exist`,
    });
  }

  try {
    const configContent = fs.readFileSync(configFile, "utf8");
    res.json({
      success: true,
      username,
      configFile,
      content: configContent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to read configuration",
      message: error.message,
    });
  }
});

// Delete user
app.delete("/users/:username", (req, res) => {
  const { username } = req.params;

  try {
    deleteUser(username);
    res.json({
      success: true,
      message: `User ${username} deleted successfully`,
      username,
    });
  } catch (error) {
    if (error.message.includes("does not exist")) {
      res.status(404).json({
        success: false,
        error: "User not found",
        message: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to delete user",
        message: error.message,
      });
    }
  }
});

// Get server configuration
app.get("/server/config", (req, res) => {
  try {
    const serverConfig = fs.readFileSync("awg0.conf", "utf8");
    res.json({
      success: true,
      content: serverConfig,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to read server configuration",
      message: error.message,
    });
  }
});

// Get server status
app.get("/server/status", (req, res) => {
  try {
    const serverConfig = fs.readFileSync("awg0.conf", "utf8");
    const userCount = (serverConfig.match(/# Peer configuration for/g) || [])
      .length;

    res.json({
      success: true,
      status: "running",
      userCount,
      configFile: "awg0.conf",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to get server status",
      message: error.message,
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Server error:", error);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: error.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Not found",
    message: "The requested endpoint does not exist",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`WireGuard API server running on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  GET    /health              - Health check`);
  console.log(`  GET    /users               - List all users`);
  console.log(`  POST   /users               - Add new user`);
  console.log(`  GET    /users/:username/config - Download user config`);
  console.log(
    `  GET    /users/:username/config/json - Get user config as JSON`,
  );
  console.log(`  DELETE /users/:username     - Delete user`);
  console.log(`  GET    /server/config       - Get server configuration`);
  console.log(`  GET    /server/status       - Get server status`);
});

export default app;
