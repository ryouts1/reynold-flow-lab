import {
  DEFAULT_PARAMS,
  DISPLAY_SCALE,
  MAX_HISTORY_POINTS,
} from './simulation/config.js';
import {
  computeReynolds,
  formatNumber,
  summarizeMetrics,
} from './simulation/diagnostics.js';
import { PRESETS, findPresetById } from './simulation/presets.js';
import { FieldRenderer } from './render/fieldRenderer.js';
import { ProbeChart } from './render/probeChart.js';
import { buildNoteHtml } from './ui/notes.js';

const elements = {
  presetSelect: document.querySelector('#presetSelect'),
  velocityRange: document.querySelector('#velocityRange'),
  viscosityRange: document.querySelector('#viscosityRange'),
  diameterRange: document.querySelector('#diameterRange'),
  stepsRange: document.querySelector('#stepsRange'),
  velocityValue: document.querySelector('#velocityValue'),
  viscosityValue: document.querySelector('#viscosityValue'),
  diameterValue: document.querySelector('#diameterValue'),
  stepsValue: document.querySelector('#stepsValue'),
  streamlineToggle: document.querySelector('#streamlineToggle'),
  statusBadge: document.querySelector('#statusBadge'),
  reBadge: document.querySelector('#reBadge'),
  iterationMetric: document.querySelector('#iterationMetric'),
  probeMetric: document.querySelector('#probeMetric'),
  averageSpeedMetric: document.querySelector('#averageSpeedMetric'),
  maxSpeedMetric: document.querySelector('#maxSpeedMetric'),
  maxVorticityMetric: document.querySelector('#maxVorticityMetric'),
  phenomenonNote: document.querySelector('#phenomenonNote'),
  fieldCanvas: document.querySelector('#fieldCanvas'),
  legendCanvas: document.querySelector('#legendCanvas'),
  probeCanvas: document.querySelector('#probeCanvas'),
  playButton: document.querySelector('#playButton'),
  pauseButton: document.querySelector('#pauseButton'),
  stepButton: document.querySelector('#stepButton'),
  resetButton: document.querySelector('#resetButton'),
  snapshotButton: document.querySelector('#snapshotButton'),
};

const renderer = new FieldRenderer(elements.fieldCanvas, elements.legendCanvas, DISPLAY_SCALE);
const probeChart = new ProbeChart(elements.probeCanvas);
const worker = new Worker(new URL('./workers/simulationWorker.js', import.meta.url), { type: 'module' });

const state = {
  params: { ...DEFAULT_PARAMS },
  viewMode: 'vorticity',
  showStreamlines: true,
  playing: false,
  waitingFrame: false,
  runId: 1,
  history: [],
  frame: null,
};

function populatePresetOptions() {
  for (const preset of PRESETS) {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = `${preset.label} (Re ≈ ${preset.reynolds.toFixed(1)})`;
    elements.presetSelect.append(option);
  }

  const customOption = document.createElement('option');
  customOption.value = 'custom';
  customOption.textContent = '手動調整';
  elements.presetSelect.append(customOption);
}

function syncControlsFromParams() {
  elements.velocityRange.value = String(state.params.velocity);
  elements.viscosityRange.value = String(state.params.viscosity);
  elements.diameterRange.value = String(state.params.diameter);
  elements.stepsRange.value = String(state.params.stepsPerFrame);
  elements.velocityValue.textContent = Number(state.params.velocity).toFixed(3);
  elements.viscosityValue.textContent = Number(state.params.viscosity).toFixed(3);
  elements.diameterValue.textContent = String(state.params.diameter);
  elements.stepsValue.textContent = String(state.params.stepsPerFrame);
  elements.reBadge.textContent = `Re ${computeReynolds(state.params).toFixed(1)}`;
}

function updateMetrics(frame) {
  const { metrics } = frame;
  const summary = summarizeMetrics(metrics);

  elements.iterationMetric.textContent = String(metrics.iteration);
  elements.probeMetric.textContent = formatNumber(metrics.probeValue, 4);
  elements.averageSpeedMetric.textContent = summary.averageSpeed;
  elements.maxSpeedMetric.textContent = summary.maxSpeed;
  elements.maxVorticityMetric.textContent = summary.maxAbsVorticity;
  elements.reBadge.textContent = `Re ${formatNumber(metrics.reynolds, 1)}`;

  const presetNote = elements.presetSelect.value === 'custom'
    ? 'プリセットから離れた手動調整です。Re と後流の形の対応を比較しながら調整してください。'
    : findPresetById(elements.presetSelect.value).note;
  elements.phenomenonNote.innerHTML = buildNoteHtml(metrics, presetNote);
}

