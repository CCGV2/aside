import { HttpError } from "./http.js";
const name = "aside_session";
const lifetime = 7 * 86400;
async function key(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
export async function session(request: Request, secret: string) {
  if (!secret || secret.length < 32)
    throw new HttpError(503, "服务端会话密钥尚未配置");
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + "="))
    ?.slice(name.length + 1);
  const parts = token?.split(".");
  const now = Math.floor(Date.now() / 1000);
  if (parts?.length === 3) {
    const [id, expiry, signature] = parts;
    if (
      /^[a-f0-9-]{36}$/.test(id) &&
      /^\d+$/.test(expiry) &&
      Number(expiry) > now &&
      Number(expiry) <= now + lifetime &&
      /^[a-f0-9]{64}$/.test(signature)
    ) {
      const bytes = Uint8Array.from(signature.match(/../g)!, (x) =>
        parseInt(x, 16),
      );
      if (
        await crypto.subtle.verify(
          "HMAC",
          await key(secret),
          bytes,
          new TextEncoder().encode(id + "." + expiry),
        )
      )
        return { id };
    }
  }
  const id = crypto.randomUUID(),
    payload = id + "." + (now + lifetime);
  const signature = hex(
    await crypto.subtle.sign(
      "HMAC",
      await key(secret),
      new TextEncoder().encode(payload),
    ),
  );
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return {
    id,
    cookie: `${name}=${payload}.${signature}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${lifetime}${secure}`,
  };
}
