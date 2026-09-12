import { resolve } from "node:path";
import { Store } from "./store.js";
import { OpenAIProvider } from "./provider.js";
import { QuestionService } from "./question-service.js";
import { createApp } from "./app.js";
const store = new Store(
  process.env.ASIDE_DATA_DIR || resolve(import.meta.dirname, "../../.data"),
);
const models = process.env.OPENAI_API_KEY
  ? new OpenAIProvider(process.env.OPENAI_API_KEY)
  : undefined;
const app = createApp(
  store,
  models
    ? {
        analysis: models,
        voice: models,
        questions: new QuestionService(models),
      }
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
