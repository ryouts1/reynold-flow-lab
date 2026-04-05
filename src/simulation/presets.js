import { computeReynolds } from './diagnostics.js';

const rawPresets = [
  {
    id: 'steady-wake',
    label: '低 Re: 定常に近い後流',
    velocity: 0.03,
    viscosity: 0.03,
    diameter: 24,
    stepsPerFrame: 2,
    note: '円柱後流の形を落ち着いて観察したいときの設定です。',
  },
  {
    id: 'vortex-shedding',
    label: '中 Re: 周期渦放出',
    velocity: 0.06,
    viscosity: 0.018,
    diameter: 24,
    stepsPerFrame: 2,
    note: '交互の渦放出が見えやすい設定です。プローブ信号も周期的に振れます。',
  },
  {
    id: 'transition-edge',
    label: '高 Re: 3D 遷移閾値の手前',
    velocity: 0.07,
    viscosity: 0.011,
    diameter: 28,
    stepsPerFrame: 3,
    note: '2D モデルで扱える範囲の上限寄りです。高めの Re を試すときの比較用です。',
  },
];

export const PRESETS = rawPresets.map((preset) => ({
  ...preset,
  reynolds: computeReynolds(preset),
}));

export function findPresetById(id) {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[1];
}
