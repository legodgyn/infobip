import { addRealtimeClient, removeRealtimeClient } from "@/lib/realtime";

export const dynamic = "force-dynamic";

export async function GET() {
  let streamController: ReadableStreamDefaultController | null = null;

  const stream = new ReadableStream({
    start(controller) {
      streamController = controller;
      addRealtimeClient(controller);

      controller.enqueue(
        `data: ${JSON.stringify({ type: "connected" })}\n\n`
      );
    },

    cancel() {
      if (streamController) {
        removeRealtimeClient(streamController);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
