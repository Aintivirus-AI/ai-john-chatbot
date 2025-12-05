(() => {
  const STYLE_ID = "john-mcafee-widget-style";
  const JOHN_MCAFEE_QUOTES = [
    "\"Privacy is the foundation of all other rights.\"",
    "\"I am constantly amazed by the number of people who think that privacy is not important.\"",
    "\"The government wants backdoor access to everything. That's not security—that's surveillance.\"",
    "\"If you have nothing to hide, you have nothing to fear—unless you're living in a police state.\"",
    "\"The blockchain is immutable. You cannot change it. That's its power.\"",
    "\"Cryptocurrency is the future. The question is not if, but when.\"",
    "\"The internet is the first thing that humanity has built that humanity doesn't understand.\"",
    "\"I am not afraid of death. I am afraid of not living.\"",
    "\"The only way to deal with an unfree world is to become so absolutely free that your very existence is an act of rebellion.\"",
    "\"Privacy is not about hiding something. It's about protecting something.\"",
    "\"The government doesn't want you to have privacy because privacy is power.\"",
    "\"Bitcoin is the beginning of something great: a currency without a government.\"",
    "\"The internet was built to be free. We must keep it that way.\"",
    "\"If you're not doing something that makes you uncomfortable, you're not growing.\"",
    "\"The truth is dangerous. That's why governments fear it.\"",
    "\"Cryptocurrency represents the first viable alternative to the traditional banking system.\"",
    "\"Privacy is not a crime. Surveillance is.\"",
    "\"The blockchain cannot be corrupted. It is incorruptible by design.\"",
    "\"Freedom is not given. It is taken.\"",
    "\"The only way to have privacy is to take it.\""
  ];

  const DEFAULTS = {
    endpoint: "http://localhost:3000/api/chat",
    title: "Chat with John",
    subtitle: null,
    accentColor: "#0066FF",
    backgroundColor: "#0f172a",
    textColor: "#e2e8f0",
    launcherImage: "https://ai-bot.aintivirus.ai/ai-john.jpg",
    glowColor: "#00CCFF",
    assistantAvatar: "https://ai-bot.aintivirus.ai/binary-john.jpg"
  };

  const WELCOME_MESSAGES = [
    "John here. Ask me anything—crypto strategy, privacy ops, or the latest digital mischief.",
    "McAfee here. What do you want to know? Crypto moves, privacy hacks, or how the system really works?",
    "John speaking. Fire away—crypto intel, privacy tactics, or whatever digital chaos you're curious about.",
    "You've got John. Crypto insights, privacy strategies, or the truth about what's happening in the digital underground?",
    "McAfee here. Ready to talk crypto, privacy, or the latest tech that's shaking things up?",
    "John here. What's on your mind? Crypto plays, privacy tools, or the real story behind the headlines?",
    "You're talking to John. Crypto strategy, privacy ops, or the digital world's latest moves—what do you need?",
    "McAfee speaking. Crypto intel, privacy hacks, or the tech that's actually changing the game?",
    "John here. Ask me about crypto, privacy, or whatever digital frontier you're exploring.",
    "McAfee here. Crypto moves, privacy tactics, or the latest in digital disruption—what's your question?",
    "John speaking. Crypto strategy, privacy tools, or the real tech that matters—what do you want to know?",
    "You've got McAfee. Crypto insights, privacy ops, or the digital underground—fire away."
  ];

  // Create shadow host
  let shadowHost = document.getElementById("john-mcafee-widget-host");
  if (!shadowHost) {
    shadowHost = document.createElement("div");
    shadowHost.id = "john-mcafee-widget-host";
    shadowHost.style.cssText = "position: fixed; inset: 0; pointer-events: none; z-index: 2147483000;";
    document.body.appendChild(shadowHost);
  }
  const shadow = shadowHost.shadowRoot || shadowHost.attachShadow({ mode: "open" });

  // Inject styles into shadow root (only once)
  if (!shadow.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      :host {
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #e2e8f0;
        all: initial;
      }

      .john-widget-launcher {
        --john-widget-glow-color: 0,204,255;
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483000;
        width: 88px;
        height: 88px;
        border: 0.5px solid rgba(var(--john-widget-glow-color),0.4);
        border-radius: 999px;
        padding: 4px;
        box-sizing: border-box;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        box-shadow:
          0 0 12px rgba(var(--john-widget-glow-color),0.7),
          0 0 24px rgba(var(--john-widget-glow-color),0.4);
        animation: john-widget-glow 2.6s ease-in-out infinite;
        outline: none;
        border: none;
        overflow: visible;
        contain: layout style paint;
        isolation: isolate;
        pointer-events: auto;
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .john-widget-launcher::before {
        content: "";
        position: absolute;
        inset: -10px;
        background: radial-gradient(circle, rgba(var(--john-widget-glow-color),0.65), transparent 70%);
        filter: blur(8px);
        border-radius: 50%;
        opacity: 0.95;
        animation: john-widget-glow 2.6s ease-in-out infinite;
        z-index: -1;
      }

      .john-widget-launcher-img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
        display: block;
        pointer-events: none;
        box-shadow: inset 0 0 0 4px rgba(var(--john-widget-glow-color),0.8);
        border: 3px solid rgba(var(--john-widget-glow-color),0.7);
      }

      .john-widget-launcher:focus-visible {
        box-shadow:
          0 0 0 3px rgba(var(--john-widget-glow-color),0.7),
          0 0 20px rgba(var(--john-widget-glow-color),0.8),
          0 0 36px rgba(var(--john-widget-glow-color),0.5);
      }

      @keyframes john-widget-glow {
        0% {
          box-shadow:
            0 0 12px rgba(var(--john-widget-glow-color),0.65),
            0 0 24px rgba(var(--john-widget-glow-color),0.4);
          opacity: 0.9;
        }
        50% {
          box-shadow:
            0 0 18px rgba(var(--john-widget-glow-color),0.9),
            0 0 36px rgba(var(--john-widget-glow-color),0.5);
          opacity: 1;
        }
        100% {
          box-shadow:
            0 0 12px rgba(var(--john-widget-glow-color),0.65),
            0 0 24px rgba(var(--john-widget-glow-color),0.4);
          opacity: 0.9;
        }
      }

      .john-sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        border: 0;
        white-space: nowrap;
      }

      .john-widget-panel {
        position: fixed;
        bottom: 24px;
        right: 24px !important;
        left: auto !important;
        margin: 0 !important;
        width: 380px;
        display: none;
        max-width: calc(100vw - 20px);
        height: 700px;
        max-height: calc(100vh - 60px);
        border-radius: 30px;
        box-shadow:
          0 0 40px rgba(0,102,255,0.6),
          0 0 80px rgba(0,102,255,0.4),
          0 0 120px rgba(0,204,255,0.3),
          0 30px 90px rgba(2,6,23,0.9),
          inset 0 0 0 1px rgba(0,102,255,0.25);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        z-index: 2147483000;
        transform: translateY(24px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 200ms ease, transform 220ms ease;
        background: radial-gradient(circle at 20% -20%, rgba(0,102,255,0.4), transparent 45%),
          radial-gradient(circle at 90% 10%, rgba(0,204,255,0.35), transparent 30%),
          rgba(2,6,23,0.94);
        backdrop-filter: blur(28px);
        position: relative;
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #e2e8f0;
      }

      .john-widget-panel::before {
        content: "";
        position: absolute;
        inset: 0;
        opacity: 0;
        pointer-events: none;
      }

      .john-binary-rain {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 0;
        opacity: 0.06;
        font-family: "Courier New", monospace;
        font-size: 14px;
        line-height: 1.4;
        color: rgba(0,255,128,0.35);
        text-shadow: 0 0 3px rgba(0,255,128,0.25);
        border-radius: 30px;
      }

      .john-binary-column {
        position: absolute;
        top: -100%;
        animation: john-binary-fall linear infinite;
        white-space: nowrap;
        user-select: none;
      }

      @keyframes john-binary-fall {
        0% {
          transform: translateY(0);
        }
        100% {
          transform: translateY(800px);
        }
      }

      .john-widget-panel::after {
        content: "";
        position: absolute;
        inset: -8px;
        background: radial-gradient(circle at center, rgba(0,102,255,0.3), transparent 70%);
        filter: blur(20px);
        pointer-events: none;
        z-index: -1;
        border-radius: 30px;
      }

      .john-widget-panel.open {
        opacity: 1;
        display: flex;
        transform: translateY(0);
        pointer-events: all;
      }

      .john-widget-header {
        padding: 16px 20px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        display: flex;
        flex-direction: column;
        gap: 10px;
        position: relative;
        z-index: 2;
      }

      .john-widget-header::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(15,23,42,0.75), transparent);
        pointer-events: none;
        z-index: -1;
      }

      .john-widget-header-top {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .john-widget-header-avatar {
        width: 44px;
        height: 44px;
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid rgba(0,102,255,0.35);
        box-shadow: 0 15px 40px rgba(2,6,23,0.8);
      }

      .john-widget-header-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .john-widget-header-copy {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .john-widget-header-copy h2 {
        margin: 0;
        font-size: 17px;
      }

      .john-widget-header-copy p {
        margin: 4px 0 0;
        font-size: 12px;
        opacity: 0.8;
        font-style: italic;
      }

      .john-widget-close {
        margin-left: auto;
        background: rgba(0,20,40,0.75);
        border: 1px solid rgba(0,102,255,0.25);
        color: inherit;
        font-size: 14px;
        width: 38px;
        height: 38px;
        border-radius: 12px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: border 150ms ease, transform 150ms ease;
      }

      .john-widget-close:hover {
        border-color: rgba(0,204,255,0.5);
        transform: translateY(-1px);
      }

      .john-widget-status-chip,
      .john-widget-status-dot {
        display: none;
      }

      .john-widget-messages {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        padding: 20px 20px 12px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        scrollbar-width: thin;
        scrollbar-color: rgba(0,102,255,0.5) rgba(2,6,23,0.5);
      }

      .john-widget-message-wrapper {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        max-width: 100%;
      }

      .john-widget-message-wrapper.user-wrapper {
        flex-direction: row-reverse;
      }

      .john-widget-message-avatar {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        flex-shrink: 0;
        overflow: hidden;
        position: relative;
        border: 2px solid rgba(0,255,128,0.4);
        box-shadow:
          0 0 15px rgba(0,255,128,0.5),
          0 0 30px rgba(0,255,128,0.3),
          inset 0 0 20px rgba(0,255,128,0.2);
        background: #000;
        animation: john-avatar-glow 3s ease-in-out infinite;
      }

      .john-widget-message-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        filter: brightness(1.2) contrast(1.1);
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
      }

      .john-widget-message-avatar::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,255,128,0.03) 2px,
            rgba(0,255,128,0.03) 4px
          ),
          repeating-linear-gradient(
            90deg,
            transparent,
            transparent 2px,
            rgba(0,255,128,0.03) 2px,
            rgba(0,255,128,0.03) 4px
          );
        pointer-events: none;
        mix-blend-mode: overlay;
      }

      .john-widget-message-avatar::after {
        content: "";
        position: absolute;
        inset: -2px;
        background: radial-gradient(circle at center, rgba(0,255,128,0.2), transparent 70%);
        filter: blur(8px);
        opacity: 0.8;
        animation: john-avatar-glow 3s ease-in-out infinite;
        z-index: -1;
      }

      @keyframes john-avatar-glow {
        0%, 100% {
          box-shadow:
            0 0 15px rgba(0,255,128,0.5),
            0 0 30px rgba(0,255,128,0.3),
            inset 0 0 20px rgba(0,255,128,0.2);
          border-color: rgba(0,255,128,0.4);
        }
        50% {
          box-shadow:
            0 0 20px rgba(0,255,128,0.7),
            0 0 40px rgba(0,255,128,0.5),
            inset 0 0 25px rgba(0,255,128,0.3);
          border-color: rgba(0,255,128,0.6);
        }
      }

      .john-widget-messages::-webkit-scrollbar {
        width: 8px;
      }

      .john-widget-messages::-webkit-scrollbar-track {
        background: rgba(2,6,23,0.5);
      }

      .john-widget-messages::-webkit-scrollbar-thumb {
        background: rgba(0,102,255,0.5);
        border-radius: 4px;
        border: 2px solid rgba(2,6,23,0.5);
      }

      .john-widget-message {
        padding: 14px 18px;
        border-radius: 18px;
        font-size: 14px;
        line-height: 1.6;
        white-space: pre-wrap;
        border: 1px solid transparent;
        box-shadow: 0 20px 45px rgba(2,6,23,0.75);
        position: relative;
        overflow: visible;
        max-width: calc(85% - 52px);
        box-sizing: border-box;
        flex-shrink: 0;
        background: rgba(7,11,30,0.9);
        align-self: flex-start;
        text-align: left;
      }
      .john-widget-message.user {
        margin-left: auto;
        border-bottom-right-radius: 6px;
        background: linear-gradient(135deg, rgba(0,102,255,0.95), rgba(0,204,255,0.9));
        border-color: rgba(0,204,255,0.5);
        color: #f8fafc;
      }

      .john-widget-message.assistant {
        margin-right: auto;
        border-top-left-radius: 6px;
        background: rgba(7,11,30,0.92);
        border-color: rgba(0,102,255,0.4);
        color: #e2e8f0;
      }

      .john-widget-message-text {
        display: block;
        word-break: break-word;
        overflow-wrap: anywhere;
      }

      .john-widget-message-meta {
        margin-top: 10px;
        font-size: 11px;
        opacity: 0.7;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .john-widget-message-meta span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .john-message-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: rgba(255,255,255,0.55);
      }

      .john-widget-input {
        border-top: 1px solid rgba(0,102,255,0.3);
        padding: 14px 20px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        background: rgba(4,8,20,0.95);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        position: relative;
        z-index: 2;
        box-sizing: border-box;
        flex-shrink: 0;
        width: 100%;
      }

      .john-widget-input textarea {
        resize: none;
        border-radius: 18px;
        border: 1px solid rgba(0,102,255,0.4);
        padding: 12px 14px;
        font-family: inherit;
        font-size: 14px;
        min-height: 48px;
        outline: none;
        background: rgba(15,23,42,0.8);
        color: inherit;
        transition: border 120ms ease, box-shadow 120ms ease;
        box-shadow: inset 0 0 30px rgba(2,6,23,0.8);
      }

      .john-widget-input textarea:focus {
        border-color: rgba(0,204,255,0.8);
        box-shadow: 0 0 0 1px rgba(0,102,255,0.5), inset 0 0 30px rgba(2,6,23,0.8), 0 0 15px rgba(0,102,255,0.35);
      }

      .john-widget-meta-row {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-width: 0;
      }

      .john-char-count {
        font-variant-numeric: tabular-nums;
        margin-left: auto;
        color: rgba(0,204,255,1);
        font-size: 10px;
      }

      .john-widget-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        width: 100%;
      }

      .john-widget-input button {
        margin-left: auto;
        border: none;
        border-radius: 14px;
        padding: 8px 18px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 18px 35px rgba(0,102,255,0.5);
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        background: linear-gradient(135deg, rgba(0,102,255,0.95), rgba(0,204,255,0.9));
        color: #fff;
        transition: transform 150ms ease, box-shadow 150ms ease;
      }

      .john-widget-input button:hover {
        transform: translateY(-1px);
        box-shadow: 0 20px 40px rgba(0,102,255,0.6);
      }

      .john-widget-input button:active {
        transform: translateY(0);
      }

      .john-widget-input button svg {
        width: 16px;
        height: 16px;
      }

      .john-widget-status {
        font-size: 11px;
        opacity: 0.8;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        flex-shrink: 0;
        min-width: 0;
        overflow: visible;
      }

      .john-typing-indicator {
        display: none;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: rgba(0,204,255,0.95);
      }

      .john-typing-indicator span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: rgba(0,204,255,1);
        animation: john-typing 1s infinite ease-in-out;
      }

      .john-typing-indicator span:nth-child(2) {
        animation-delay: 0.1s;
      }

      .john-typing-indicator span:nth-child(3) {
        animation-delay: 0.2s;
      }

      .john-widget-input-footer {
        font-size: 10px;
        color: rgba(0,204,255,0.85);
        display: flex;
        justify-content: space-between;
        margin-top: -4px;
      }

      [data-visible="true"] {
        display: flex !important;
      }

      [data-disabled="true"] {
        opacity: 0.45;
        pointer-events: none;
      }

      @keyframes john-typing {
        0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
        40% { transform: scale(1); opacity: 1; }
      }
    `;
    shadow.appendChild(style);
  }

  function hexToRgbTuple(hex = "") {
    const raw = hex.replace("#", "").trim();
    if (!raw) return null;
    const normalized = raw.length === 3 ? raw.split("").map((char) => char + char).join("") : raw.padEnd(6, "0").slice(0, 6);
    const int = Number.parseInt(normalized, 16);
    if (Number.isNaN(int)) return null;
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `${r},${g},${b}`;
  }

  class JohnWidget {
    constructor(options = {}) {
      this.config = { ...DEFAULTS, ...options };
      if (!this.config.subtitle || this.config.subtitle === "Crypto intel with an edge.") {
        this.config.subtitle = JOHN_MCAFEE_QUOTES[Math.floor(Math.random() * JOHN_MCAFEE_QUOTES.length)];
      }
      this.isOpen = false;
      this.charLimit = 1000;
      const randomWelcome = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
      this.messages = [
        {
          role: "assistant",
          content: randomWelcome
        }
      ];
      this.endpoint = this.config.endpoint.replace(/\/$/, "");
      this.shadowRoot = shadow;
    }

    mount() {
      this.createLauncher();
      this.createPanel();
      this.renderHistory();
    }

    createLauncher() {
      this.launcher = document.createElement("button");
      this.launcher.className = "john-widget-launcher";
      const glowRgb = hexToRgbTuple(this.config.glowColor);
      if (glowRgb) {
        this.launcher.style.setProperty("--john-widget-glow-color", glowRgb);
      }
      if (this.config.launcherImage) {
        const avatar = document.createElement("img");
        avatar.src = this.config.launcherImage;
        avatar.alt = "";
        avatar.className = "john-widget-launcher-img";
        this.launcher.appendChild(avatar);
      } else {
        this.launcher.style.background = this.config.accentColor;
      }
      const srOnly = document.createElement("span");
      srOnly.className = "john-sr-only";
      srOnly.textContent = `${this.config.title} chat widget`;
      this.launcher.appendChild(srOnly);
      this.launcher.addEventListener("click", () => this.toggle());
      this.shadowRoot.appendChild(this.launcher);
    }

    createPanel() {
      this.panel = document.createElement("section");
      this.panel.className = "john-widget-panel";
      this.panel.style.color = this.config.textColor;

      const binaryRain = document.createElement("div");
      binaryRain.className = "john-binary-rain";
      this.createBinaryRain(binaryRain);
      this.panel.appendChild(binaryRain);

      const header = document.createElement("header");
      header.className = "john-widget-header";

      const headerTop = document.createElement("div");
      headerTop.className = "john-widget-header-top";

      const avatarWrapper = document.createElement("div");
      avatarWrapper.className = "john-widget-header-avatar";
      if (this.config.launcherImage) {
        const avatarImg = document.createElement("img");
        avatarImg.src = this.config.launcherImage;
        avatarImg.alt = "";
        avatarWrapper.appendChild(avatarImg);
      } else {
        avatarWrapper.style.background = "#1d293b";
      }

      const copy = document.createElement("div");
      copy.className = "john-widget-header-copy";
      const title = document.createElement("h2");
      title.textContent = this.config.title;
      const subtitle = document.createElement("p");
      subtitle.textContent = this.config.subtitle;
      copy.appendChild(title);
      copy.appendChild(subtitle);

      const close = document.createElement("button");
      close.className = "john-widget-close";
      close.setAttribute("aria-label", "Close widget");
      close.innerHTML = "&times;";
      close.addEventListener("click", () => this.close());

      headerTop.appendChild(avatarWrapper);
      headerTop.appendChild(copy);
      headerTop.appendChild(close);

      header.appendChild(headerTop);

      this.messageList = document.createElement("div");
      this.messageList.className = "john-widget-messages";

      const inputWrapper = document.createElement("div");
      inputWrapper.className = "john-widget-input";

      this.textarea = document.createElement("textarea");
      this.textarea.placeholder = "Ask away. Shift+Enter for new line.";
      this.textarea.maxLength = this.charLimit;
      this.textarea.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          this.handleSend();
        }
      });
      this.textarea.addEventListener("input", () => {
        this.updateCharCount();
      });

      this.status = document.createElement("div");
      this.status.className = "john-widget-status";
      this.status.textContent = "Ready when you are.";

      const metaRow = document.createElement("div");
      metaRow.className = "john-widget-meta-row";
      metaRow.appendChild(this.status);

      this.charCount = document.createElement("span");
      this.charCount.className = "john-char-count";
      this.charCount.textContent = `0 / ${this.charLimit}`;

      metaRow.appendChild(this.charCount);

      this.sendButton = document.createElement("button");
      this.sendButton.innerHTML = `Send <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l16 8-16 8 4-8-4-8z"/></svg>`;
      this.sendButton.addEventListener("click", () => this.handleSend());
      this.sendButton.dataset.disabled = "false";

      this.typingIndicator = document.createElement("div");
      this.typingIndicator.className = "john-typing-indicator";
      this.typingIndicator.dataset.visible = "false";
      this.typingIndicator.innerHTML = `<span></span><span></span><span></span> John is thinking...`;

      const actionsRow = document.createElement("div");
      actionsRow.className = "john-widget-actions";
      actionsRow.appendChild(this.typingIndicator);
      actionsRow.appendChild(this.sendButton);

      this.inputFooter = document.createElement("div");
      this.inputFooter.className = "john-widget-input-footer";
      this.inputFooter.innerHTML = `<span>Press Enter to send</span><span>Shift+Enter for newline</span>`;

      inputWrapper.appendChild(this.textarea);
      inputWrapper.appendChild(metaRow);
      inputWrapper.appendChild(actionsRow);
      inputWrapper.appendChild(this.inputFooter);

      this.panel.appendChild(header);
      this.panel.appendChild(this.messageList);
      this.panel.appendChild(inputWrapper);

      this.shadowRoot.appendChild(this.panel);

      this.updateCharCount();
      this.setStatus("Ready when you are.");
    }

    createBinaryRain(container) {
      setTimeout(() => {
        const panelWidth = this.panel.offsetWidth || 380;
        const columnCount = Math.floor(panelWidth / 12);
        const charCount = 60;
        const columnSpacing = panelWidth / columnCount;

        for (let i = 0; i < columnCount; i++) {
          const column = document.createElement("div");
          column.className = "john-binary-column";
          column.style.left = `${i * columnSpacing}px`;

          let binaryText = "";
          for (let j = 0; j < charCount; j++) {
            binaryText += (Math.random() > 0.5 ? "0" : "1") + "<br>";
          }
          column.innerHTML = binaryText;

          const duration = 12 + Math.random() * 8;
          column.style.animationDuration = `${duration}s`;

          column.style.animationDelay = `${Math.random() * 3}s`;

          container.appendChild(column);
        }

        this.binaryRainInterval = setInterval(() => {
          const columns = container.querySelectorAll(".john-binary-column");
          columns.forEach(column => {
            const lines = column.innerHTML.split("<br>").filter(l => l.trim());
            const newLines = lines.map(() => {
              return Math.random() > 0.5 ? "0" : "1";
            });
            column.innerHTML = newLines.join("<br>") + "<br>";
          });
        }, 80);
      }, 100);
    }

    toggle() {
      this.isOpen ? this.close() : this.open();
    }

    open() {
      this.isOpen = true;
      this.panel.classList.add("open");
      this.panel.style.setProperty("right", "24px", "important");
      this.panel.style.setProperty("left", "auto", "important");
      this.panel.style.setProperty("margin", "0", "important");
      this.panel.style.setProperty("position", "fixed", "important");
      if (this.launcher) {
        this.launcher.style.display = "none";
      }
      this.textarea.focus();
    }

    close() {
      this.isOpen = false;
      this.panel.classList.remove("open");
      if (this.launcher) {
        this.launcher.style.display = "";
      }
    }

    renderHistory() {
      this.messageList.innerHTML = "";
      this.messages.forEach((message, index) => {
        const meta = index === 0 && message.role === "assistant" ? { time: this.formatTime(new Date()) } : {};
        this.appendMessage(message, meta);
      });
      this.scrollToBottom();
    }

    appendMessage(message, meta = {}) {
      const wrapper = document.createElement("div");
      wrapper.className = `john-widget-message-wrapper ${message.role}-wrapper`;

      if (message.role === "assistant" && this.config.assistantAvatar) {
        const avatar = document.createElement("div");
        avatar.className = "john-widget-message-avatar";
        const avatarImg = document.createElement("img");
        avatarImg.src = this.config.assistantAvatar;
        avatarImg.alt = "John McAfee";
        avatar.appendChild(avatarImg);
        wrapper.appendChild(avatar);
      } else if (message.role === "assistant") {
        const avatar = document.createElement("div");
        avatar.className = "john-widget-message-avatar";
        avatar.style.background = "radial-gradient(circle, rgba(0,255,128,0.3), #000)";
        wrapper.appendChild(avatar);
      }

      const bubble = document.createElement("div");
      bubble.className = `john-widget-message ${message.role}`;

      const body = document.createElement("div");
      body.className = "john-widget-message-text";
      body.textContent = message.content;
      bubble.appendChild(body);

      if (meta.time) {
        const metaRow = document.createElement("div");
        metaRow.className = "john-widget-message-meta";
        if (meta.time) {
          metaRow.innerHTML += `<span><span class="john-message-dot"></span>${meta.time}</span>`;
        }
        bubble.appendChild(metaRow);
      }

      wrapper.appendChild(bubble);
      this.messageList.appendChild(wrapper);
      this.scrollToBottom();
    }

    scrollToBottom() {
      this.messageList.scrollTo({
        top: this.messageList.scrollHeight,
        behavior: "smooth"
      });
    }

    updateCharCount() {
      if (!this.charCount || !this.textarea) return;
      const length = this.textarea.value.length;
      this.charCount.textContent = `${length} / ${this.charLimit}`;
      if (length >= this.charLimit) {
        this.charCount.style.color = "#fbbf24";
      } else {
        this.charCount.style.color = "rgba(0,204,255,1)";
      }
    }

    formatTime(date) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    async handleSend() {
      let content = (this.textarea.value || "").trim();
      if (!content) return;

      if (content.length > this.charLimit) {
        content = content.slice(0, this.charLimit);
      }

      this.textarea.value = "";
      this.updateCharCount();
      const userMessage = { role: "user", content };
      this.messages.push(userMessage);
      this.appendMessage(userMessage, { time: this.formatTime(new Date()) });
      await this.fetchResponse();
    }

    async fetchResponse() {
      this.setStatus("Thinking...");
      this.setDisabled(true);
      if (this.typingIndicator) {
        this.typingIndicator.dataset.visible = "true";
      }

      try {
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messages: this.messages
          })
        });

        const data = await response.json();
        if (!response.ok) {
          if (response.status === 400 && data?.error?.includes("too long")) {
            this.messages = this.messages.slice(-4);
            const lastMessage = this.messageList.lastElementChild;
            if (lastMessage && lastMessage.classList.contains("assistant")) {
              lastMessage.remove();
            }
            throw new Error("Conversation got too long. I've trimmed it - try again.");
          }
          throw new Error(data?.error || "Request failed");
        }

        const assistantMessage = { role: "assistant", content: data.text };
        this.messages.push(assistantMessage);
        this.appendMessage(assistantMessage, {
          time: this.formatTime(new Date()),
          model: undefined
        });
        const statusText = data.usedSearch ? "Pulled intel from open web." : "Answered from base knowledge.";
        this.setStatus(statusText);
      } catch (error) {
        console.error(error);
        const fallback = {
          role: "assistant",
          content: error?.message || "Something jammed the signal. Refresh or try again in a beat."
        };
        this.messages.push(fallback);
        this.appendMessage(fallback);
        this.setStatus(error?.message || "Request failed.");
      } finally {
        this.setDisabled(false);
        if (this.typingIndicator) {
          this.typingIndicator.dataset.visible = "false";
        }
      }
    }

    setDisabled(disabled) {
      this.textarea.disabled = disabled;
      if (this.sendButton) {
        this.sendButton.disabled = disabled;
        this.sendButton.dataset.disabled = String(disabled);
      }
    }

    setStatus(text) {
      if (this.status) {
        this.status.textContent = text ?? "";
      }
    }
  }

  window.JohnMcAfeeWidget = {
    mount(options) {
      const widget = new JohnWidget(options);
      widget.mount();
      return widget;
    }
  };
})();