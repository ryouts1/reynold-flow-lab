import { GRID_WIDTH, GRID_HEIGHT } from '../simulation/config.js';
import { LBMSolver } from '../simulation/lbmSolver.js';

let solver = null;
let currentRunId = 0;

function postFrame(runId) {
  if (!solver) {
    return;
  }

  const frame = solver.createFrame();
  self.postMessage({
    type: 'frame',
    runId,
    frame,
  });
}

self.onmessage = (event) => {
  const { type, params, runId, steps } = event.data;

  switch (type) {
    case 'init': {
      currentRunId = runId ?? 0;
      solver = new LBMSolver({
        width: GRID_WIDTH,
        height: GRID_HEIGHT,
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
      solver.reset(params ?? {});
      postFrame(currentRunId);
      break;
    }
    case 'tick': {
      if (!solver) {
        return;
      }
      solver.step(steps ?? 1);
      postFrame(currentRunId);
      break;
    }
    default:
      break;
  }
};
