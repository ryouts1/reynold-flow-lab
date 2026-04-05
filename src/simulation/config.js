export const GRID_WIDTH = 96;
export const GRID_HEIGHT = 56;
export const GRID_DEPTH = 28;
export const DISPLAY_SCALE = 5;
export const MAX_HISTORY_POINTS = 260;
export const VOLUME_MAX_POINTS = 1600;

export const DEFAULT_PARAMS = {
  velocity: 0.056,
  viscosity: 0.016,
  diameter: 18,
  stepsPerFrame: 1,
  spanwiseSeed: 0.0045,
};

export const CYLINDER_X_RATIO = 0.24;
export const PROBE_OFFSET = 12;

export const SLICE_PLANES = {
  xy: {
    label: 'XY 断面',
    fixedAxis: 'z',
    maxIndex: GRID_DEPTH - 1,
    defaultIndex: Math.floor(GRID_DEPTH / 2),
  },
  xz: {
    label: 'XZ 断面',
    fixedAxis: 'y',
    maxIndex: GRID_HEIGHT - 1,
    defaultIndex: Math.floor(GRID_HEIGHT / 2),
  },
  yz: {
    label: 'YZ 断面',
    fixedAxis: 'x',
    maxIndex: GRID_WIDTH - 1,
    defaultIndex: Math.floor(GRID_WIDTH / 2),
  },
};
