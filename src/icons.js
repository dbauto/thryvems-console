/**
 * UI-GUIDELINES §2: Lucide outline icons in the ThryveMS interface.
 * The build generates a small SVG symbol sprite from the pinned lucide-static package.
 * No CDN, icon font, emoji, or runtime network calls.
 */
export const ICON_NAMES = Object.freeze([
  "layout-dashboard", "building-2", "server", "git-branch", "wallet",
  "mail", "scroll-text", "settings", "flag", "life-buoy", "users",
  "circle-check", "circle-dot", "flask-conical", "triangle-alert", "user-round-plus",
  "arrow-down-up", "chart-no-axes-combined", "users-round", "percent",
  "receipt-text", "circle-dashed", "circle-x", "info", "chevron-left",
  "chevron-right", "panel-left-close", "panel-left-open", "menu", "sun", "moon",
  "activity", "shield-check", "calendar-days", "clipboard-list", "badge-check",
]);
const ALLOWED = new Set(ICON_NAMES);
// Legacy figure names remain supported so no sample KPI is silently replaced.
const LEGACY_NAMES = Object.freeze({
  "▦": "layout-dashboard", "▤": "building-2", "▣": "server",
  "⇧": "git-branch", "₱": "wallet", "✉": "mail",
  "≡": "scroll-text", "⚙": "settings", "⚑": "flag",
  "⌂": "life-buoy", "♙": "users", "✓": "circle-check",
  "○": "circle-dot", "◇": "flask-conical", "!": "triangle-alert",
  "+": "user-round-plus", "⇅": "arrow-down-up", "◆": "chart-no-axes-combined",
  "♟": "users-round", "%": "percent", "◫": "receipt-text",
  "◌": "circle-dashed", "✕": "circle-x",
});
export function icon(name, className = "") {
  const candidate = LEGACY_NAMES[name] || name;
  const safeName = ALLOWED.has(candidate) ? candidate : "layout-dashboard";
  const cls = className ? ' ' + className.replace(/[^a-z0-9-_ ]/gi, "") : "";
  return '<svg class="lucide-icon' + cls + '" aria-hidden="true" focusable="false" viewBox="0 0 24 24"><use href="./icons.svg#' + safeName + '"></use></svg>';
}
