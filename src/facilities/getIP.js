export async function getIP() {
  const res = await fetch("https://ipinfo.io/ip");
  const ip = (await res.text()).trim();
  return ip;
}