function pushProbeValue(value) {
  state.history.push(value);
  if (state.history.length > MAX_HISTORY_POINTS) {
    state.history.shift();
  }
  probeChart.setData(state.history);
}

function requestFrame(steps = state.params.stepsPerFrame) {
  if (state.waitingFrame) {
    return;
  }
  state.waitingFrame = true;
  worker.postMessage({ type: 'tick', steps });
}

function startPlayback() {
  if (state.playing) {
    return;
  }
  state.playing = true;
  elements.statusBadge.textContent = '再生中';
  requestFrame();
}

function stopPlayback() {
  state.playing = false;
  elements.statusBadge.textContent = '停止中';
}

function resetSimulation() {
  state.runId += 1;
  state.waitingFrame = false;
  state.history = [];
  probeChart.setData([]);
  worker.postMessage({
    type: 'reset',
    runId: state.runId,
    params: { ...state.params },
  });
}

function setParamsFromInputs() {
  state.params = {
    velocity: Number(elements.velocityRange.value),
    viscosity: Number(elements.viscosityRange.value),
    diameter: Number(elements.diameterRange.value),
    stepsPerFrame: Number(elements.stepsRange.value),
  };
  syncControlsFromParams();
}

function applyPreset(presetId) {
  const preset = findPresetById(presetId);
  state.params = {
    velocity: preset.velocity,
    viscosity: preset.viscosity,
    diameter: preset.diameter,
    stepsPerFrame: preset.stepsPerFrame,
  };
  syncControlsFromParams();
  resetSimulation();
}

function downloadSnapshot() {
  const link = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.href = elements.fieldCanvas.toDataURL('image/png');
  link.download = `reynolds-flow-lab-${stamp}.png`;
  link.click();
}

function wireEvents() {
  elements.presetSelect.addEventListener('change', (event) => {
    applyPreset(event.target.value);
  });

  for (const slider of [
    elements.velocityRange,
    elements.viscosityRange,
    elements.diameterRange,
    elements.stepsRange,
  ]) {
    slider.addEventListener('input', () => {
      elements.presetSelect.value = 'custom';
      setParamsFromInputs();
      resetSimulation();
    });
  }

  document.querySelectorAll('input[name="viewMode"]').forEach((radio) => {
    radio.addEventListener('change', (event) => {
      state.viewMode = event.target.value;
      if (state.frame) {
        renderer.render(state.frame, state);
      }
    });
  });

  elements.streamlineToggle.addEventListener('change', () => {
    state.showStreamlines = elements.streamlineToggle.checked;
    if (state.frame) {
      renderer.render(state.frame, state);
    }
  });

  elements.playButton.addEventListener('click', startPlayback);
  elements.pauseButton.addEventListener('click', stopPlayback);
  elements.stepButton.addEventListener('click', () => {
    stopPlayback();
    requestFrame(1);
  });
  elements.resetButton.addEventListener('click', resetSimulation);
  elements.snapshotButton.addEventListener('click', downloadSnapshot);
}

worker.addEventListener('message', (event) => {
  const { runId, frame } = event.data;

  if (runId !== state.runId) {
    return;
  }

  state.waitingFrame = false;
  state.frame = frame;
  renderer.render(frame, state);
  updateMetrics(frame);
  pushProbeValue(frame.metrics.probeValue);

  if (state.playing) {
    requestAnimationFrame(() => requestFrame());
  }
});

function initialize() {
  populatePresetOptions();

  const initialPreset = PRESETS[1];
  elements.presetSelect.value = initialPreset.id;
  state.params = {
    velocity: initialPreset.velocity,
    viscosity: initialPreset.viscosity,
    diameter: initialPreset.diameter,
    stepsPerFrame: initialPreset.stepsPerFrame,
  };

  wireEvents();
  syncControlsFromParams();
  probeChart.setData([]);
  elements.statusBadge.textContent = '停止中';
  elements.phenomenonNote.innerHTML = buildNoteHtml(
    { reynolds: computeReynolds(state.params) },
    initialPreset.note,
  );

  worker.postMessage({
    type: 'init',
    runId: state.runId,
    params: { ...state.params },
  });
}

initialize();
