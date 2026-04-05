import { computeReynolds } from './diagnostics.js';

const rawPresets = [
  {
    id: 'mild-3d-wake',
    label: '低 Re: 3D 格子でも穏やかな後流',
    velocity: 0.036,
    viscosity: 0.022,
    diameter: 18,
    stepsPerFrame: 1,
    spanwiseSeed: 0.0025,
    note: '3D にしても大きく崩れないケースです。XY と XZ / YZ の見え方を比較する基準に使います。',
  },
  {
    id: 'seeded-vortex-wake',
    label: '中 Re: seed 付き 3D 周期後流',
    velocity: 0.056,
    viscosity: 0.016,
    diameter: 18,
    stepsPerFrame: 1,
    spanwiseSeed: 0.0045,
    note: '交互渦放出に spanwise の揺らぎを重ねて、断面ごとの差が見えやすい設定です。',
  },
  {
    id: 'strong-3d-wake',
    label: '高 Re: 3D wake を強めに観察',
    velocity: 0.066,
    viscosity: 0.011,
    diameter: 20,
    stepsPerFrame: 2,
    spanwiseSeed: 0.0065,
    note: '小さな体積格子で見える範囲の上限寄りです。XY だけでなく XZ / YZ と volume view を合わせて見る設定です。',
  },
];

export const PRESETS = rawPresets.map((preset) => ({
  ...preset,
  reynolds: computeReynolds(preset),
}));

export function findPresetById(id) {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[1];
}
