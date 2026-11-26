// Host-resolved SDK: do not install an npm dependency beside this extension.
import { joinSession } from '@github/copilot-sdk/extension';
import { createSecurityFramingHooks } from './framing-hooks.mjs';

/** @type {import('@github/copilot-sdk').CopilotSession | undefined} */
let session;
try {
  session = await joinSession({ hooks: createSecurityFramingHooks(() => session) });
} catch (error) {
  console.error('[squad-security-framing] Cannot join the current foreground session. ' +
    'Native security reviews still run unchanged; reload the extension to restore their App framing.', error);
  throw error;
}

// Hooks only: no tools, timers, plan/SQL writes or sessions on load.
