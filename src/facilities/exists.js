import fs from "node:fs";
import fsp from "node:fs/promises";

export async function exists(path) {
  try {
    await fsp.access(path, fs.constants.F_OK | fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
