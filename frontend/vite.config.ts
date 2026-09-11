import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [
    {
      name: "local-vad-runtime",
      configureServer(server) {
        // ONNX imports this runtime dynamically. Serve it verbatim even with Vite's ?import suffix.
        server.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== "/vad/ort-wasm-simd-threaded.mjs")
            return next();
          res.setHeader("Content-Type", "text/javascript");
          createReadStream(
            fileURLToPath(
              new URL(
                "./public/vad/ort-wasm-simd-threaded.mjs",
                import.meta.url,
              ),
            ),
          )
            .on("error", next)
            .pipe(res);
        });
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:4310" },
  },
  build: { sourcemap: true },
});
