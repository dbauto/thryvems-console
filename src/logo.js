/**
 * ThryveMS product mark and wordmark (from the owner's sidebar reference, 25 Oct 2026).
 * The product mark is separate from status colours and from client white-label branding.
 */
let n = 0;

/** Interlocking ribbon mark. Two mirrored rounded strokes crossing in the middle. */
export function productMark(size = 34) {
  const id = "tm" + n++;
  return '<svg class="product-mark" width="' + size + '" height="' + Math.round(size * 0.84) + '" viewBox="0 0 48 40" aria-hidden="true" focusable="false">' +
    '<defs><linearGradient id="' + id + 'a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6be6c1"/><stop offset="1" stop-color="#19b386"/></linearGradient>' +
    '<linearGradient id="' + id + 'b" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#21c08f"/><stop offset="1" stop-color="#0e8a66"/></linearGradient></defs>' +
    '<path d="M41 33V12C41 5 33 4.5 29.5 10L18.5 30C15 35.5 7 35 7 28V7" fill="none" stroke="url(#' + id + 'b)" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M7 33V12C7 5 15 4.5 18.5 10L29.5 30C33 35.5 41 35 41 28V7" fill="none" stroke="url(#' + id + 'a)" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>";
}

/** "Thryve" in the current text colour, "MS" in the brand accent. */
export const wordmark = () => '<span class="wordmark">Thryve<span class="wordmark-ms">MS</span></span>';
