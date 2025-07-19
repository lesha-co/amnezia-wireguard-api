#!/usr/bin/env node
import fs from "node:fs";

import {
  addUser,
  checkRootPrivileges,
  generateWireguardKeys,
} from "./WGUserManager.js";

import * as config from "./config.js";

function isAlreadyInitialized() {
  return (
    fs.existsSync(config.SERVER_CONF_FILE) &&
    fs.existsSync(config.SERVER_KEYS.PUBLIC_KEY_FILE) &&
    fs.existsSync(config.SERVER_KEYS.PRIVATE_KEY_FILE)
  );
}

function generateServerKeys() {
  console.log("Generating server keys...");

  try {
    const serverKeys = generateWireguardKeys();

    // Save server keys to files
    fs.writeFileSync(
      config.SERVER_KEYS.PRIVATE_KEY_FILE,
      serverKeys.privateKey,
    );
    fs.writeFileSync(config.SERVER_KEYS.PUBLIC_KEY_FILE, serverKeys.publicKey);

    console.log("Server keys generated successfully.");
    return serverKeys;
  } catch (error) {
    throw new Error(`Error generating server keys: ${error.message}`);
  }
}

function createInitialServerConfig(serverPrivateKey) {
  console.log("Creating initial server configuration...");

  console.log(`Server port: ${config.SERVER_IP.serverPort}`);

  const serverConfig = [
    `[Interface]`,
    `PrivateKey = ${serverPrivateKey}`,
    `Address = ${config.CLIENT_IP_BASE}1/32`,
    `ListenPort = ${config.SERVER_IP.serverPort}`,
    ``,
    `${config.VPN_PARAMS}`,
    ``,
  ].join("\n");

  fs.writeFileSync(files.SERVER_CONF_FILE, serverConfig);
  console.log("Initial server configuration created.");
}

export function initializeServer() {
  console.log("Initializing VPN server...");

  // Check prerequisites
  checkRootPrivileges();

  // Check if already initialized
  if (isAlreadyInitialized()) {
    console.log("Server appears to be already initialized.");
    console.log("Found existing configuration files:");
    if (fs.existsSync(files.SERVER_CONF_FILE))
      console.log(`- ${files.SERVER_CONF_FILE}`);
    if (fs.existsSync(files.SERVER_PUBLIC_KEY_FILE))
      console.log(`- ${files.SERVER_PUBLIC_KEY_FILE}`);
    if (fs.existsSync(files.SERVER_PRIVATE_KEY_FILE))
      console.log(`- ${files.SERVER_PRIVATE_KEY_FILE}`);
    console.log(
      "Use WGUserManager.js to manage users or delete existing files to re-initialize.",
    );
    return false;
  }

  try {
    // Generate server keys
    const serverKeys = generateServerKeys();

    // Create initial server configuration
    createInitialServerConfig(serverKeys.privateKey);

    // Add the default 'metaligh' user
    console.log("Adding default user 'metaligh'...");
    const configFile = addUser("metaligh");

    console.log("=".repeat(50));
    console.log("VPN Server initialization completed successfully!");
    console.log("=".repeat(50));
    console.log("Generated files:");
    console.log(`- ${profiles.SERVER_CONF_FILE} (server configuration)`);
    console.log(`- ${profiles.SERVER_PUBLIC_KEY_FILE} (server public key)`);
    console.log(`- ${files.SERVER_PRIVATE_KEY_FILE} (server private key)`);
    console.log(`- ${configFile} (default user configuration)`);
    console.log("");
    console.log("Next steps:");
    console.log("1. Copy the server configuration to your WireGuard server");
    console.log("2. Start the WireGuard service with the new configuration");
    console.log("3. Use WGUserManager.js to add/remove users as needed");

    return true;
  } catch (error) {
    console.error(`Initialization failed: ${error.message}`);
    process.exit(1);
  }
}

// Main execution check for ES modules
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeServer();
}
