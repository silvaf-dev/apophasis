import { test, expect } from '@playwright/test';

test.describe('Playwright assertions to be mutated', () => {
  test.describe('Multiple soft assertions', () => {
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

  test.describe('Single hard assertions', () => {
    // --- Basic equality ---
    test('positive: 1 is 1', async () => {
      expect(1).toBe(1);
    });

    test('negative: 2 is not 3', async () => {
      expect(2).not.toBe(3);
    });

    test('toBe: value is 3', async () => {
      expect(3).toBe(3);
    });

    test('toBe: value is not 5', async () => {
      expect(3).not.toBe(5);
    });

    // --- Truthiness ---
    test('truthiness: true is truthy', async () => {
      expect(true).toBeTruthy();
    });

    test('truthiness: false is not truthy', async () => {
      expect(false).not.toBeTruthy();
    });

    test('truthiness: false is falsy', async () => {
      expect(false).toBeFalsy();
    });

    test('truthiness: true is not falsy', async () => {
      expect(true).not.toBeFalsy();
    });

    test('truthiness: null is null', async () => {
      expect(null).toBeNull();
    });

    test('truthiness: 1 is not null', async () => {
      expect(1).not.toBeNull();
    });

    test('truthiness: undefined is undefined', async () => {
      expect(undefined).toBeUndefined();
    });

    test('truthiness: 1 is not undefined', async () => {
      expect(1).not.toBeUndefined();
    });

    test('truthiness: NaN is NaN', async () => {
      expect(NaN).toBeNaN();
    });

    test('truthiness: 1 is not NaN', async () => {
      expect(1).not.toBeNaN();
    });

    test('truthiness: value is defined', async () => {
      expect(1).toBeDefined();
    });

    test('truthiness: undefined is not defined', async () => {
      expect(undefined).not.toBeDefined();
    });

    // --- Numeric comparisons ---
    test('numeric: 5 > 3', async () => {
      expect(5).toBeGreaterThan(3);
    });

    test('numeric: 3 is not > 5', async () => {
      expect(3).not.toBeGreaterThan(5);
    });

    test('numeric: 3 >= 3', async () => {
      expect(3).toBeGreaterThanOrEqual(3);
    });

    test('numeric: 2 is not >= 3', async () => {
      expect(2).not.toBeGreaterThanOrEqual(3);
    });

    test('numeric: 2 < 5', async () => {
      expect(2).toBeLessThan(5);
    });

    test('numeric: 5 is not < 2', async () => {
      expect(5).not.toBeLessThan(2);
    });

    test('numeric: 5 <= 5', async () => {
      expect(5).toBeLessThanOrEqual(5);
    });

    test('numeric: 6 is not <= 5', async () => {
      expect(6).not.toBeLessThanOrEqual(5);
    });

    test('numeric: 0.1 + 0.2 is close to 0.3', async () => {
      expect(0.1 + 0.2).toBeCloseTo(0.3, 5);
    });

    test('numeric: 0.1 + 0.2 is not close to 0.4', async () => {
      expect(0.1 + 0.2).not.toBeCloseTo(0.4, 5);
    });

    // --- Equality ---
    test('equality: deep equality', async () => {
      expect({ a: 1 }).toEqual({ a: 1 });
    });

    test('equality: not deep equality', async () => {
      expect({ a: 1 }).not.toEqual({ a: 2 });
    });

    test('equality: strict equality', async () => {
      expect({ a: 1 }).toStrictEqual({ a: 1 });
    });

    test('equality: not strict equality', async () => {
      expect({ a: 1 }).not.toStrictEqual({ a: 2 });
    });

    // --- Collections ---
    test('collections: array contains 2', async () => {
      expect([1, 2, 3]).toContain(2);
    });

    test('collections: array does not contain 5', async () => {
      expect([1, 2, 3]).not.toContain(5);
    });

    test('collections: array length is 3', async () => {
      expect([1, 2, 3]).toHaveLength(3);
    });

    test('collections: array length is not 2', async () => {
      expect([1, 2, 3]).not.toHaveLength(2);
    });

    test('collections: array containing subset', async () => {
      expect([1, 2, 3]).toEqual(expect.arrayContaining([1, 2]));
    });

    test('collections: object has property', async () => {
      expect({ a: 1, b: 2 }).toHaveProperty('a');
    });

    test('collections: object matches subset', async () => {
      expect({ a: 1, b: 2 }).toMatchObject({ a: 1 });
    });

    // --- Strings ---
    test('strings: contains substring', async () => {
      expect('hello world').toContain('world');
    });

    test('strings: regex match', async () => {
      expect('hello world').toMatch(/hello/);
    });

    // --- Exceptions ---
    test('exceptions: function throws', async () => {
      const thrower = () => { throw new Error('boom'); };
      expect(thrower).toThrow();
    });

    test('exceptions: function does not throw', async () => {
      const safe = () => 42;
      expect(safe).not.toThrow();
    });

    // --- Async ---
    test('async: promise resolves to 42', async () => {
      await expect(Promise.resolve(42)).resolves.toBe(42);
    });

    test('async: promise rejects with error', async () => {
      await expect(Promise.reject(new Error('fail'))).rejects.toThrow('fail');
    });

    // --- Playwright locators ---
    test('locator: element is visible', async ({ page }) => {
      await page.setContent('<div id="visible">Hello</div>');
      await expect(page.locator('#visible')).toBeVisible();
    });

    test('locator: element is hidden', async ({ page }) => {
      await page.setContent('<div id="hidden" style="display:none">Hidden</div>');
      await expect(page.locator('#hidden')).not.toBeVisible();
    });

    test('locator: has text content', async ({ page }) => {
      await page.setContent('<div id="visible">Hello</div>');
      await expect(page.locator('#visible')).toHaveText('Hello');
    });

    test('locator: input has value', async ({ page }) => {
      await page.setContent('<input id="input" value="text" />');
      await expect(page.locator('#input')).toHaveValue('text');
    });

    test('locator: button is disabled', async ({ page }) => {
      await page.setContent('<button disabled>Click</button>');
      await expect(page.locator('button')).toBeDisabled();
    });

    // --- Poll / Dynamic Survivals ---
    test('dynamic: observe visibility', { tag: '@shouldSurvive' }, async ({ page }) => {
      await page.setContent(`
      <div id="container"></div>
      <script>
        setInterval(() => {
          document.getElementById('container').innerHTML = '<h1>Installation</h1>';
        }, 100);
      </script>
    `);
      const locator = page.getByRole('heading', { name: 'Installation' });
      await expect(locator).toBeVisible();
    });

    test('dynamic: observe hidden state', { tag: '@shouldSurvive' }, async ({ page }) => {
      await page.setContent(`
      <div id="container"><h1>Installation</h1></div>
      <script>
        setInterval(() => {
          document.getElementById('container').innerHTML = '';
        }, 100);
      </script>
    `);
      const locator = page.getByRole('heading', { name: 'Installation' });
      await expect(locator).not.toBeVisible();
    });
  })
});