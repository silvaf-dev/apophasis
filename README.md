# Apophasis

**A via negativa approach to mutation testing for Playwright E2E tests.**

Apophasis is a mutation testing library that inverts assertions *in memory* rather than mutating the application code. Instead of asking _“does the test fail when the code changes?”_, it asks:

> _“does the test fail when its own assertions are negated?”_

If a negated assertion **survives**, your test is not actually asserting what you think it is.

---

## ✨ Core Idea

Traditional mutation testing mutates the **system under test**.

Apophasis mutates the **test itself**, specifically:
- It **inverts assertions** (`.toBeVisible()` → `.not.toBeVisible()`)
- Runs the mutated test
- Detects **surviving mutations** (i.e., false negatives)

This is effectively a **negative-space validation** of your test suite.

### Why 'false negatives' and not 'false positives'?

In mutation testing, we intentionally introduce small changes (“mutations”) to the code to verify that our tests can detect them.

The core expectation is simple:

If a test passes, a mutation should cause it to fail.

When a mutation is applied and the test still passes, the test has failed to detect a behavioral change. In this context, this is treated as a *false negative*.

✅ Test fails after mutation → the mutation is killed (test is effective)

❌ Test still passes after mutation → false negative (test is insufficient)

This definition focuses on test sensitivity: a good test suite should fail whenever the underlying behavior changes in a meaningful way.

---

## 🧪 Try It! 

You can reproduce this on a clean project in under a minute.

1) Install Node.js (≥18)
2) Create folder
3) Install Playwright with `npm init playwright@latest` and accept all the default settings 
4) Install Apophasis with `npm i apophasis` 
5) Run apophasis with `npx apophasis`
6) Have fun seeing Playwright's own `example.spec.ts` having surviving mutants!

---

---

## 🎛️ CLI Usage (with Safe Arguments)

Apophasis includes a **hardened CLI parser**, allowing you to safely pass a controlled subset of Playwright arguments without exposing arbitrary command execution.

### ✅ Supported Playwright Arguments

```bash
npx apophasis --grep "login"
npx apophasis --headed
npx apophasis --workers 4
npx apophasis --timeout 10000
npx apophasis --retries 2
npx apophasis --project chromium
```

All arguments are strictly validated and allowlisted.

---

## ⚙️ Execution Modes

Apophasis supports multiple execution modes depending on your workflow:

### 🚀 Mutation Only (default)

```bash
npx apophasis
```

Runs mutation testing directly, without validating the baseline first.

⚠️ Faster, but results may be unreliable if your test suite is broken or flaky.

---

### 🧪 Baseline + Mutation

```bash
npx apophasis --baseline
```

- Runs the test suite without mutation  
- Ensures all tests pass  
- Proceeds to mutation testing only if baseline is clean  
- *Note*: The baseline phase uses the exact same arguments as the mutation run  

✅ Recommended for CI and reliable mutation results

---

### 🧪 Baseline Only

```bash
npx apophasis --baseline-only
```

- Runs only the baseline test suite and exits  

Useful for debugging, CI validation, or verifying test health independently of mutation.

---

## 🔒 Security Model

- Arguments are strictly parsed and validated  
- Unsupported flags will cause an immediate failure  
- No shell interpolation (`shell: false`)  
- Only explicitly allowlisted Playwright options are permitted  

---

## 🧠 Why "Apophasis"? 

In philosophy and theology, *apophasis* (via negativa) describes something by stating what it is not.

Here:
- A test is validated by showing what **it cannot deny**
- If a negated assertion still passes, the test is **empty of meaning**

---

## 🚨 Example: Playwright Default Test Failure

Given the default Playwright example:

```ts
import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  await expect(page).toHaveTitle(/Playwright/);
});

test('get started link', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  await page.getByRole('link', { name: 'Get started' }).click();
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
});
```

Apophasis mutates it to:
```ts
import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  // ...test logic
  await expect(page).not.toHaveTitle(/Playwright/);
});

test('get started link', async ({ page }) => {
  // ...test logic
  await expect(page.getByRole('heading', { name: 'Installation' })).not.toBeVisible();
});
```

### ❗ Result
The mutated `toBeVisible()` assertion survives.
This may mean:

- The assertion is not verifying visibility in a meaningful way
- The test passes even when the expectation is inverted

However, survival can also indicate a timing issue. The assertion may be running before the meaningful state change occurs. Both cases warrant investigation.

---

## 🔍 What This Reveals

Apophasis exposes:
- Weak or non-binding assertions  
- Timing issues (assertion runs before meaningful state change)  
- Implicit assumptions in E2E tests  
- False negatives in UI validation  

---

## ⚙️ How It Works

1. Intercept the Node.js module loader at startup
2. Patch expect in memory when Playwright is loaded
3. Invert all assertions dynamically (expect() → expect().not and vice versa)
4. Run Playwright once with APOPHASIS_MUTATE=true and once without
5. Compare: assertions that survive inversion are weak or non-binding

---

## 📊 Interpretation of Results

| Outcome            | Meaning                    |
|-------------------|----------------------------|
| Mutation killed   | Test is meaningful         |
| Mutation survived | Test is weak / ineffective |

---

## 🧪 Philosophy of Testing

Apophasis treats tests as **claims about reality**.

A valid test must:
- Fail when its claim is negated  
- Resist contradiction  

If it does not, it is not a test. It is decoration.

When **A** and **¬A** are simultaneously true, the assertion is **trivially true**, and therefore **semantically empty**.

In the context of testing:
- `expect(x).toBeVisible()` → A  
- `expect(x).not.toBeVisible()` → ¬A  

If both pass, then:
- The test does not constrain reality  
- The assertion does not distinguish between states  
- The test is **logically degenerate**

Apophasis treats such cases as a failure of meaning, not just implementation.

In epistemological terms, when both assertions are true, the test is not *[falsifiable](https://en.wikipedia.org/wiki/Falsifiability)*, i.e. it is incapable of being proven wrong.

A test that cannot fail is indistinguishable from a test that does not exist.

---

## 🚀 Use Cases

- Strengthening Playwright E2E suites  
- Detecting false negatives in UI/E2E tests  
- Auditing legacy test reliability  
- Enforcing assertion quality in CI  

---

## ⚠️ Limitations

- Not all assertions are safely invertible  
- Some survival cases may be due to legitimate non-determinism  
- Requires careful interpretation in async-heavy flows  
- Supports expect(), expect.soft(), and expect.poll(); other assertion patterns may behave unreliably

## 🧩 Closing Thought

Apophasis does not ask whether your code is correct.

It asks whether your tests are capable of being wrong.

If they are not, they are useless.