import { mediaApp } from "./app.js";
const app = mediaApp("/tmp/aside-media");
await app.listen({ host: "0.0.0.0", port: 8080 });
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => void app.close());
