import { classifyRegime, formatNumber } from '../simulation/diagnostics.js';

export function buildNoteHtml(metrics, params, slice, presetNote) {
  const regime = classifyRegime(metrics.reynolds, metrics.maxSpanwiseSpeed);

  return `
    <h3>${regime.title}</h3>
    <p>${regime.summary}</p>
    <p><strong>現在の Re:</strong> ${formatNumber(metrics.reynolds, 1)}</p>
    <p><strong>spanwise seed:</strong> ${formatNumber(params.spanwiseSeed, 4)}</p>
    <p><strong>現在の断面:</strong> ${slice.plane.toUpperCase()} / ${slice.fixedAxis} = ${slice.index}</p>
    <p><strong>プリセットの狙い:</strong> ${presetNote}</p>
    <p class="caution">${regime.caution}</p>
  `;
}
