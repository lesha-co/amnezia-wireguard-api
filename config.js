export const SERVER_IP = {
  serverIP: "127.0.0.1",
  serverPort: 51820,
  dns: "8.8.8.8, 8.8.4.4",
};
export const SERVER_KEYS = {
  PUBLIC_KEY_FILE: "server-keys/public.key",
  PRIVATE_KEY_FILE: "server-keys/private.key",
};
export const VPN_PARAMS = [
  "Jc = 7",
  "Jmin = 50",
  "Jmax = 1000",
  "S1 = 68",
  "S2 = 149",
  "H1 = 1106457265",
  "H2 = 249455488",
  "H3 = 1209847463",
  "H4 = 1646644382",
].join("\n");

export const SERVER_CONF_FILE = "awg0.conf";
export const USER_KEYS_ROOT = "user-keys";

export const CLIENT_IP_BASE = "192.168.200.";
