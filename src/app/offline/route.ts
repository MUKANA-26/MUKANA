// Branded offline fallback. Plain static HTML on purpose: it must render with no JavaScript
// and no network, and is precached by the service worker.
export const dynamic = "force-static";

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#032552" />
<title>Offline · Mukana</title>
<meta name="description" content="Mukana is offline. Pages you opened before are still available to read." />
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 24px;
    font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif; background: #ffffff; color: #032552; text-align: center; }
  main { max-width: 360px; }
  img { width: 180px; height: auto; border-radius: 16px; background: #fff; }
  h1 { font-size: 22px; margin: 20px 0 8px; }
  p { margin: 0 0 20px; line-height: 1.5; color: #4a5a73; }
  a { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 22px; border-radius: 10px;
    background: #F8851B; color: #032552; font-weight: 700; text-decoration: none; }
  a:focus-visible { outline: 3px solid #034B85; outline-offset: 2px; }
  @media (prefers-color-scheme: dark) { body { background: #0B1424; color: #F2F5FA; } p { color: #aab8d0; } }
</style>
</head>
<body>
<main>
  <img src="/brand/logo-full.png" alt="Mukana" width="180" height="180" />
  <h1>You&rsquo;re offline</h1>
  <p>Mukana can&rsquo;t reach the internet right now. Pages you opened before, including your saved opportunities and applications, are still available to read.</p>
  <a href="/">Try again</a>
</main>
</body>
</html>`;

export function GET() {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
