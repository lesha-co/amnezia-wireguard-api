import fs from "fs/promises";
import { generateWireguardKeys } from "./wireguardKeys.js";
import { getIP } from "./getIP.js";
import { randomString } from "./randomString.js";
import { randint } from "./randint.js";

async function createConfigObject(serverPort, adminPort) {
  const serverKeys = generateWireguardKeys();
  const headerBase = () => randint(0, 0x4000_0000); // max 32 bit integer / 4
  const config = {
    SERVER_IP: {
      serverIP: await getIP(),
      serverPort: serverPort,
      dns: "8.8.8.8, 8.8.4.4",
    },
    SERVER_KEYS: {
      PUBLIC_KEY: serverKeys.publicKey,
      PRIVATE_KEY: serverKeys.privateKey,
    },
    ADMIN: {
      HTTPS_KEY: "/data/cert.pem",
      ADMIN_PORT: adminPort,
      SECRET_ENDPOINT: randomString(),
    },
    VPN_PARAMS: [
      `Jc = ${randint(5, 15)}`,
      `Jmin = ${randint(25, 75)}`,
      `Jmax = ${randint(500, 1000)}`,
      `S1 = ${randint(50, 100)}`,
      `S2 = ${randint(125, 175)}`,
      // the headers will not collide
      `H1 = ${headerBase() + 0}`,
      `H2 = ${headerBase() + 1}`,
      `H3 = ${headerBase() + 2}`,
      `H4 = ${headerBase() + 3}`,
    ].join("\n"),
    SERVER_INTERFACE_CONFIG: "/data/awg0.conf",
    USER_KEYS_ROOT: "/data/user-keys",
    CLIENT_IP_BASE: "192.168.200.",
  };

  return config;
}

export async function makeConfig(
  serverPort = process.env.AWG_PORT,
  adminPort = process.env.PORT,
) {
  const path = "/data/config.json";

  const config = await createConfigObject(serverPort, adminPort);
  try {
    await fs.writeFile(path, JSON.stringify(config, null, 2));
    console.log(`Initialized config:`);
    console.log(
      `- vpn endpoint = ${config.SERVER_IP.serverIP}:${config.SERVER_IP.serverPort}`,
    );
    console.log(
      `- admin endpoint = ${config.SERVER_IP.serverIP}:${config.ADMIN.ADMIN_PORT}`,
    );
  } catch (error) {
    console.error("Error writing config to file:", error);
  }

  return config;
}
