import {
  DEFAULT_PARAMS,
  DISPLAY_SCALE,
  MAX_HISTORY_POINTS,
  SLICE_PLANES,
} from './simulation/config.js';
import {
  computeReynolds,
  formatNumber,
  summarizeMetrics,
} from './simulation/diagnostics.js';
import { PRESETS, findPresetById } from './simulation/presets.js';
import { FieldRenderer } from './render/fieldRenderer.js';
import { ProbeChart } from './render/probeChart.js';
import { VolumeRenderer } from './render/volumeRenderer.js';
import { buildNoteHtml } from './ui/notes.js';

const elements = {
  presetSelect: document.querySelector('#presetSelect'),
  velocityRange: document.querySelector('#velocityRange'),
  viscosityRange: document.querySelector('#viscosityRange'),
  diameterRange: document.querySelector('#diameterRange'),
  spanwiseSeedRange: document.querySelector('#spanwiseSeedRange'),
  stepsRange: document.querySelector('#stepsRange'),
  sliceRange: document.querySelector('#sliceRange'),
  volumeYawRange: document.querySelector('#volumeYawRange'),
  velocityValue: document.querySelector('#velocityValue'),
  viscosityValue: document.querySelector('#viscosityValue'),
  diameterValue: document.querySelector('#diameterValue'),
  spanwiseSeedValue: document.querySelector('#spanwiseSeedValue'),
  stepsValue: document.querySelector('#stepsValue'),
  sliceValue: document.querySelector('#sliceValue'),
  sliceAxisLabel: document.querySelector('#sliceAxisLabel'),
  volumeYawValue: document.querySelector('#volumeYawValue'),
  streamlineToggle: document.querySelector('#streamlineToggle'),
  statusBadge: document.querySelector('#statusBadge'),
  reBadge: document.querySelector('#reBadge'),
  sliceSummary: document.querySelector('#sliceSummary'),
  iterationMetric: document.querySelector('#iterationMetric'),
  probeMetric: document.querySelector('#probeMetric'),
  probeSpanMetric: document.querySelector('#probeSpanMetric'),
  averageSpeedMetric: document.querySelector('#averageSpeedMetric'),
  maxSpeedMetric: document.querySelector('#maxSpeedMetric'),
  maxVorticityMetric: document.querySelector('#maxVorticityMetric'),
  maxSpanwiseMetric: document.querySelector('#maxSpanwiseMetric'),
  phenomenonNote: document.querySelector('#phenomenonNote'),
  fieldCanvas: document.querySelector('#fieldCanvas'),
  legendCanvas: document.querySelector('#legendCanvas'),
  volumeCanvas: document.querySelector('#volumeCanvas'),
  probeCanvas: document.querySelector('#probeCanvas'),
  playButton: document.querySelector('#playButton'),
  pauseButton: document.querySelector('#pauseButton'),
  stepButton: document.querySelector('#stepButton'),
  resetButton: document.querySelector('#resetButton'),
  snapshotButton: document.querySelector('#snapshotButton'),
};

const renderer = new FieldRenderer(elements.fieldCanvas, elements.legendCanvas, DISPLAY_SCALE);
const volumeRenderer = new VolumeRenderer(elements.volumeCanvas);
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
  slicePlane: 'xy',
  sliceIndex: SLICE_PLANES.xy.defaultIndex,
  volumeYaw: -24,
};

function getCurrentPresetNote() {
  return elements.presetSelect.value === 'custom'
    ? 'プリセットから離れた手動調整です。XY と XZ / YZ の断面差を見ながら、どこで 3D らしさが強くなるかを比較してください。'
    : findPresetById(elements.presetSelect.value).note;
}

function getViewPayload() {
  return {
    plane: state.slicePlane,
    index: state.sliceIndex,
  };
}

function populatePresetOptions() {
  elements.presetSelect.innerHTML = '';

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
  elements.spanwiseSeedRange.value = String(state.params.spanwiseSeed);
  elements.stepsRange.value = String(state.params.stepsPerFrame);
  elements.velocityValue.textContent = Number(state.params.velocity).toFixed(3);
  elements.viscosityValue.textContent = Number(state.params.viscosity).toFixed(3);
  elements.diameterValue.textContent = String(state.params.diameter);
  elements.spanwiseSeedValue.textContent = Number(state.params.spanwiseSeed).toFixed(4);
  elements.stepsValue.textContent = String(state.params.stepsPerFrame);
  elements.reBadge.textContent = `Re ${computeReynolds(state.params).toFixed(1)}`;
}

function updateSliceControlMeta(resetIndex = false) {
  const descriptor = SLICE_PLANES[state.slicePlane];
  const nextIndex = resetIndex
    ? descriptor.defaultIndex
    : Math.min(descriptor.maxIndex, Math.max(0, state.sliceIndex));

  state.sliceIndex = nextIndex;
  elements.sliceRange.min = '0';
  elements.sliceRange.max = String(descriptor.maxIndex);
  elements.sliceRange.value = String(nextIndex);
  elements.sliceAxisLabel.textContent = descriptor.fixedAxis;
  elements.sliceValue.textContent = String(nextIndex);
}

function syncViewControls() {
  document.querySelectorAll('input[name="slicePlane"]').forEach((radio) => {
    radio.checked = radio.value === state.slicePlane;
  });

  document.querySelectorAll('input[name="viewMode"]').forEach((radio) => {
    radio.checked = radio.value === state.viewMode;
  });

  elements.streamlineToggle.checked = state.showStreamlines;
  elements.volumeYawRange.value = String(state.volumeYaw);
  elements.volumeYawValue.textContent = `${state.volumeYaw}°`;
  updateSliceControlMeta(false);
}

