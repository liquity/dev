// from: https://github.com/Uniswap/merkle-distributor

import { program } from 'commander'
//import fs from 'fs'
import * as fs from 'fs'
import { parseBalanceMap } from '../src/parse-balance-map'

program
  .version('0.0.0')
  .requiredOption(
    '-i, --input <path>',
    'input JSON file location containing a map of account addresses to string balances'
  )
  .requiredOption(
    '-o, --output <path>',
    'output file location for the resulting JSON Merkle Tree'
  )

program.parse(process.argv)

const json = JSON.parse(fs.readFileSync(program.input, { encoding: 'utf8' }))

if (typeof json !== 'object') throw new Error('Invalid JSON')

fs.writeFileSync(program.output, JSON.stringify(parseBalanceMap(json)))
