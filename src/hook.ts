import * as ModuleNamespace from 'module';

/**
 * APOPHASIS MUTATOR
 * A metatesting utility for Playwright that inverts assertions in-memory.
 * 1. Robustness: Preventing infinite recursion in Proxies.
 * 2. Precision: Ensuring internal symbols and non-string props are bypassed.
 * 3. Scope: Only targeting the user-facing 'expect' API.
 */

const Module = (ModuleNamespace as any)?.default || ModuleNamespace;
const originalLoad = typeof Module._load === 'function' ? Module._load : null;

if (!originalLoad) {
  throw new Error('Apophasis: Module._load is not available');
}

// Track proxies to prevent double-wrapping
const proxyMap = new WeakSet();

Module._load = function (request: string, parent: any, isMain: boolean) {
  const exports = originalLoad.apply(this, [request, parent, isMain]);

  // 1. Environment Guard: Only mutate if explicitly enabled
  const shouldMutate = process.env.APOPHASIS_MUTATE === 'true';
  if (!shouldMutate || typeof request !== 'string') {
    return exports;
  }

  // 2. Targeted Injection: Only intercept Playwright's test/matchers logic
  if (request === '@playwright/test' || request.indexOf('playwright/lib/test') !== -1) {
    if (exports?.expect && !exports.expect._isApophasisMutated) {
      
      /**
       * Creates a proxy around the matchers object (e.g., the object returned by expect(x))
       */
      const createMatchersProxy = (actualMatchers: any): any => {
        if (!actualMatchers || typeof actualMatchers !== 'object' || proxyMap.has(actualMatchers)) {
          return actualMatchers;
        }

        const matcherProxy = new Proxy(actualMatchers, {
          get(target, prop, receiver) {
            // Bypass for internal symbols, async primitives, and housekeeping
            if (
              typeof prop !== 'string' || 
              prop === '$$typeof' || 
              prop === 'asymmetricMatch' ||
              ['then', 'catch', 'finally', 'constructor', 'toJSON'].includes(prop)
            ) {
              return Reflect.get(target, prop, receiver);
            }

            // Handle Promise unwrapping for .resolves and .rejects
            if (prop === 'resolves' || prop === 'rejects') {
              const promiseMatchers = Reflect.get(target, prop, receiver);
              return createMatchersProxy(promiseMatchers);
            }

            // DO NOT intercept '.not' directly to avoid the "Inversion Paradox" 
            // (We want to return the negated version of the call, not negate the negator)
            if (prop === 'not') {
              return Reflect.get(target, prop, receiver);
            }

            const originalMatcher = Reflect.get(target, prop, receiver);
            const negatedSet = Reflect.get(target, 'not');

            // THE INVERSION LOGIC
            // If the user calls expect(x).toBe(y), we return expect(x).not.toBe(y)
            if (typeof originalMatcher === 'function' && negatedSet) {
              const negatedMatcher = Reflect.get(negatedSet, prop);
              if (typeof negatedMatcher === 'function') {
                // Bind to negatedSet to ensure 'this.isNot' is true inside the Playwright matcher
                return negatedMatcher.bind(negatedSet);
              }
            }

            return originalMatcher;
          }
        });

        proxyMap.add(matcherProxy);
        return matcherProxy;
      };

      /**
       * The Main Expect Proxy
       * Intercepts expect(), expect.soft(), and expect.poll()
       */
      const proxyExpect = new Proxy(exports.expect, {
        apply(target, thisArg, args) {
          const matchers = Reflect.apply(target, target, args);
          return createMatchersProxy(matchers);
        },
        get(target, prop, receiver) {
          if (prop === '_isApophasisMutated') return true;

          const value = Reflect.get(target, prop, receiver);
          
          // Patch sub-methods that return matchers
          if (typeof value === 'function' && (prop === 'soft' || prop === 'poll')) {
            return (...args: any[]) => {
              const matchers = value.apply(target, args);
              return createMatchersProxy(matchers);
            };
          }
          return value;
        }
      });

      // Safely replace the export
      try {
        Object.defineProperty(exports, 'expect', {
          value: proxyExpect,
          configurable: true,
          enumerable: true,
          writable: true
        });
      } catch (e) {
        // Fallback for environments where exports might be frozen
        try { exports.expect = proxyExpect; } catch (inner) {}
      }
    }
  }

  return exports;
};