const clients = new Set<ReadableStreamDefaultController>();

export function addRealtimeClient(controller: ReadableStreamDefaultController) {
  clients.add(controller);
}

export function removeRealtimeClient(controller: ReadableStreamDefaultController) {
  clients.delete(controller);
}

export function notifyRealtime() {
  for (const controller of clients) {
    controller.enqueue(`data: ${JSON.stringify({ type: "update" })}\n\n`);
  }
}
