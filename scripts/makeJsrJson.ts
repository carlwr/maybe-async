#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'

interface PkgJson {
  name   : string
  version: string
  license: string
}

async function main(): Promise<void> {
  const pkgJson = JSON.parse(await readFile('package.json', 'utf8')) as PkgJson

  const jsrConfig = {
    name: pkgJson.name,
    version: pkgJson.version,
    license: pkgJson.license,
    exports: './src/maybe-async.ts',
    publish: {
      include: [
        'LICENSE',
        'README.md',
        'src/**/*.ts',
      ],
    },
  }

  await writeFile('jsr.json', `${JSON.stringify(jsrConfig, null, 2)}\n`, 'utf8')
  console.info('synced jsr.json')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
