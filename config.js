export default {
  SERVER_IP: {
    serverIP: "146.190.87.45", // only for client configs
    serverPort: 51820, // The port on which the awg server will run
    dns: "8.8.8.8, 8.8.4.4", // only for client configs
  },
  SERVER_KEYS: {
    PUBLIC_KEY_FILE: "server-keys/public.key",
    PRIVATE_KEY_FILE: "server-keys/private.key",
  },
  ADMIN: {
    HTTPS_KEY: "server-keys/ssl.pem",
    ADMIN_PORT: 3443,
    SECRET_ENDPOINT:
      "7FAA619209E1A628578A0A96E313A25D61AF989ACFA2C7D6774C1E61C5077AF0",
  },
  VPN_PARAMS: [
    "Jc = 7",
    "Jmin = 50",
    "Jmax = 1000",
    "S1 = 68",
    "S2 = 149",
    "H1 = 1106457265",
    "H2 = 249455488",
    "H3 = 1209847463",
    "H4 = 1646644382",
  ].join("\n"),
  SERVER_INTERFACE_NAME: "awg0",
  USER_KEYS_ROOT: "user-keys",
  CLIENT_IP_BASE: "192.168.200.",
};
