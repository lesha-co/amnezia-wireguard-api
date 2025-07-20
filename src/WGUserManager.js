#!/usr/bin/env node

import fs from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

// Configuration constants

import config from "../config.js";

export function getConfigName(iface) {
  return `${iface}.conf`;
}

export function restart() {
  // run
  // awg-quick down awg0
  // awg-quick up awg0
  execSync(`awg-quick down ${config.SERVER_INTERFACE_NAME}`, {
    stdio: "inherit",
  });
  execSync(`awg-quick up ${config.SERVER_INTERFACE_NAME}`, {
    stdio: "inherit",
  });
}

export function checkRootPrivileges() {
  if (process.getuid && process.getuid() !== 0) {
    console.error("Please run the script as root.");
    process.exit(1);
  }
}

function validateEnvironment() {
  // Check if running as root
  checkRootPrivileges();

  // Check if required files exist
  const requiredFiles = [
    getConfigName(config.SERVER_INTERFACE_NAME),
    config.SERVER_KEYS.PUBLIC_KEY_FILE,
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      console.error(`Error: Required file (${file}) not found.`);
      process.exit(1);
    }
  }
}

function validateUsername(username) {
  if (!username) {
    throw new Error("Username is required");
  }

  // Validate username format (alphanumeric and underscores only)
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error(
      "Username can only contain letters, numbers, and underscores",
    );
  }

  // Check if user already exists
  const serverConfig = fs.readFileSync(
    getConfigName(config.SERVER_INTERFACE_NAME),
    "utf8",
  );
  if (serverConfig.includes(`# Peer configuration for ${username}`)) {
    throw new Error(`User ${username} already exists`);
  }
}

export function generateWireguardKeys() {
  try {
    // Generate private key
    const privateKey = execSync("awg genkey", { encoding: "utf8" }).trim();

    // Generate public key from private key
    const publicKey = execSync(`echo "${privateKey}" | awg pubkey`, {
      encoding: "utf8",
    }).trim();

    // Generate preshared key
    const psk = execSync("awg genpsk", { encoding: "utf8" }).trim();

    return { privateKey, publicKey, psk };
  } catch (error) {
    throw new Error(`Error generating keys: ${error.message}`);
  }
}

function getNextClientIP() {
  const serverConfig = fs.readFileSync(
    getConfigName(config.SERVER_INTERFACE_NAME),
    "utf8",
  );
  const ipRegex = /AllowedIPs = 192\.168\.200\.(\d+)/g;
  const ips = [];
  let match;

  while ((match = ipRegex.exec(serverConfig)) !== null) {
    ips.push(parseInt(match[1]));
  }

  if (ips.length === 0) {
    return `${config.CLIENT_IP_BASE}2`;
  }

  const lastIp = Math.max(...ips);
  return `${config.CLIENT_IP_BASE}${lastIp + 1}`;
}

function addPeerToServerConfig(username, clientPublicKey, psk, clientIP) {
  console.log(
    `Adding new peer ${username} to server config with IP ${clientIP}...`,
  );

  const peerConfig = [
    ``,
    `# Peer configuration for ${username}`,
    `[Peer]`,
    `PublicKey = ${clientPublicKey}`,
    `PresharedKey = ${psk}`,
    `AllowedIPs = ${clientIP}/32`,
  ].join("\n");

  fs.appendFileSync(getConfigName(config.SERVER_INTERFACE_NAME), peerConfig);
}

function generateClientConfig(username, clientPrivateKey, psk, clientIP) {
  console.log(`Generating client config for ${username}...`);

  const serverPublicKey = fs
    .readFileSync(config.SERVER_KEYS.PUBLIC_KEY_FILE, "utf8")
    .trim();

  const clientConfig = [
    `[Interface]`,
    `PrivateKey = ${clientPrivateKey}`,
    `Address = ${clientIP}/32`,
    `DNS = ${config.SERVER_IP.dns}`,
    ``,
    `${config.VPN_PARAMS}`,
    ``,
    `[Peer]`,
    `PublicKey = ${serverPublicKey}`,
    `PresharedKey = ${psk}`,
    `Endpoint = ${config.SERVER_IP.serverIP}:${config.SERVER_IP.serverPort}`,
    `AllowedIPs = 0.0.0.0/0, ::/0`,
  ].join("\n");

  return clientConfig;
}

