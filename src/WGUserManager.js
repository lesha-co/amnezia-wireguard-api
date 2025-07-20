import fs from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

import { generateWireguardKeys } from "./facilities/wireguardKeys.js";
import { checkRootPrivileges } from "./facilities/checkRootPrivileges.js";

export function restart(config) {
  // run
  // awg-quick down awg0
  // awg-quick up awg0
  const interfaceName = path
    .basename(config.SERVER_INTERFACE_CONFIG)
    .split(".")[0];
  try {
    execSync(`awg-quick down ${interfaceName}`, {
      stdio: "inherit",
    });
  } catch (x) {}

  execSync(`awg-quick up ${interfaceName}`, {
    stdio: "inherit",
  });
}

function validateEnvironment(config) {
  // Check if running as root
  checkRootPrivileges();

  // Check if required files exist
  const requiredFiles = [config.SERVER_INTERFACE_CONFIG];

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
  const serverConfig = fs.readFileSync(config.SERVER_INTERFACE_CONFIG, "utf8");
  if (serverConfig.includes(`# Peer configuration for ${username}`)) {
    throw new Error(`User ${username} already exists`);
  }
}

function getNextClientIP(config) {
  const serverConfig = fs.readFileSync(config.SERVER_INTERFACE_CONFIG, "utf8");
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

function addPeerToServerConfig(
  config,
  username,
  clientPublicKey,
  psk,
  clientIP,
) {
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

  fs.appendFileSync(config.SERVER_INTERFACE_CONFIG, peerConfig);
}

function generateClientConfig(
  config,
  username,
  clientPrivateKey,
  psk,
  clientIP,
) {
  console.log(`Generating client config for ${username}...`);

  const clientConfig = [
    `[Interface]`,
    `PrivateKey = ${clientPrivateKey}`,
    `Address = ${clientIP}/32`,
    `DNS = ${config.SERVER_IP.dns}`,
    ``,
    `${config.VPN_PARAMS}`,
    ``,
    `[Peer]`,
    `PublicKey = ${config.SERVER_KEYS.PUBLIC_KEY}`,
    `PresharedKey = ${psk}`,
    `Endpoint = ${config.SERVER_IP.serverIP}:${config.SERVER_IP.serverPort}`,
    `AllowedIPs = 0.0.0.0/0, ::/0`,
  ].join("\n");

  return clientConfig;
}

export function addUser(config, username) {
  console.log(`Adding user: ${username}`);

  // Validate environment
  validateEnvironment(config);

  // Validate username
  validateUsername(username);

  // Generate client keys
  console.log(`Generating keys for ${username}...`);
  const keys = generateWireguardKeys();
  console.log(`Keys generated for ${username}.`);

  // Get next available IP
  const clientIP = getNextClientIP(config);

  // Generate client configuration
  const clientConfig = generateClientConfig(
    config,
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
  addPeerToServerConfig(config, username, keys.publicKey, keys.psk, clientIP);

  // Return the configuration filename
  console.log(`Success! Configuration file created: ${clientConfigFileName}`);
  console.log(clientConfigFileName);
  restart(config);
  return {
    username,
    ip: clientIP,
    configFile: userConfigLocation,
    config: clientConfig,
    hasConfig: fs.existsSync(userConfigLocation),
  };
}

export function deleteUser(config, username) {
  validateEnvironment(config);

  const serverConfig = fs.readFileSync(config.SERVER_INTERFACE_CONFIG, "utf8");
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

  fs.writeFileSync(config.SERVER_INTERFACE_CONFIG, filteredLines.join("\n"));

  // Remove client config file
  const configFile = path.join(config.USER_KEYS_ROOT, `${username}.conf`);
  if (fs.existsSync(configFile)) {
    fs.unlinkSync(configFile);
  }

  console.log(`User ${username} deleted successfully`);
  restart(config);
  return true;
}

export function listUsers(config) {
  validateEnvironment(config);

  const serverConfig = fs.readFileSync(config.SERVER_INTERFACE_CONFIG, "utf8");
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