function updateMetrics(frame) {
  const { metrics, slice } = frame;
  const summary = summarizeMetrics(metrics);

  elements.iterationMetric.textContent = String(metrics.iteration);
  elements.probeMetric.textContent = formatNumber(metrics.probeValue, 4);
  elements.probeSpanMetric.textContent = formatNumber(metrics.probeSpanwise, 4);
  elements.averageSpeedMetric.textContent = summary.averageSpeed;
  elements.maxSpeedMetric.textContent = summary.maxSpeed;
  elements.maxVorticityMetric.textContent = summary.maxAbsVorticity;
  elements.maxSpanwiseMetric.textContent = summary.maxSpanwiseSpeed;
  elements.reBadge.textContent = `Re ${formatNumber(metrics.reynolds, 1)}`;
  elements.sliceSummary.textContent = `${slice.plane.toUpperCase()} / ${slice.fixedAxis} = ${slice.index}`;
  elements.sliceAxisLabel.textContent = slice.fixedAxis;
  elements.sliceValue.textContent = String(slice.index);

  elements.phenomenonNote.innerHTML = buildNoteHtml(
    metrics,
    state.params,
    slice,
    getCurrentPresetNote(),
  );
}

function pushProbeValue(value) {
  state.history.push(value);
  if (state.history.length > MAX_HISTORY_POINTS) {
    state.history.shift();
  }
  probeChart.setData(state.history);
}

function renderFrame(frame) {
  renderer.render(frame, state);
  volumeRenderer.render(frame, state);
  updateMetrics(frame);
}

function requestFrame(steps = state.params.stepsPerFrame) {
  if (state.waitingFrame) {
    return;
  }

  state.waitingFrame = true;
  worker.postMessage({
    type: 'tick',
    steps,
    view: getViewPayload(),
  });
}

function requestViewRefresh() {
  worker.postMessage({
    type: 'setView',
    view: getViewPayload(),
  });
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
    view: getViewPayload(),
  });
}

function setParamsFromInputs() {
  state.params = {
    velocity: Number(elements.velocityRange.value),
    viscosity: Number(elements.viscosityRange.value),
    diameter: Number(elements.diameterRange.value),
    spanwiseSeed: Number(elements.spanwiseSeedRange.value),
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
    spanwiseSeed: preset.spanwiseSeed,
    stepsPerFrame: preset.stepsPerFrame,
  };
  syncControlsFromParams();
  resetSimulation();
}

function downloadSnapshot() {
  const gap = 18;
  const composite = document.createElement('canvas');
  composite.width = Math.max(elements.fieldCanvas.width, elements.volumeCanvas.width);
  composite.height = elements.fieldCanvas.height + elements.legendCanvas.height + elements.volumeCanvas.height + (gap * 2);
  const ctx = composite.getContext('2d');

  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, composite.width, composite.height);
  ctx.drawImage(elements.fieldCanvas, 0, 0);
  ctx.drawImage(elements.legendCanvas, 0, elements.fieldCanvas.height + 6);
  ctx.drawImage(elements.volumeCanvas, 0, elements.fieldCanvas.height + elements.legendCanvas.height + gap);

  const link = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.href = composite.toDataURL('image/png');
  link.download = `reynolds-flow-lab-3d-${stamp}.png`;
  link.click();
}

function wireEvents() {
  elements.presetSelect.addEventListener('change', (event) => {
    if (event.target.value === 'custom') {
      return;
    }
    applyPreset(event.target.value);
  });

  for (const slider of [
    elements.velocityRange,
    elements.viscosityRange,
    elements.diameterRange,
    elements.spanwiseSeedRange,
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
        renderFrame(state.frame);
      }
    });
  });

  document.querySelectorAll('input[name="slicePlane"]').forEach((radio) => {
    radio.addEventListener('change', (event) => {
      state.slicePlane = event.target.value;
      updateSliceControlMeta(true);
      requestViewRefresh();
    });
  });

  elements.sliceRange.addEventListener('input', () => {
    state.sliceIndex = Number(elements.sliceRange.value);
    elements.sliceValue.textContent = String(state.sliceIndex);
    requestViewRefresh();
  });

  elements.streamlineToggle.addEventListener('change', () => {
    state.showStreamlines = elements.streamlineToggle.checked;
    if (state.frame) {
      renderFrame(state.frame);
    }
  });

  elements.volumeYawRange.addEventListener('input', () => {
    state.volumeYaw = Number(elements.volumeYawRange.value);
    elements.volumeYawValue.textContent = `${state.volumeYaw}°`;
    if (state.frame) {
      volumeRenderer.render(state.frame, state);
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
  renderFrame(frame);
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
    spanwiseSeed: initialPreset.spanwiseSeed,
  };
  state.slicePlane = 'xy';
  state.sliceIndex = SLICE_PLANES.xy.defaultIndex;

  wireEvents();
  syncControlsFromParams();
  syncViewControls();
  probeChart.setData([]);
  elements.statusBadge.textContent = '停止中';
  elements.sliceSummary.textContent = `${state.slicePlane.toUpperCase()} / ${SLICE_PLANES[state.slicePlane].fixedAxis} = ${state.sliceIndex}`;
  elements.phenomenonNote.innerHTML = buildNoteHtml(
    {
      reynolds: computeReynolds(state.params),
      maxSpanwiseSpeed: state.params.spanwiseSeed,
    },
    state.params,
    {
      plane: state.slicePlane,
      fixedAxis: SLICE_PLANES[state.slicePlane].fixedAxis,
      index: state.sliceIndex,
    },
    initialPreset.note,
  );

  worker.postMessage({
    type: 'init',
    runId: state.runId,
    params: { ...state.params },
    view: getViewPayload(),
  });
}

initialize();
