const FRESH_KEYWORDS = [
  "today",
  "tonight",
  "now",
  "current",
  "latest",
  "news",
  "price",
  "market",
  "update",
  "recent",
  "trend",
  "breaking",
  "live",
  "weather",
  "forecast",
  "humidity",
  "temperature"
];

export function needsFreshAnswer(input?: string | null): boolean {
  if (!input) {
    return false;
  }

  const normalized = input.toLowerCase();
  return FRESH_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export { FRESH_KEYWORDS };

