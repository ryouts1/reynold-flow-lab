import { classifyRegime, formatNumber } from '../simulation/diagnostics.js';

export function buildNoteHtml(metrics, presetNote) {
  const regime = classifyRegime(metrics.reynolds);

  return `
    <h3>${regime.title}</h3>
    <p>${regime.summary}</p>
    <p><strong>現在の Re:</strong> ${formatNumber(metrics.reynolds, 1)}</p>
    <p><strong>プリセットの狙い:</strong> ${presetNote}</p>
    <p class="caution">${regime.caution}</p>
  `;
}
