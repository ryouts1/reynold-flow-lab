import {
  GRID_WIDTH,
  GRID_HEIGHT,
  GRID_DEPTH,
  VOLUME_MAX_POINTS,
} from '../simulation/config.js';
import { LBMSolver } from '../simulation/lbmSolver.js';

let solver = null;
let currentRunId = 0;
let currentView = {
  plane: 'xy',
  index: Math.floor(GRID_DEPTH / 2),
  maxPoints: VOLUME_MAX_POINTS,
};

function postFrame(runId) {
  if (!solver) {
    return;
  }

  const frame = solver.createFrame(currentView);
  const transferables = solver.createTransferables(frame);
  self.postMessage(
    {
      type: 'frame',
      runId,
      frame,
    },
    transferables,
  );
}

self.onmessage = (event) => {
  const {
    type,
    params,
    runId,
    steps,
    view,
  } = event.data;

  switch (type) {
    case 'init': {
      currentRunId = runId ?? 0;
      currentView = {
        ...currentView,
        ...view,
      };
      solver = new LBMSolver({
        width: GRID_WIDTH,
        height: GRID_HEIGHT,
        depth: GRID_DEPTH,
        ...params,
      });
      postFrame(currentRunId);
      break;
    }
    case 'reset': {
      if (!solver) {
        return;
      }
      currentRunId = runId ?? currentRunId;
      currentView = {
        ...currentView,
        ...view,
      };
      solver.reset(params ?? {});
      postFrame(currentRunId);
      break;
    }
    case 'tick': {
      if (!solver) {
        return;
      }
      currentView = {
        ...currentView,
        ...view,
      };
      solver.step(steps ?? 1);
      postFrame(currentRunId);
      break;
    }
    case 'setView': {
      if (!solver) {
        return;
      }
      currentView = {
        ...currentView,
        ...view,
      };
      postFrame(currentRunId);
      break;
    }
    default:
      break;
  }
};
