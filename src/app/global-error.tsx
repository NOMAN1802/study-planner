"use client";

// Rendered when the root layout itself fails. It replaces the whole document
// and does not receive the app's global styles, so it carries its own.
const css = `
  :root { color-scheme: light dark; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #f6f6f3; color: #1b1b19; }
  main { max-width: 28rem; margin: 0 auto; padding: 4rem 1rem; }
  h1 { font-size: 1.125rem; margin: 0 0 0.5rem; }
  p { font-size: 0.875rem; line-height: 1.5; color: #66665f; margin: 0 0 1rem; }
  button { font: inherit; font-size: 0.875rem; font-weight: 500; height: 2.25rem; padding: 0 1rem; border-radius: 6px; border: 1px solid #c9c9c2; background: #ffffff; color: inherit; cursor: pointer; }
  button:focus-visible { outline: 2px solid #1e7a58; outline-offset: 2px; }
  @media (prefers-color-scheme: dark) {
    body { background: #121311; color: #ecece7; }
    p { color: #a3a39c; }
    button { background: #1a1b19; border-color: #3f403c; }
    button:focus-visible { outline-color: #3fbf8a; }
  }
`;

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <head>
        <title>Something went wrong · Habit Tracker</title>
        <style>{css}</style>
      </head>
      <body>
        <main role="alert">
          <h1>Something went wrong</h1>
          <p>The app couldn&apos;t load. Your data is safe. Try again, or reload the page.</p>
          <button type="button" onClick={() => retry()}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
