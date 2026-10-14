const loopback = new Set(['localhost','127.0.0.1','[::1]']);
export function sameLocalOrigin(origin, destination) {
  if (!origin) return true;
  try {
    const source=new URL(origin),target=new URL(destination);
    return loopback.has(source.hostname)&&loopback.has(target.hostname)&&source.protocol===target.protocol&&source.port===target.port&&!source.username&&!source.password;
  } catch { return false; }
}