export function addUser(username) {
  console.log(`Adding user: ${username}`);

  // Validate environment
  validateEnvironment();

  // Validate username
  validateUsername(username);

  // Generate client keys
  console.log(`Generating keys for ${username}...`);
  const keys = generateWireguardKeys();
  console.log(`Keys generated for ${username}.`);

  // Get next available IP
  const clientIP = getNextClientIP();

  // Generate client configuration
  const clientConfig = generateClientConfig(
    username,
    keys.privateKey,
    keys.psk,
    clientIP,
  );
  const clientConfigFileName = `${username}.conf`;

  const userConfigLocation = path.join(
    config.USER_KEYS_ROOT,
    clientConfigFileName,
  );
  fs.mkdirSync(config.USER_KEYS_ROOT, { recursive: true });
  fs.writeFileSync(userConfigLocation, clientConfig);
  console.log(`Client config generated: ${userConfigLocation}`);

  // Add peer to server configuration
  addPeerToServerConfig(username, keys.publicKey, keys.psk, clientIP);

  // Return the configuration filename
  console.log(`Success! Configuration file created: ${clientConfigFileName}`);
  console.log(clientConfigFileName);
  restart();
  return {
    username,
    ip: clientIP,
    configFile: userConfigLocation,
    config: clientConfig,
    hasConfig: fs.existsSync(userConfigLocation),
  };
}

export function deleteUser(username) {
  validateEnvironment();

  const serverConfig = fs.readFileSync(
    getConfigName(config.SERVER_INTERFACE_NAME),
    "utf8",
  );
  if (!serverConfig.includes(`# Peer configuration for ${username}`)) {
    throw new Error(`User ${username} does not exist`);
  }

  // Remove user from server config
  const lines = serverConfig.split("\n");
  const filteredLines = [];
  let skipLines = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`# Peer configuration for ${username}`)) {
      skipLines = 6; // Skip the next 5 lines (comment + [Peer] + 3 config lines)
      continue;
    }

    if (skipLines > 0) {
      skipLines--;
      continue;
    }

    filteredLines.push(lines[i]);
  }

  fs.writeFileSync(
    getConfigName(config.SERVER_INTERFACE_NAME),
    filteredLines.join("\n"),
  );

  // Remove client config file
  const configFile = path.join(config.USER_KEYS_ROOT, `${username}.conf`);
  if (fs.existsSync(configFile)) {
    fs.unlinkSync(configFile);
  }

  console.log(`User ${username} deleted successfully`);
  restart();
  return true;
}

export function listUsers() {
  validateEnvironment();

  const serverConfig = fs.readFileSync(
    getConfigName(config.SERVER_INTERFACE_NAME),
    "utf8",
  );
  const userRegex = /# Peer configuration for (\w+)/g;
  const users = [];
  let match;
  while ((match = userRegex.exec(serverConfig)) !== null) {
    const username = match[1];
    const ipMatch = serverConfig.match(
      new RegExp(
        `# Peer configuration for ${username}[\\s\\S]*?AllowedIPs = ([^/]+)`,
      ),
    );
    const ip = ipMatch ? ipMatch[1] : "Unknown";
    const userConfigLocation = path.join(
      config.USER_KEYS_ROOT,
      `${username}.conf`,
    );
    const userConfig = fs.readFileSync(userConfigLocation, "utf8");
    users.push({
      username,
      ip,
      configFile: userConfigLocation,
      config: userConfig,
      hasConfig: fs.existsSync(userConfigLocation),
    });
  }

  return users;
}
