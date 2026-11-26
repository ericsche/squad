// Host-resolved SDK: do not install an npm dependency beside this extension.
import { joinSession } from '@github/copilot-sdk/extension';
import { createSessionPlanTools } from './plan-tools.mjs';

let session;
try {
  session = await joinSession({
    tools: createSessionPlanTools(() => session),
  });
} catch (error) {
  // stdout belongs to JSON-RPC. Startup failures must remain visible in the
  // extension log even when no joined session exists to receive session.log().
  console.error('[squad-session-plan] Cannot join the current foreground session. ' +
    'Check host extension support, reload the extension, or show the plan in chat.', error);
  throw error;
}

// No start/resume hooks, timers, SQL synchronization, mode changes, or writes.
// Reloading only re-registers tools; the next explicit read observes host state.
