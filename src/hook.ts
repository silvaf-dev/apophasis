import * as ModuleNamespace from 'module';

const Module = (ModuleNamespace as any).default || ModuleNamespace;
const originalLoad = Module._load;

Module._load = function (request: string, parent: any, isMain: boolean) {
  const exports = originalLoad.apply(this, [request, parent, isMain]);

  if (request === '@playwright/test' || request.includes('playwright/lib/test')) {
    const shouldMutate = process.env.APOPHASIS_MUTATE === 'true' || process.env.MUTATE === 'true';

    if (shouldMutate && exports.expect && !exports.expect._isApophasisMutated) {
      console.log(`⚡ Apophasis: Inverting Playwright assertions (via negativa)...`);

      const originalExpect = exports.expect;

      const createMatchersProxy = (actualMatchers: any) => {
        return new Proxy(actualMatchers, {
          get(matcherTarget, prop, receiver) {
            // 1. Pass through JS internals, Promise methods, and Symbols
            if (typeof prop !== 'string' ||
              ['then', 'catch', 'finally', 'constructor',
                'asymmetricMatch'].includes(prop)
            ) {
              return Reflect.get(matcherTarget, prop, receiver);
            }

            if (prop === 'resolves' || prop === 'rejects') {
              const next = Reflect.get(matcherTarget, prop, receiver);

              // 🔑 THIS is the missing piece
              return createMatchersProxy(next);
            }

            // --- CASE A: Original assertion HAS .not (Negative -> Positive) ---
            if (prop === 'not') {
              return new Proxy(matcherTarget, {
                get(baseTarget, baseProp) {
                  const positiveMatcher = Reflect.get(baseTarget, baseProp);
                  if (typeof positiveMatcher === 'function') {
                    // FIX: Use a Proxy to preserve Playwright's internal function properties/metadata
                    return new Proxy(positiveMatcher, {
                      apply(targetFn, thisArg, argArray) {
                        return Reflect.apply(targetFn, baseTarget, argArray);
                      }
                    });
                  }
                  return positiveMatcher;
                }
              });
            }

            // --- CASE B: Original assertion is POSITIVE (Positive -> Negative) ---
            const negatedMatchers = Reflect.get(matcherTarget, 'not');

            if (!negatedMatchers) {
              return Reflect.get(matcherTarget, prop, receiver);
            }

            const negatedMatcher = Reflect.get(negatedMatchers, prop);

            if (typeof negatedMatcher === 'function') {
              // FIX: Use a Proxy to preserve Playwright's internal function properties/metadata
              return new Proxy(negatedMatcher, {
                apply(targetFn, thisArg, argArray) {
                  return Reflect.apply(targetFn, negatedMatchers, argArray);
                }
              });
            }

            return negatedMatcher !== undefined ? negatedMatcher : Reflect.get(matcherTarget, prop, receiver);
          }
        });
      };

      const proxyExpect = new Proxy(originalExpect, {
        apply(target, thisArg, args) {
          const actualMatchers = Reflect.apply(target, target, args);
          return createMatchersProxy(actualMatchers);
        },
        get(target, prop, receiver) {
          if (prop === '_isApophasisMutated') return true;

          const value = Reflect.get(target, prop, receiver);

          // 2. Intercept expect.soft and expect.poll
          if (typeof value === 'function' && (prop === 'soft' || prop === 'poll')) {
            return new Proxy(value, {
              apply(fnTarget, fnThisArg, fnArgs) {
                const actualMatchers = Reflect.apply(fnTarget, target, fnArgs);
                return createMatchersProxy(actualMatchers);
              }
            });
          }

          return value;
        }
      });

      try {
        Object.defineProperty(exports, 'expect', {
          value: proxyExpect,
          configurable: true,
          enumerable: true,
          writable: true
        });
      } catch (e) {
        console.error('⚡ Apophasis: Failed to mutate expect property.', e);
      }
    }
  }
  return exports;
};