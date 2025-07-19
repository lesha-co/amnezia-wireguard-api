#!/usr/bin/env node

import fs from "node:fs";
import { execSync } from "node:child_process";

// Configuration constants
const VPN_PARAMS_FILE = "./vpn_params.cfg";
const SERVER_CONF_FILE = "awg0.conf";
const CLIENT_IP_BASE = "192.168.200.";
const SERVER_PUBLIC_KEY_FILE = "server_public_metaligh.key";
const SERVER_IP_FILE = "serverip.cfg";

function validateEnvironment() {
  // Check if running as root
  if (process.getuid && process.getuid() !== 0) {
    console.error("Please run the script as root.");
    process.exit(1);
  }

  // Check if required files exist
  const requiredFiles = [
    VPN_PARAMS_FILE,
    SERVER_CONF_FILE,
    SERVER_PUBLIC_KEY_FILE,
    SERVER_IP_FILE,
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
  const serverConfig = fs.readFileSync(SERVER_CONF_FILE, "utf8");
  if (serverConfig.includes(`# Peer configuration for ${username}`)) {
    throw new Error(`User ${username} already exists`);
  }
}

function generateClientKeys(username) {
  console.log(`Generating keys for ${username}...`);

  try {
    // Generate private key
    const privateKey = execSync("awg genkey", { encoding: "utf8" }).trim();

    // Generate public key from private key
    const publicKey = execSync(`echo "${privateKey}" | awg pubkey`, {
      encoding: "utf8",
    }).trim();

    // Generate preshared key
    const psk = execSync("awg genpsk", { encoding: "utf8" }).trim();

    console.log(`Keys generated for ${username}.`);
    return { privateKey, publicKey, psk };
  } catch (error) {
    throw new Error(`Error generating keys: ${error.message}`);
  }
}

function getNextClientIP() {
  const serverConfig = fs.readFileSync(SERVER_CONF_FILE, "utf8");
  const ipRegex = /AllowedIPs = 192\.168\.200\.(\d+)/g;
  const ips = [];
  let match;

  while ((match = ipRegex.exec(serverConfig)) !== null) {
    ips.push(parseInt(match[1]));
  }

  if (ips.length === 0) {
    return `${CLIENT_IP_BASE}2`;
  }

  const lastIp = Math.max(...ips);
  return `${CLIENT_IP_BASE}${lastIp + 1}`;
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

  fs.appendFileSync(SERVER_CONF_FILE, peerConfig);
}

function generateClientConfig(username, clientPrivateKey, psk, clientIP) {
  console.log(`Generating client config for ${username}...`);

  const serverPublicKey = fs
    .readFileSync(SERVER_PUBLIC_KEY_FILE, "utf8")
    .trim();
  const serverIpLines = fs.readFileSync(SERVER_IP_FILE, "utf8").split("\n");
  const serverIP = serverIpLines[0].trim();
  const dns = serverIpLines[1].trim();
  const serverPort = serverIpLines[2].trim();
  const vpnParams = fs.readFileSync(VPN_PARAMS_FILE, "utf8").trim();

  const clientConfigFile = `${username}.conf`;

  const clientConfig = [
    `[Interface]`,
    `PrivateKey = ${clientPrivateKey}`,
    `Address = ${clientIP}/32`,
    `DNS = ${dns}`,
    ``,
    `${vpnParams}`,
    ``,
    `[Peer]`,
    `PublicKey = ${serverPublicKey}`,
    `PresharedKey = ${psk}`,
    `Endpoint = ${serverIP}:${serverPort}`,
    `AllowedIPs = 0.0.0.0/0, ::/0`,
  ].join("\n");

  fs.writeFileSync(clientConfigFile, clientConfig);
  console.log(`Client config generated: ${clientConfigFile}`);
  return clientConfigFile;
}

export function addUser(username) {
  console.log(`Adding user: ${username}`);

  // Validate environment
  validateEnvironment();

  // Validate username
  validateUsername(username);

  // Generate client keys
  const { privateKey, publicKey, psk } = generateClientKeys(username);

  // Get next available IP
  const clientIP = getNextClientIP();

  // Generate client configuration
  const configFile = generateClientConfig(username, privateKey, psk, clientIP);

  // Add peer to server configuration
  addPeerToServerConfig(username, publicKey, psk, clientIP);

  // Return the configuration filename
  console.log(`Success! Configuration file created: ${configFile}`);
  console.log(configFile);
  return configFile;
}

export function deleteUser(username) {
  validateEnvironment();

  const serverConfig = fs.readFileSync(SERVER_CONF_FILE, "utf8");
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

  fs.writeFileSync(SERVER_CONF_FILE, filteredLines.join("\n"));

  // Remove client config file
  const configFile = `${username}.conf`;
  if (fs.existsSync(configFile)) {
    fs.unlinkSync(configFile);
  }

  console.log(`User ${username} deleted successfully`);
  return true;
}

export function listUsers() {
  validateEnvironment();

  const serverConfig = fs.readFileSync(SERVER_CONF_FILE, "utf8");
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

    users.push({
      username,
      ip,
      configFile: `${username}.conf`,
      hasConfig: fs.existsSync(`${username}.conf`),
    });
  }

  return users;
}

// Main execution check for ES modules
if (import.meta.url === `file://${process.argv[1]}`) {
  const username = process.argv[2];
  if (!username) {
    console.error("Usage: node WGUserManager.js <username>");
    console.error("Example: node WGUserManager.js john");
    process.exit(1);
  }
  addUser(username);
}
