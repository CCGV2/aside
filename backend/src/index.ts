import { resolve } from "node:path";
import { Store } from "./store.js";
import { Provider } from "./provider.js";
import { createApp } from "./app.js";
const store = new Store(
  process.env.ASIDE_DATA_DIR || resolve(import.meta.dirname, "../../.data"),
);
const app = createApp(
  store,
  process.env.OPENAI_API_KEY
    ? new Provider(process.env.OPENAI_API_KEY)
    : undefined,
);
await app.listen({ host: "127.0.0.1", port: Number(process.env.PORT) || 4310 });
console.log("Aside API listening on http://127.0.0.1:4310");
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void app.close().then(() => {
      store.close();
      process.exit(0);
    });
  });
