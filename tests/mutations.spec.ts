import { test, expect } from '@playwright/test';

test('arithmetic equality', async () => {
  expect.soft(1).toBe(1);
  expect(3).toBe(3);
});

test('arithmetic non-equality', async () => {
  expect.soft(1).not.toBe(3);
  expect(3).not.toBe(5);
});
