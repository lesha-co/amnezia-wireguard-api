import path from "node:path";
import { execSync } from "node:child_process";
import config from "../../config.js";
import fs from "node:fs";

// SSL Certificate check and creation
export default function ensureSSLCertificate() {
  const pemPath = config.ADMIN.HTTPS_KEY;
  const keyDir = path.dirname(pemPath);

  // Create directory if it doesn't exist
  if (!fs.existsSync(keyDir)) {
    fs.mkdirSync(keyDir, { recursive: true });
  }

  // Check if SSL pem file exists
  if (!fs.existsSync(pemPath)) {
    console.log(
      "SSL certificate not found, creating self-signed certificate...",
    );

    try {
      // Generate self-signed certificate and key in a single .pem file
      const tempKey = path.join(keyDir, "temp.key");
      const tempCert = path.join(keyDir, "temp.crt");

      // Create key and certificate
      const opensslCmd = `openssl req -x509 -newkey rsa:4096 -keyout ${tempKey} -out ${tempCert} -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=localhost"`;
      execSync(opensslCmd, { stdio: "inherit" });

      // Combine key and certificate into single .pem file
      const keyContent = fs.readFileSync(tempKey, "utf8");
      const certContent = fs.readFileSync(tempCert, "utf8");
      fs.writeFileSync(pemPath, keyContent + certContent);

      // Clean up temporary files
      fs.unlinkSync(tempKey);
      fs.unlinkSync(tempCert);

      console.log("Self-signed SSL certificate created successfully");
    } catch (error) {
      console.error("Failed to create SSL certificate:", error.message);
      console.log("Continuing without SSL...");
    }
  } else {
    console.log("SSL certificate found");
  }

  if (!fs.existsSync(pemPath)) {
    throw new Error("SSL certificate not found");
  }
  // Print SSL certificate fingerprint if certificate exists

  const fingerprintCmd = `openssl x509 -noout -fingerprint -sha256 -in <(openssl x509 -in ${pemPath})`;
  const fingerprint = execSync(`bash -c "${fingerprintCmd}"`, {
    encoding: "utf8",
  })
    .trim()
    .split("=")[1]
    .replaceAll(":", "");

  console.log(`Fingerprint: `, fingerprint);
  return fingerprint;
}
