// Smoke test to verify Vitest runs. Add real unit tests per docs/UNIT_TESTING_PLAN.md.
// Uses globals (describe, it, expect) via vitest.config.js globals: true.

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
