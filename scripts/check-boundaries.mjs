import { readdir, readFile } from "node:fs/promises";
async function files(dir) {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map((e) =>
        e.isDirectory() ? files(`${dir}/${e.name}`) : `${dir}/${e.name}`,
      ),
    )
  ).flat();
}
const errors = [];
for (const path of await files("engine/src")) {
  const s = await readFile(path, "utf8");
  if (/from\s+['"](?:node:|react|fastify|openai|.*backend|.*frontend)/.test(s))
    errors.push(path);
}
for (const path of await files("frontend/src")) {
  const s = await readFile(path, "utf8");
  if (
    /from\s+['"](?:node:|openai|@aside\/engine\/server|.*backend\/src)/.test(s)
  )
    errors.push(path);
}
if (errors.length)
  throw Error(`Forbidden module dependency: ${errors.join(", ")}`);
console.log("Module boundaries passed");
