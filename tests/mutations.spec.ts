import { test, expect } from '@playwright/test';

test.describe('Playwright assertions to be mutated', () => {

  // --- Basic equality ---
  test('toBe', async () => {
    expect(3).toBe(3);
    expect(3).not.toBe(5);
  });

  // --- Truthiness ---
  test('truthiness', async () => {
    expect(true).toBeTruthy();
    expect(false).not.toBeTruthy();

    expect(false).toBeFalsy();
    expect(true).not.toBeFalsy();

    expect(null).toBeNull();
    expect(1).not.toBeNull();

    expect(undefined).toBeUndefined();
    expect(1).not.toBeUndefined();

    expect(NaN).toBeNaN();
    expect(1).not.toBeNaN();

    const value = 1;
    expect(value).toBeDefined();
    expect(undefined).not.toBeDefined();
  });

  // --- Numeric comparisons ---
  test('numeric comparisons', async () => {
    expect(5).toBeGreaterThan(3);
    expect(3).not.toBeGreaterThan(5);

    expect(3).toBeGreaterThanOrEqual(3);
    expect(2).not.toBeGreaterThanOrEqual(3);

    expect(2).toBeLessThan(5);
    expect(5).not.toBeLessThan(2);

    expect(5).toBeLessThanOrEqual(5);
    expect(6).not.toBeLessThanOrEqual(5);

    expect(0.1 + 0.2).toBeCloseTo(0.3, 5);
    expect(0.1 + 0.2).not.toBeCloseTo(0.4, 5);
  });

  // --- Equality ---
  test('equality', async () => {
    const obj = { a: 1 };

    expect(obj).toEqual({ a: 1 });
    expect(obj).not.toEqual({ a: 2 });

    expect(obj).toStrictEqual({ a: 1 });
    expect(obj).not.toStrictEqual({ a: 2 });
  });

  // --- Collections ---
  test('collections', async () => {
    const arr = [1, 2, 3];

    expect(arr).toContain(2);
    expect(arr).not.toContain(5);

    expect(arr).toHaveLength(3);
    expect(arr).not.toHaveLength(2);

    expect(arr).toEqual(expect.arrayContaining([1, 2]));
    expect(arr).not.toEqual(expect.arrayContaining([4]));

    expect(arr).toEqual(expect.arrayOf(expect.any(Number)));
    expect(arr).not.toEqual(expect.arrayOf(expect.any(String)));

    const obj = { a: 1, b: 2 };

    expect(obj).toHaveProperty('a');
    expect(obj).not.toHaveProperty('c');

    expect(obj).toMatchObject({ a: 1 });
    expect(obj).not.toMatchObject({ a: 2 });

    expect(obj).toEqual(expect.objectContaining({ a: 1 }));
    expect(obj).not.toEqual(expect.objectContaining({ a: 3 }));
  });

  // --- Strings ---
  test('strings', async () => {
    const text = 'hello world';

    expect(text).toContain('world');
    expect(text).not.toContain('bye');

    expect(text).toMatch(/hello/);
    expect(text).not.toMatch(/bye/);

    expect(text).toEqual(expect.stringContaining('hello'));
    expect(text).not.toEqual(expect.stringContaining('bye'));

    expect(text).toEqual(expect.stringMatching(/world/));
    expect(text).not.toEqual(expect.stringMatching(/bye/));
  });

  // --- Generic matchers ---
  test('generic matchers', async () => {
    class MyClass { }
    const instance = new MyClass();

    expect(instance).toEqual(expect.any(MyClass));
    expect(instance).not.toEqual(expect.any(Number));

    expect('text').toEqual(expect.anything());
    expect(null).not.toEqual(expect.anything());
  });

  // --- Exceptions ---
  test('exceptions', async () => {
    const thrower = () => { throw new Error('boom'); };
    const safe = () => 42;

    expect(thrower).toThrow();
    expect(safe).not.toThrow();

    expect(thrower).toThrow('boom');
    expect(thrower).not.toThrow('other');
  });

  // --- Async ---
  test('async', async () => {
    const resolves = Promise.resolve(42);
    const rejects = Promise.reject(new Error('fail'));

    await expect(resolves).resolves.toBe(42);
    await expect(resolves).resolves.not.toBe(0);

    await expect(rejects).rejects.toThrow('fail');
    await expect(rejects).rejects.not.toThrow('other');
  });

  // --- Playwright locators ---
  test('locator assertions', async ({ page }) => {
    await page.setContent(`
      <div id="visible">Hello</div>
      <div id="hidden" style="display:none">Hidden</div>
      <input id="input" value="text" />
      <button disabled>Click</button>
    `);

    const visible = page.locator('#visible');
    const hidden = page.locator('#hidden');
    const input = page.locator('#input');
    const button = page.locator('button');

    await expect(visible).toBeVisible();
    await expect(hidden).not.toBeVisible();

    await expect(visible).toHaveText('Hello');
    await expect(visible).not.toHaveText('Bye');

    await expect(input).toHaveValue('text');
    await expect(input).not.toHaveValue('other');

    await expect(button).toBeDisabled();
    await expect(button).not.toBeEnabled();
  });

});