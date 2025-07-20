import { execSync } from "node:child_process";

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
