# maybe-async

_Helpers for values/functions that may or may not be asynchronous._

Links:
* Github: [`carlwr/maybe-async`](https://github.com/carlwr/maybe-async)
* npm: [`@carlwr/maybe-async`](https://www.npmjs.com/package/@carlwr/maybe-async)
* JSR: [`@carlwr/maybe-async`](https://jsr.io/@carlwr/maybe-async)

## Installation

```bash
# one of:
npm install @carlwr/maybe-async
pnpm dlx jsr add @carlwr/maybe-async
```

## Usage

```ts
import { andFinally, andThen } from '@carlwr/maybe-async'

andThen(1, n => n + 1)                          // 2
andThen(Promise.resolve(1), n => n + 1)         // Promise resolving to 2

andFinally(() => 1, () => {})                   // 1; cleanup ran synchronously
andFinally(() => Promise.resolve(1), () => {})  // Promise resolving to 1; cleanup ran on settle
```

Details: see the JSDoc of each function.
