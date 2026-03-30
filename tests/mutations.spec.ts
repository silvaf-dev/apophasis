import { test, expect } from '@playwright/test';

test.describe('Playwright assertions to be mutated', () => {

  // --- Basic equality ---
  test('toBe', async () => {
    expect.soft(3).toBe(3);
    expect.soft(3).not.toBe(5);
  });

  // --- Truthiness ---
  test('truthiness', async () => {
    expect.soft(true).toBeTruthy();
    expect.soft(false).not.toBeTruthy();

    expect.soft(false).toBeFalsy();
    expect.soft(true).not.toBeFalsy();

    expect.soft(null).toBeNull();
    expect.soft(1).not.toBeNull();

    expect.soft(undefined).toBeUndefined();
    expect.soft(1).not.toBeUndefined();

    expect.soft(NaN).toBeNaN();
    expect.soft(1).not.toBeNaN();

    const value = 1;
    expect.soft(value).toBeDefined();
    expect.soft(undefined).not.toBeDefined();
  });

  // --- Numeric comparisons ---
  test('numeric comparisons', async () => {
    expect.soft(5).toBeGreaterThan(3);
    expect.soft(3).not.toBeGreaterThan(5);

    expect.soft(3).toBeGreaterThanOrEqual(3);
    expect.soft(2).not.toBeGreaterThanOrEqual(3);

    expect.soft(2).toBeLessThan(5);
    expect.soft(5).not.toBeLessThan(2);

    expect.soft(5).toBeLessThanOrEqual(5);
    expect.soft(6).not.toBeLessThanOrEqual(5);

    expect.soft(0.1 + 0.2).toBeCloseTo(0.3, 5);
    expect.soft(0.1 + 0.2).not.toBeCloseTo(0.4, 5);
  });

  // --- Equality ---
  test('equality', async () => {
    const obj = { a: 1 };

    expect.soft(obj).toEqual({ a: 1 });
    expect.soft(obj).not.toEqual({ a: 2 });

    expect.soft(obj).toStrictEqual({ a: 1 });
    expect.soft(obj).not.toStrictEqual({ a: 2 });
  });

  // --- Collections ---
  test('collections', async () => {
    const arr = [1, 2, 3];

    expect.soft(arr).toContain(2);
    expect.soft(arr).not.toContain(5);

    expect.soft(arr).toHaveLength(3);
    expect.soft(arr).not.toHaveLength(2);

    expect.soft(arr).toEqual(expect.arrayContaining([1, 2]));
    expect.soft(arr).not.toEqual(expect.arrayContaining([4]));

    expect.soft(arr).toEqual(expect.soft(expect.any(Number)));
    expect.soft(arr).not.toEqual(expect.soft(expect.any(String)));

    const obj = { a: 1, b: 2 };

    expect.soft(obj).toHaveProperty('a');
    expect.soft(obj).not.toHaveProperty('c');

    expect.soft(obj).toMatchObject({ a: 1 });
    expect.soft(obj).not.toMatchObject({ a: 2 });

    expect.soft(obj).toEqual(expect.objectContaining({ a: 1 }));
    expect.soft(obj).not.toEqual(expect.objectContaining({ a: 3 }));
  });

  // --- Strings ---
  test('strings', async () => {
    const text = 'hello world';

    expect.soft(text).toContain('world');
    expect.soft(text).not.toContain('bye');

    expect.soft(text).toMatch(/hello/);
    expect.soft(text).not.toMatch(/bye/);

    expect.soft(text).toEqual(expect.stringContaining('hello'));
    expect.soft(text).not.toEqual(expect.stringContaining('bye'));

    expect.soft(text).toEqual(expect.stringMatching(/world/));
    expect.soft(text).not.toEqual(expect.stringMatching(/bye/));
  });

  // --- Generic matchers ---
  test('generic matchers', async () => {
    class MyClass { }
    const instance = new MyClass();

    expect.soft(instance).toEqual(expect.any(MyClass));
    expect.soft(instance).not.toEqual(expect.any(Number));

    expect.soft('text').toEqual(expect.anything());
    expect.soft(null).not.toEqual(expect.anything());
  });

  // --- Exceptions ---
  test('exceptions', async () => {
    const thrower = () => { throw new Error('boom'); };
    const safe = () => 42;

    expect.soft(thrower).toThrow();
    expect.soft(safe).not.toThrow();

    expect.soft(thrower).toThrow('boom');
    expect.soft(thrower).not.toThrow('other');
  });

  // --- Async ---
  test('async', async () => {
    const resolves = Promise.resolve(42);
    const rejects = Promise.reject(new Error('fail'));

    await expect.soft(resolves).resolves.toBe(42);
    await expect.soft(resolves).resolves.not.toBe(0);

    await expect.soft(rejects).rejects.toThrow('fail');
    await expect.soft(rejects).rejects.not.toThrow('other');
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

    await expect.soft(visible).toBeVisible();
    await expect.soft(hidden).not.toBeVisible();

    await expect.soft(visible).toHaveText('Hello');
    await expect.soft(visible).not.toHaveText('Bye');

    await expect.soft(input).toHaveValue('text');
    await expect.soft(input).not.toHaveValue('other');

    await expect.soft(button).toBeDisabled();
    await expect.soft(button).not.toBeEnabled();
  });

  test('toBeVisible and not.toBeVisible both pass', { tag: '@shouldSurvive' }, async ({ page }) => {
    await page.setContent(`
    <style>.hidden { display: none; }</style>
    <div id="container"></div>
    <script>
      const container = document.getElementById('container');
      let toggle = false;
      setInterval(() => {
        toggle = !toggle;
        container.innerHTML = toggle
          ? '<h1>Installation</h1>'
          : '<h1 class="hidden">Installation</h1>';
      }, 100);
    </script>
  `);

    const locator = page.getByRole('heading', { name: 'Installation' });

    // Wait until visible state is actually observed
    await expect.poll(async () => await locator.isVisible()).toBe(true);
    await expect.soft(locator).toBeVisible();

    // Wait until hidden state is actually observed
    await expect.poll(async () => await locator.isVisible()).toBe(false);
    await expect.soft(locator).not.toBeVisible();
  });

  test('toHaveText and not.toHaveText both pass', { tag: '@shouldSurvive' }, async ({ page }) => {
    await page.setContent(`
    <div id="container"></div>
    <script>
      const container = document.getElementById('container');
      let toggle = false;
      setInterval(() => {
        toggle = !toggle;
        container.innerHTML = toggle
          ? '<h1>Installation</h1>'
          : '<h1>Other</h1>';
      }, 100);
    </script>
  `);

    const locator = page.getByRole('heading');

    await expect.poll(async () => await locator.textContent()).toBe('Installation');
    await expect.soft(locator).toHaveText('Installation');

    await expect.poll(async () => await locator.textContent()).not.toBe('Installation');
    await expect.soft(locator).not.toHaveText('Installation');
  });

  test('toHaveAttribute and not.toHaveAttribute both pass', { tag: '@shouldSurvive' }, async ({ page }) => {
    await page.setContent(`
    <div id="container"></div>
    <script>
      const container = document.getElementById('container');
      let toggle = false;
      setInterval(() => {
        toggle = !toggle;
        container.innerHTML = toggle
          ? '<button data-state="active">Click</button>'
          : '<button data-state="inactive">Click</button>';
      }, 100);
    </script>
  `);

    const locator = page.getByRole('button', { name: 'Click' });

    await expect.poll(async () => await locator.getAttribute('data-state')).toBe('active');
    await expect.soft(locator).toHaveAttribute('data-state', 'active');

    await expect.poll(async () => await locator.getAttribute('data-state')).not.toBe('active');
    await expect.soft(locator).not.toHaveAttribute('data-state', 'active');
  });
});