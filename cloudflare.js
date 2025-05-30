// Telegram Bot API base URL
const TELEGRAM_API_BASE = 'https://api.telegram.org';

// HTML template for root path (docs)
const DOC_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Telegram Bot API Proxy</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: sans-serif; padding: 2rem; max-width: 800px; margin: auto; }
    .code { background: #f4f4f4; padding: 1rem; border-radius: 5px; font-family: monospace; overflow-x: auto; }
    .note { background: #fff3cd; padding: 1rem; border-left: 5px solid #ffc107; margin: 1rem 0; }
    .example { background: #e7f5ff; padding: 1rem; border-left: 5px solid #00aaff; margin: 1rem 0; }
  </style>
</head>
<body>
  <h1>🔄 Telegram Bot API Proxy</h1>
  <p>This Cloudflare Worker acts as a proxy for Telegram Bot API. Replace <code>api.telegram.org</code> with this Worker’s URL in your bot.</p>

  <h2>🔧 Usage</h2>
  <div class="example">
    <p><strong>Original API call:</strong></p>
    <div class="code">https://api.telegram.org/bot&lt;TOKEN&gt;/sendMessage</div>
    <p><strong>Use via proxy:</strong></p>
    <div class="code">https://&lt;YOUR-WORKER-SUBDOMAIN&gt;.workers.dev/bot&lt;TOKEN&gt;/sendMessage</div>
  </div>

  <h2>✅ Features</h2>
  <ul>
    <li>Supports all Bot API methods</li>
    <li>Handles GET, POST, form-data, JSON</li>
    <li>Full CORS support</li>
    <li>Transparent forwarding of Telegram responses</li>
  </ul>

  <div class="note">
    <strong>Note:</strong> This proxy doesn’t log or store your bot tokens. All data is passed directly to Telegram servers.
  </div>
</body>
</html>`;

async function handleRequest(request) {
  const url = new URL(request.url);

  // Serve documentation at root path
  if (url.pathname === '/' || url.pathname === '') {
    return new Response(DOC_HTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // Validate /bot{token}/method
  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts.length < 2 || !pathParts[0].startsWith('bot')) {
    return new Response('❌ Invalid request path. Use /bot<TOKEN>/<method>', { status: 400 });
  }

  // Build the real Telegram API URL
  const telegramUrl = `${TELEGRAM_API_BASE}${url.pathname}${url.search}`;

  // Clone request headers (exclude Host)
  const forwardedHeaders = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (key.toLowerCase() !== 'host') {
      forwardedHeaders.set(key, value);
    }
  }

  // Prepare request body (streaming allowed)
  const proxyRequest = new Request(telegramUrl, {
    method: request.method,
    headers: forwardedHeaders,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
    redirect: 'follow',
  });

  try {
    const tgRes = await fetch(proxyRequest);

    // Clone Telegram response
    const headers = new Headers(tgRes.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return new Response(tgRes.body, {
      status: tgRes.status,
      statusText: tgRes.statusText,
      headers,
    });
  } catch (err) {
    return new Response(`❌ Proxy Error: ${err.message}`, { status: 502 });
  }
}

// CORS preflight handler
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// Cloudflare Worker entry point
addEventListener('fetch', event => {
  const req = event.request;
  if (req.method === 'OPTIONS') {
    event.respondWith(handleOptions());
  } else {
    event.respondWith(handleRequest(req));
  }
});
