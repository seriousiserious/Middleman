self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.protocol === 'wss:' || url.protocol === 'ws:') {
    event.respondWith(proxyWebSocket(event.request));
  }
});

async function proxyWebSocket(request) {
  const response = await fetch(request, { mode: 'no-cors' });

  const { readable, writable } = new TransformStream();
  const ws = new WebSocket(request.url);

  ws.addEventListener('open', () => {
    const reader = readable.getReader();
    const writer = writable.getWriter();

    reader.read().then(async function process({ done, value }) {
      if (done) {
        ws.close();
        writer.close();
      } else {
        ws.send(value);
        reader.read().then(process);
      }
    });
  });

  ws.addEventListener('message', event => {
    const { data } = event;
    writable.write(data);
  });

  ws.addEventListener('close', () => {
    writable.close();
  });

  return new Response(readable, { status: 101, statusText: 'Switching Protocols' });
}
