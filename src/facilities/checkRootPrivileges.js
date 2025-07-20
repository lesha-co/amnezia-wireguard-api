export function checkRootPrivileges() {
  console.log("Checking if running as root...");
  if (process.getuid && process.getuid() !== 0) {
    console.error("Please run the script as root.");
    process.exit(1);
  }
}
