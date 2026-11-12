/* type-level tests: checked by tsc (`pnpm typecheck`), not run by vitest */

import type { Assert, Eq } from '@carlwr/typescript-extra'
import { andFinally, type andThen } from '../src/maybe-async.ts'

type Then   <V,B> = ReturnType<typeof andThen   <V,B>>
type ThenArg<V,B> = Parameters<typeof andThen   <V,B>>[1]
type Finally<R  > = ReturnType<typeof andFinally<R  >>

type PNum         = Promise<number>
type Pstr         = Promise<string>
type LNum         = PromiseLike<number>
type Some         = NonNullable<unknown>  // i.e. `{}`

type _thenSync        = Assert<Eq<Then<number     ,string>, string     >>
type _thenAsyncF      = Assert<Eq<Then<number     ,Pstr  >, Pstr       >>
type _thenAwaits      = Assert<Eq<Then<PNum       ,string>, Pstr       >>
type _thenFlattens    = Assert<Eq<Then<PNum       ,Pstr  >, Pstr       >>
type _thenThenable    = Assert<Eq<Then<LNum       ,string>, Pstr       >>
type _thenUnion       = Assert<Eq<Then<number|PNum,string>, string|Pstr>>

// a value that may be a thenable at runtime:
type _thenUnknown     = Assert<Eq<Then<unknown    ,string>, string|Pstr>>
// deno-lint-ignore no-explicit-any
type _thenAny         = Assert<Eq<Then<any        ,string>, string|Pstr>>
type _thenObject      = Assert<Eq<Then<object     ,string>, string|Pstr>>
type _thenEmpty       = Assert<Eq<Then<Some       ,string>, string|Pstr>>
type _thenObjUnion    = Assert<Eq<Then<number|Some,string>, string|Pstr>>
type _thenMaybeThen   = Assert<Eq<Then<{then?: unknown},string>, string|Pstr>>

// ...but not for a value known not to be one, including objects:
type _thenRecord      = Assert<Eq<Then<Record<string,number>,string>, string>>
type _thenInterface   = Assert<Eq<Then<{a: number}          ,string>, string>>
type _thenWeak        = Assert<Eq<Then<{a?: number}         ,string>, string>>
type _thenNotThen     = Assert<Eq<Then<{then?: 1}           ,string>, string>>
type _thenNever       = Assert<Eq<Then<never                ,string>, never >>

type _thenArgSync     = Assert<Eq<ThenArg<number,string>,(a:number) => string>>
type _thenArgAwaits   = Assert<Eq<ThenArg<PNum , string>,(a:number) => string>>
type _thenArgThenable = Assert<Eq<ThenArg<LNum , string>,(a:number) => string>>

type _finallySync     = Assert<Eq<Finally<string>     , string     >>
type _finallyAsync    = Assert<Eq<Finally<Pstr>       , Pstr       >>
type _finallyThenable = Assert<Eq<Finally<LNum>       , PNum       >>
type _finallyVoid     = Assert<Eq<Finally<void>       , void       >>
type _finallyUnion    = Assert<Eq<Finally<number|PNum>, number|PNum>>

// cleanup must not return a thenable (never called; only type-checked):
declare const thenable  : LNum
declare const callable  : (() => void) & LNum
declare const maybeAsync: () => number|Promise<void>
function _finallyRejectsAsyncCleanup(): void {
  const one = () => 1
  // @ts-expect-error: cleanup must not return a thenable
  andFinally(one, async () => {})
  // @ts-expect-error: cleanup must not return a thenable
  andFinally(one, () => Promise.resolve())
  // @ts-expect-error: cleanup must not return a thenable
  andFinally(one, () => thenable)
  // @ts-expect-error: cleanup must not return a thenable
  andFinally(one, () => callable)
  // @ts-expect-error: cleanup must not return a thenable
  andFinally(one, maybeAsync)
  // ...but may return anything else:
  andFinally(one, () => {})
  andFinally(one, () => 99)
}
