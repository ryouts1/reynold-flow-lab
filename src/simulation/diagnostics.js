export function computeReynolds({ velocity, viscosity, diameter }) {
  if (!viscosity) {
    return 0;
  }

  return (velocity * diameter) / viscosity;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

export function classifyRegime(reynolds, maxSpanwiseSpeed) {
  if (reynolds < 40) {
    return {
      title: '3D 格子でも後流はまだ穏やか',
      summary:
        '低めの Reynolds 数では、3D ソルバーにしても後流は大きく崩れません。XY 断面で円柱後流の基本形を確認し、XZ / YZ 断面で spanwise 方向の変化が弱いことを比較できます。',
      caution:
        'ここで見える spanwise 成分は小さく、3D らしさは限定的です。まずは断面の違いを掴むための基準ケースとして使うのが向いています。',
    };
  }

  if (reynolds < 90) {
    return {
      title: '周期後流に 3D の揺らぎが乗りやすい領域',
      summary:
        '交互渦放出が見えやすい条件に、spanwise seed を加えています。XY 断面では交互渦を、XZ / YZ 断面では z 方向に揺らぐ wake の形を追いやすくなります。',
      caution:
        'ここで見ている 3D 構造は、低解像度の教育用モデルで可視化しやすいように seed を入れて強調しています。定量評価より、断面差の理解を優先してください。',
    };
  }

  return {
    title: '3D wake を眺めやすい高めの設定',
    summary:
      'Reynolds 数を上げると、XZ / YZ 断面と volume preview で spanwise 方向の揺らぎが見えやすくなります。XY 断面だけでは分からない z 方向の厚みを確認するのに向いた領域です。',
    caution:
      maxSpanwiseSpeed < 1e-4
        ? '数値的にまだほぼ 2D に近い状態です。step を進めるか、spanwise seed を少し上げると 3D 構造が見えやすくなります。'
        : 'D3Q19 の小さな体積格子で動かす compact solver です。実務 CFD のような格子独立性や wake frequency の厳密評価は対象外です。',
  };
}

export function summarizeMetrics(metrics) {
  return {
    averageSpeed: formatNumber(metrics.averageSpeed, 4),
    maxSpeed: formatNumber(metrics.maxSpeed, 4),
    maxAbsVorticity: formatNumber(metrics.maxAbsVorticity, 4),
    maxSpanwiseSpeed: formatNumber(metrics.maxSpanwiseSpeed, 4),
  };
}
