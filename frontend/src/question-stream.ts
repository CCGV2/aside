/** Consume progressive question events, retaining JSON compatibility for older servers. */
export async function readQuestion<T>(
  response: Response,
  progress: (phase: string) => void,
): Promise<T> {
  if (!response.ok)
    throw Error((await response.json()).error ?? response.statusText);
  if (!response.headers.get("content-type")?.includes("application/x-ndjson"))
    return response.json();
  if (!response.body) throw Error("回答连接已关闭");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      if (done && buffer.trim()) lines.push(buffer);
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "progress") progress(event.phase);
        if (event.type === "error") throw Error(event.error);
        if (event.type === "result") return event.result as T;
      }
      if (done) throw Error("回答连接中断，请重试");
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
