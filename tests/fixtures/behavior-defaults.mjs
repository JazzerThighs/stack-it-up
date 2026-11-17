import fs from 'node:fs';
import {startupDefaults} from '../../web/ui/startup-defaults.js';

// Explicit inputs for repeatable behavior scenarios, NOT product requirements.
// Import before application modules so their stores capture these test inputs.
// Startup/default/reset contract tests deliberately do not import this fixture.
export const behaviorDefaults=JSON.parse(fs.readFileSync(new URL('./behavior-defaults.json',import.meta.url),'utf8'));
export function applyBehaviorDefaults(defaults) {
  for(const [group,value] of Object.entries(behaviorDefaults)) {
    if(Array.isArray(value))defaults[group]=structuredClone(value);
    else Object.assign(defaults[group],structuredClone(value));
  }
}
applyBehaviorDefaults(startupDefaults);

// Built apps have a separate module instance (including versioned explorer assets).
export async function configureBuiltDefaults(assetRoot) {
  const {startupDefaults}=await import(new URL('ui/startup-defaults.js',assetRoot));
  applyBehaviorDefaults(startupDefaults);
}
