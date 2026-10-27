// =====================================================================
// Icon system — hand-authored inline SVGs.
// 14×14 viewBox, 1.5 stroke, currentColor, rounded caps and joins.
// Every icon shares the same visual language so they read as one family.
// =====================================================================

const STROKE = 'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"';

export const ICONS = {
  edit:
    '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">' +
    '<path ' + STROKE + ' d="M11 2.5l2.5 2.5-8.5 8.5H2.5V11z"/>' +
    '<path ' + STROKE + ' d="M9.5 4l2.5 2.5"/>' +
    '</svg>',

  close:
    '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">' +
    '<path ' + STROKE + ' d="M4 4l8 8M12 4l-8 8"/>' +
    '</svg>',

  trash:
    '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">' +
    '<path ' + STROKE + ' d="M2.5 4h11"/>' +
    '<path ' + STROKE + ' d="M6 4V2.5h4V4"/>' +
    '<path ' + STROKE + ' d="M4.5 4l.5 9.5h6l.5-9.5"/>' +
    '<path ' + STROKE + ' d="M7 6.5v5M9 6.5v5"/>' +
    '</svg>'
};

export function icon(name) {
  return ICONS[name] || '';
}
