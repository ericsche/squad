// Host-resolved SDK: do not install an npm dependency beside this extension.
import { joinSession } from '@github/copilot-sdk/extension';
import { createSpawnConfigHooks } from './spawn-config-hooks.mjs';

/** @type {import('@github/copilot-sdk').CopilotSession | undefined} */
let session;
try {
  session = await joinSession({ hooks: createSpawnConfigHooks(() => session) });
} catch (error) {
  console.error('[squad-spawn-config] Cannot join the current foreground session. ' +
    'Sub-sessions still launch; their configured model and reasoning effort apply only when the coordinator passes them.', error);
  throw error;
}

// Hooks only: no tools, timers or writes on load.
