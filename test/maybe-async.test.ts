import { describe, expect, it, vi } from 'vitest'
import { andFinally, andThen } from '../src/maybe-async.ts'


const err = new Error('from run')

const one   = () => 1
const fails = (): number => { throw err }
const inc   = (n: number) => n + 1

const promised = (get: () => number): Promise<number> =>
  new Promise(resolve => resolve(get()))

const thenable = (get: () => number): PromiseLike<number> =>
  // biome-ignore lint/suspicious/noThenProperty: a foreign promise
  ({then: (ok, rej) => promised(get).then(ok, rej)})

/* a thenable that is also callable - a function is a valid thenable too */
const callable = (get: () => number): PromiseLike<number> =>
  Object.assign(() => {}, thenable(get))

/* an object whose `then` getter throws */
const throwingThen = (): PromiseLike<number> => ({
  // biome-ignore lint/suspicious/noThenProperty: a foreign promise
  get then(): never { throw err },
})

/* a thenable counting the reads of its `then` */
function countingThen(): {value: PromiseLike<number>, reads: () => number} {
  let reads = 0
  const value: PromiseLike<number> = {
    // biome-ignore lint/suspicious/noThenProperty: a foreign promise
    get then() { reads++; return thenable(one).then },
  }
  return {value, reads: () => reads}
}

/* what `run` throws or rejects with, if anything */
async function thrown(run: () => unknown): Promise<unknown> {
  try { await run() }
  catch (error) {
    return error
  }
}

/* the ways a value can arrive: bare, native promise, foreign promises */
interface Flavor {
  name   : string
  wrap   : (get: () => number) => number|PromiseLike<number>
  isAsync: boolean
}

const flavors: Flavor[] = [
  {name: 'plain'   , isAsync: false, wrap: get => get()},
  {name: 'promise' , isAsync: true , wrap: promised    },
  {name: 'thenable', isAsync: true , wrap: thenable    },
  {name: 'callable', isAsync: true , wrap: callable    },
]

const asyncFlavors = flavors.filter(({isAsync}) => isAsync)


describe('andThen', () => {

  it.each(flavors)('$name: applies f', async ({wrap}) => {
    expect(await andThen(wrap(one), inc)).toBe(2)
  })

  it.each(flavors)('$name: is async iff the value is', ({wrap, isAsync}) => {
    expect(andThen(wrap(one), inc) instanceof Promise).toBe(isAsync)
  })

  it.each(flavors)('$name: propagates a throwing f', async ({wrap}) => {
    expect(await thrown(() => andThen(wrap(one), fails))).toBe(err)
  })

  it.each(asyncFlavors)('$name: skips f on rejection', async ({wrap}) => {
    const f = vi.fn(inc)
    expect(await thrown(() => andThen(wrap(fails), f))).toBe(err)
    expect(f).not.toHaveBeenCalled()
  })

  it('calls f synchronously for a plain value', () => {
    const f = vi.fn(inc)
    andThen(1, f)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('throws synchronously for a plain value', () => {
    expect(() => andThen(1, fails)).toThrow(err)
  })

  it('passes a promise from f on as it is', () => {
    const p = promised(one)
    expect(andThen(1, () => p)).toBe(p)
  })

  it.each(asyncFlavors)('$name: flattens what f returns', async ({wrap}) => {
    expect(await andThen(promised(one), n => wrap(() => n + 1))).toBe(2)
  })

  it('reads `then` once', async () => {
    const counted = countingThen()
    expect(await andThen(counted.value, inc)).toBe(2)
    expect(counted.reads()).toBe(1)
  })

  it('rejects if reading `then` throws', async () => {
    const f = vi.fn()
    const out = andThen(throwingThen(), f)
    expect(out instanceof Promise).toBe(true)
    expect(await thrown(() => out)).toBe(err)
    expect(f).not.toHaveBeenCalled()
  })

})


describe('andFinally', () => {

  it.each(flavors)('$name: passes the outcome on', async ({wrap}) => {
    const cleanup = vi.fn()
    expect(await andFinally(() => wrap(one), cleanup)).toBe(1)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it.each(flavors)('$name: passes a failure on', async ({wrap}) => {
    const cleanup = vi.fn()
    const run = () => andFinally(() => wrap(fails), cleanup)
    expect(await thrown(run)).toBe(err)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it.each(flavors)('$name: is async iff run is', ({wrap, isAsync}) => {
    const out = andFinally(() => wrap(one), () => {})
    expect(out instanceof Promise).toBe(isAsync)
  })

  it.each(flavors)('$name: cleans up on settle', async ({wrap, isAsync}) => {
    const cleanup = vi.fn()
    const out = andFinally(() => wrap(one), cleanup)
    expect(cleanup).toHaveBeenCalledTimes(isAsync ? 0 : 1)
    await out
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it.each(flavors)('$name: a cleanup error wins', async ({wrap}) => {
    const bad = new Error('from cleanup')
    const run = () => andFinally(() => wrap(one), () => { throw bad })
    expect(await thrown(run)).toBe(bad)
    expect(bad.cause).toBeUndefined()
  })

  it.each(flavors)('$name: cleanup error keeps the cause', async ({wrap}) => {
    const bad = new Error('from cleanup')
    const run = () => andFinally(() => wrap(fails), () => { throw bad })
    expect(await thrown(run)).toBe(bad)
    expect(bad.cause).toBe(err)
  })

  it('keeps a cause the cleanup error already had', async () => {
    const bad = new Error('from cleanup', {cause: 'its own'})
    const run = () => andFinally(fails, () => { throw bad })
    expect(await thrown(run)).toBe(bad)
    expect(bad.cause).toBe('its own')
  })

  it.each(flavors)('$name: passes a frozen cleanup error on', async ({wrap}) => {
    const bad = Object.freeze(new Error('from cleanup'))
    const run = () => andFinally(() => wrap(fails), () => { throw bad })
    expect(await thrown(run)).toBe(bad)
  })

  it.each(flavors)('$name: passes a non-Error from cleanup on', async ({wrap}) => {
    const run = () => andFinally(() => wrap(fails), () => { throw 'oops' })
    expect(await thrown(run)).toBe('oops')
  })

  it.each(flavors)('$name: ignores what cleanup returns', async ({wrap}) => {
    expect(await andFinally(() => wrap(one), () => 99)).toBe(1)
  })

  it('reads `then` once', async () => {
    const counted = countingThen()
    expect(await andFinally(() => counted.value, () => {})).toBe(1)
    expect(counted.reads()).toBe(1)
  })

  it('cleans up if reading `then` throws', async () => {
    const cleanup = vi.fn()
    expect(await thrown(() => andFinally(throwingThen, cleanup))).toBe(err)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('never makes an error its own cause', async () => {
    const both = new Error('from both')
    const run = () => andFinally(
      () => { throw both },
      () => { throw both },
    )
    expect(await thrown(run)).toBe(both)
    expect(both.cause).toBeUndefined()
  })

})
