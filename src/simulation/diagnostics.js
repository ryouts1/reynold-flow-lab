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

export function classifyRegime(reynolds) {
  if (reynolds < 40) {
    return {
      title: '定常に近い後流',
      summary:
        '低い Reynolds 数では、後流はおおむね対称のまま落ち着きます。円柱の後ろに小さな再循環域が見えても、交互渦放出はまだ強く出ません。',
      caution: '2D 簡略モデルなので、境界条件の影響で完全な対称場にならない場合があります。',
    };
  }

  if (reynolds < 180) {
    return {
      title: '周期的な渦放出が見えやすい領域',
      summary:
        'この領域では、円柱後流に交互の渦が並ぶ Kármán 渦列が観察しやすくなります。プローブ信号もほぼ周期的に振動します。',
      caution: '見た目は乱れていても、ここで観察しているのは 2D の周期後流です。3D 乱流そのものを直接解いているわけではありません。',
    };
  }

  return {
    title: '3D 遷移閾値の手前を眺める領域',
    summary:
      'Re がさらに上がると、実際の円柱後流は 3D 不安定化に近づきます。このプロジェクトでは、その手前の 2D wake がどう見えるかを定性的に確認します。',
    caution:
      'このモデルは 2D D2Q9 LBM です。三次元の mode A / mode B や fully developed turbulence の再現は対象外です。',
  };
}

export function summarizeMetrics(metrics) {
  return {
    averageSpeed: formatNumber(metrics.averageSpeed, 4),
    maxSpeed: formatNumber(metrics.maxSpeed, 4),
    maxAbsVorticity: formatNumber(metrics.maxAbsVorticity, 4),
  };
}
