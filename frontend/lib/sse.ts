// Server-side SSE helpers. Event JSON shape matches the client parser in
// lib/agent-api.ts ({tool|text|complete|error} plus harness step events).

export function sseLine(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

/** Wrap an async generator of JSON-serialisable events as an SSE Response. */
export function sseResponse(events: AsyncIterable<unknown>): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of events) {
          controller.enqueue(encoder.encode(sseLine(event)));
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(sseLine({ error: err instanceof Error ? err.message : String(err) })),
        );
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}
