// server/events.ts — Server-Sent Events endpoint.

import { store, type SnapshotPayload } from "./store"

const encoder = new TextEncoder()

export function handleEvents(req: Request, cors: Record<string, string>): Response {
  let unsub: (() => void) | null = null
  let pingTimer: ReturnType<typeof setInterval> | null = null
  const cleanup = () => {
    unsub?.()
    unsub = null
    if (pingTimer !== null) {
      clearInterval(pingTimer)
      pingTimer = null
    }
  }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (s: string) => {
        try {
          controller.enqueue(encoder.encode(s))
        } catch {
          // stream closed
        }
      }
      send(`event: snapshot\ndata: ${JSON.stringify(store.currentSnapshot())}\n\n`)
      unsub = store.subscribe((s: SnapshotPayload) => {
        send(`event: snapshot\ndata: ${JSON.stringify(s)}\n\n`)
      })
      pingTimer = setInterval(() => send("event: ping\ndata: {}\n\n"), 15000)
      if (req.signal) req.signal.addEventListener("abort", cleanup)
    },
    cancel() {
      cleanup()
    },
  })
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...cors,
    },
  })
}