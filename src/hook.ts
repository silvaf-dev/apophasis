import * as ModuleNamespace from 'module';

/**
 * APOPHASIS MUTATOR
 * A metatesting utility for Playwright that inverts assertions in-memory.
 * Rule:
 * 1. From .not, to no .not
 * 2. From no .not, to .not
 */

const Module = (ModuleNamespace as any)?.default || ModuleNamespace;
const originalLoad = typeof Module._load === 'function' ? Module._load : null;

if (!originalLoad) {
  throw new Error('Apophasis: Module._load is not available');
}

Module._load = function (request: string, parent: any, isMain: boolean) {
  const exports = originalLoad.apply(this, [request, parent, isMain]);

  // 1. Environment Guard
  const shouldMutate = process.env.APOPHASIS_MUTATE === 'true';
  if (!shouldMutate || typeof request !== 'string') {
    return exports;
  }

  // 2. Targeted Injection
  if (request === '@playwright/test' || request.indexOf('playwright/lib/test') !== -1) {
    if (exports?.expect && !exports.expect._isApophasisMutated) {

      /**
       * Creates a proxy around the matchers object.
       * @param actualMatchers - The base matchers object.
       * @param userWantsNot - State tracking if the user has already invoked .not
       *
       * KEY FIX: Never use .bind() — it permanently locks `this` at bind-time.
       * Instead, wrap in a function and use .apply() at call-time so each
       * individual soft-asserter instance keeps its own internal context,
       * which is how Playwright registers soft failures correctly.
       */
      const createMatchersProxy = (actualMatchers: any, userWantsNot = false): any => {
        if (!actualMatchers || typeof actualMatchers !== 'object') {
          return actualMatchers;
        }

        return new Proxy(actualMatchers, {
          get(target, prop, receiver) {
            // Bypass internal symbols and housekeeping
            if (
              typeof prop !== 'string' ||
              ['then', 'catch', 'finally', 'constructor', 'toJSON', 'asymmetricMatch', '$$typeof'].includes(prop)
            ) {
              return Reflect.get(target, prop, receiver);
            }

            // Handle Promise unwrapping for .resolves and .rejects
            if (prop === 'resolves' || prop === 'rejects') {
              const promiseMatchers = Reflect.get(target, prop, receiver);
              return createMatchersProxy(promiseMatchers, userWantsNot);
            }

            // THE TOGGLE
            if (prop === 'not') {
              // Flip the boolean: if user hit .not, we now flag to return the positive version
              return createMatchersProxy(target, !userWantsNot);
            }

            const originalMatcher = Reflect.get(target, prop, receiver);
            if (typeof originalMatcher !== 'function') return originalMatcher;

            /**
             * THE INVERSION LOGIC
             *
             * Use .apply(ctx, args) inside a wrapper function instead of .bind(ctx).
             * .bind() creates a new permanently-bound function at bind-time, which
             * breaks soft asserters because each expect.soft() call produces its own
             * asserter instance that must remain `this` when the matcher runs.
             * Wrapping with apply() defers the binding to call-time, preserving the
             * correct instance for every individual soft assertion in the chain.
             */
            if (userWantsNot) {
              // RULE: From .not, to no .not
              // User called expect(x).not.toBe(y) -> We call positive toBe(y)
              // `target` here IS the soft-asserter instance (not the .not subset),
              // so applying to it registers the failure on the right asserter.
              return function (this: any, ...args: any[]) {
                return originalMatcher.apply(target, args);
              };
            } else {
              // RULE: From no .not, to .not
              // User called expect(x).toBe(y) -> We call negated not.toBe(y)
              const negatedSet = target.not;
              if (negatedSet) {
                const negatedMatcher = Reflect.get(negatedSet, prop);
                if (typeof negatedMatcher === 'function') {
                  // Apply to `negatedSet` (the .not object) so the negated matcher
                  // runs in the correct context and still reports to the right
                  // soft-asserter instance.
                  return function (this: any, ...args: any[]) {
                    return negatedMatcher.apply(negatedSet, args);
                  };
                }
              }
            }

            return originalMatcher;
          }
        });
      };

      /**
       * The Main Expect Proxy
       */
      const proxyExpect = new Proxy(exports.expect, {
        apply(target, thisArg, args) {
          const matchers = Reflect.apply(target, target, args);
          return createMatchersProxy(matchers, false);
        },
        get(target, prop, receiver) {
          if (prop === '_isApophasisMutated') return true;

          const value = Reflect.get(target, prop, receiver);

          if (typeof value === 'function' && (prop === 'soft' || prop === 'poll')) {
            // Call soft/poll with `target` (the original expect) as `this`.
            // Each call produces a fresh soft-asserter instance; wrapping in
            // createMatchersProxy then lets the inversion logic redirect to the
            // correct positive/negated matcher on that specific instance.
            return (...args: any[]) => {
              const matchers = value.apply(target, args);
              return createMatchersProxy(matchers, false);
            };
          }

          return value;
        }
      });

      // Replace the export
      try {
        Object.defineProperty(exports, 'expect', {
          value: proxyExpect,
          configurable: true,
          enumerable: true,
          writable: true
        });
      } catch (e) {
        try { exports.expect = proxyExpect; } catch (inner) {}
      }
    }
  }

  return exports;
};