import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync, backup } from "node:sqlite";
import { Store } from "../backend/src/store.js";
import { migrateStorage } from "../backend/src/migrate-storage.js";
const root = resolve(process.env.ASIDE_DATA_DIR || ".data");
const previous = new DatabaseSync(join(root, "aside.sqlite"), {
  readOnly: true,
});
const snapshot = join(root, `aside-before-storage-${randomUUID()}.sqlite`);
try {
  await backup(previous, snapshot);
} finally {
  previous.close();
}
const store = new Store(root);
try {
  console.log(
    JSON.stringify({
      backup: snapshot,
      ...(await migrateStorage(store, root)),
    }),
  );
} finally {
  store.close();
}
