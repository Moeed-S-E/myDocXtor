/**
 * Decode a base64 data: URL to bytes WITHOUT fetch(). The strict CSP
 * (connect-src 'self') refuses `fetch("data:...")`, so we decode in-process
 * with atob. Everything stays in memory on-device.
 */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) throw new Error("Invalid data URL");
  const meta = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  if (!meta.includes(";base64")) {
    // URL-encoded (rare for our use); decode as UTF-8 text.
    const text = decodeURIComponent(payload);
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
    return out;
  }
  const binary = atob(payload);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
