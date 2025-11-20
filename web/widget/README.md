# John McAfee Chat Widget

Lightweight drop-in script for embedding the $AINTI John McAfee chatbot on any site—no framework required.

## Quick start

1. Serve `web/widget/widget.js` from your CDN or static host (for local dev you can use `http://localhost:3000/widget.js` via any static server).
2. Include it anywhere on the page **after** the DOM is ready:

```html
<script src="/widget.js"></script>
<script>
  document.addEventListener("DOMContentLoaded", () => {
    JohnMcAfeeWidget.mount({
      endpoint: "https://api.ainti.com", // Points to your deployed backend
      title: "Ask John",
      subtitle: "Crypto intel with an edge.",
      accentColor: "#ff4b2b"
    });
  });
</script>
```

> **Heads-up:** the circular launcher expects `ai-john.jpg` (or any image you pass via `launcherImage`) to be reachable from the page. Drop the JPEG next to `widget.js` or provide an absolute URL.

## Options

| Option         | Type     | Default                        | Description                                                  |
| -------------- | -------- | ------------------------------ | ------------------------------------------------------------ |
| `endpoint`        | string   | `http://localhost:3000/api/chat` | Full URL to the chat endpoint (include `/api/chat`). |
| `title`           | string   | `Chat with John`               | Header + launcher copy.                                      |
| `subtitle`        | string   | `McAfee-mode intel. 24/7.`     | Smaller header text.                                         |
| `accentColor`     | string   | `#ff4b2b`                      | Used for CTA button + highlights.                            |
| `backgroundColor` | string   | `#0f172a`                      | Widget panel background.                                     |
| `textColor`       | string   | `#e2e8f0`                      | Body text color.                                             |
| `launcherImage`   | string   | `ai-john.jpg`                  | Path/URL for the circular launcher art (JPEG/PNG/SVG).       |
| `glowColor`       | string   | `#38bdf8`                      | Hex color for the pulsing glow behind the launcher.          |

## Behavior

- Floating launcher appears bottom-right; clicking toggles the chat panel.
- Conversation history is stored in memory per page load and sent with every request.
- Citations are rendered beneath responses when the backend returns URLs (from the web search flow).
- Minimal dependencies: the script injects its own CSS and uses the native Fetch API.

## Customization tips

- Fork `widget.js` if you need to mount the UI into a specific container instead of floating.
- To pre-fill the chat with a custom greeting, update the `this.messages` seed in the constructor.
- Hook into lifecycle events (e.g., track usage) by wrapping `fetch` or editing `fetchResponse`.

