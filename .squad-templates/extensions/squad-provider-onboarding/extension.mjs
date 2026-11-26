import { joinSession } from '@github/copilot-sdk/extension';
import { createM365OnboardingTools } from './onboarding-tools.mjs';

/** @type {import('@github/copilot-sdk').CopilotSession | undefined} */
let session;
try {
  session = await joinSession({ tools: createM365OnboardingTools(() => session) });
} catch (error) {
  console.error('[squad-provider-onboarding] Cannot join the host session. ' +
    'External provider support remains unverified; use the same-host guided prerequisite flow.', error);
  throw error;
}

// No startup hooks or installation on load. The host supplies the SDK.
