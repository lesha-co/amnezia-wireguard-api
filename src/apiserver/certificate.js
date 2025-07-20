import path from "node:path";
import { execSync } from "node:child_process";

import fs from "node:fs/promises";

export async function createSSLCertificate(pemPath) {
  console.log("Creating a self-signed SSL certificate");
  const keyDir = path.dirname(pemPath);

  // Generate self-signed certificate and key in a single .pem file
  const tempKey = path.join(keyDir, "temp.key");
  const tempCert = path.join(keyDir, "temp.crt");

  // Create key and certificate
  const opensslCmd = `openssl req -x509 -newkey rsa:4096 -keyout ${tempKey} -out ${tempCert} -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=localhost"`;
  execSync(opensslCmd, { stdio: "inherit" });

  // Combine key and certificate into single .pem file
  const keyContent = await fs.readFile(tempKey, "utf8");
  const certContent = await fs.readFile(tempCert, "utf8");
  await fs.writeFile(pemPath, keyContent + certContent);

  // Clean up temporary files
  await fs.unlink(tempKey);
  await fs.unlink(tempCert);

  console.log("Certificate created successfully");
}

// SSL Certificate check and creation
export default function ensureSSLCertificate(config) {
  const fingerprintCmd = `openssl x509 -noout -fingerprint -sha256 -in <(openssl x509 -in ${config.ADMIN.HTTPS_KEY})`;

  const fingerprint = execSync(`bash -c "${fingerprintCmd}"`, {
    encoding: "utf8",
  })
    .trim()
    .split("=")[1]
    .replaceAll(":", "");

  console.log(`Fingerprint: `, fingerprint);
  return fingerprint;
}
