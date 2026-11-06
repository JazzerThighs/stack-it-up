// Reuse the real database / mock WebGL integration harness.
process.env.FAMILY_LOCK_ONLY='1';
await import('./explorer-smoke.mjs');
