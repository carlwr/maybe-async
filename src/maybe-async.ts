/**
 * Helpers for values/functions that may or may not be asynchronous.
 *
 * The helpers can sometimes let code use a single implementation that handles both synchronous and asynchronous values/functions without branching at the call site. If the inputs are synchronous, the result stays synchronous, i.e. without introducing a promise.
 *
 * @module maybe-async
 */

/**
 * A return value that is not a {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise#thenables | thenable}.
 */
export type NotThenable<T> =
  unknown extends T                                  ? unknown :
  [Extract<T, PromiseLike<unknown>>] extends [never] ? unknown :
  never

/**
 * Apply a function (`f`) to a value (`value`). `value` may or may not be a promise, and `f` may or may not return a promise.
 *
 * If `value` is a promise, `f` receives the awaited `value`.
 *
 * What `andThen` returns, and how it calls `f`, is determined by what `value` is:
 *
 * | `value`            | ->  | `andThen`                   | calls `f`      |
 * | :----------------- | :-: | :-------------------------- | :------------- |
 * | non-promise        | ->  | returns what `f` returned   | synchronously  |
 * | fulfilling promise | ->  | returns a native promise    | asynchronously |
 * | rejecting promise  | ->  | returns a rejecting promise | never          |
 *
 * If `f` throws, then if `value` is
 * - a non-promise, the error propagates
 * - a promise, then the returned promise rejects
 *
 * If `value` is a promise, a _flattened_ (native) promise is returned.
 *
 * If a `.then` getter of `value` throws, the returned promise will be a rejection.
 *
 * In the documentation above, "promise" is used in the meaning of {@linkcode PromiseLike} on the type level, and an object with a {@linkcode PromiseLike.then} method at runtime. The two are typically the same but may disagree in rare cases.
 */
export function andThen<V, B>(
  value: V,
  f    : (a: Awaited<V>) => B,
):
  V extends PromiseLike<unknown> ? Promise<Awaited<B>>   :
  PromiseLike<unknown> extends V ? B|Promise<Awaited<B>> :
  B

export function andThen<A, B>(
  value: A|PromiseLike<A>,
  f    : (a: A) => B,
): B|Promise<B> {
  const promise = toPromise(value)
  return promise
    ? promise.then(f)
    : f(value as A)
}

/**
 * Run the function `run`. Run the synchronous `cleanup` function once, regardless of whether `run` returned, threw or rejected.
 *
 * If `run` returns a promise, `cleanup` is run when that promise has settled.
 *
 * The return value of `cleanup` is always ignored.
 *
 * What `andFinally` returns, and how it calls `cleanup`, is determined by whether `run` threw, and if it didn't, what it returned:
 *
 * | `run`                  | ->  | `andFinally`             | calls `cleanup` |
 * | :--------------------- | :-: | :----------------------- | :-------------- |
 * | returned a non-promise | ->  | returns or throws        | synchronously   |
 * | threw                  | ->  | throws                   | synchronously   |
 * | returned a promise     | ->  | returns a native promise | asynchronously  |
 *
 * The outcome of `andFinally`, and what error is attached as `cause`, if any, is determined by whether `run` threw/rejected and whether `cleanup` threw:
 *
 * | `run`     | `cleanup` | ->  | outcome           | `cause` set to          |
 * | :-------- | :-------- | :-: | :---------------- | :---------------------- |
 * | succeeded | returned  | ->  | `run`'s value     | –                       |
 * | failed    | returned  | ->  | `run`'s error     | –                       |
 * | succeeded | threw     | ->  | `cleanup`'s error | –                       |
 * | failed    | threw     | ->  | `cleanup`'s error | `run`'s error, if unset |
 *
 * If `cleanup` throws an error and `run` failed, `cleanup`'s error object is mutated (can only matter if shared or reused).
 *
 * In the documentation above, "promise" is used in the meaning of {@linkcode PromiseLike} on the type level, and an object with a {@linkcode PromiseLike.then} method at runtime. The two are typically the same but may disagree in rare cases.
 */
export function andFinally<R, C = void>(
  run    : () => R,
  cleanup: () => C & NotThenable<C>,
): R extends PromiseLike<unknown> ? Promise<Awaited<R>> : R

export function andFinally<A>(
  run    : () => A|PromiseLike<A>,
  cleanup: () => unknown,
): A|Promise<A> {
  const onValue = (value: A): A => { cleanup(); return value }

  const onError = (error: unknown): never => {
    try { cleanup() }
    catch (fromCleanup) {
      throw withCause(fromCleanup, error)
    }
    throw error
  }

  let out: A|PromiseLike<A>
  try { out = run() }
  catch (error) {
    return onError(error)
  }

  const promise = toPromise(out)
  return promise
    ? promise.then(onValue, onError)
    : onValue(out as A)
}

/* Stance re. JSDoc of exported functions:

- main goal: make them _comprehensible_
  - documenting all technical details would be overwhelming for a reader; instead prioritize conceptual clarity

- tables + prose _as a whole_ should convey the information
  - the two are not intended to _independently_ convey everything

- markdown tables should be max. 80 chars wide
  - too wide tables may make them hard to read or partially hidden in hovers; also, <80 chars keeps them readable as plaintext in an editor with soft-wrapping at 80 chars

*/

/* a native promise adopting `value` if it is a thenable, else undefined

like `Promise.resolve`, but `value.then` is read only once; as with `Promise.resolve`, a throwing `then` getter gives a rejecting promise
*/
function toPromise<A>(value: A|PromiseLike<A>): Promise<A>|undefined {
  const isObject =
    (typeof value === 'object' && value !== null) ||
     typeof value === 'function'
  if (!isObject) return undefined
  let then: unknown
  try { then = (value as {then?: unknown}).then }
  catch (error) {
    return Promise.reject(error)
  }
  if (typeof then !== 'function') return undefined
  return new Promise<A>((resolve, reject) => then.call(value, resolve, reject))
}

function withCause<E>(error: E, cause: unknown): E {
  if (
    error instanceof Error &&
    error.cause === undefined &&
    error !== cause
  )
    try { error.cause = cause }
    catch { /* e.g. a frozen error; leave it as it is */ }
  return error
}
