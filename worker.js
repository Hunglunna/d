// Telegram Bot API base URL
const TELEGRAM_API_BASE = 'https://api.telegram.org';

// HTML template for root path (docs)
const DOC_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Hiển thị trang HungLunNa</title>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      height: 100%;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
  </style>
</head>
<body>
  <iframe src="https://hunglunna.github.io/hunglunna/" title="Trang HungLunNa"></iframe>
</body>
</html>
`;

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
