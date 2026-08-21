#!/usr/bin/env node
import { seedDemoCatalog } from '../src/seed.js'

const result = seedDemoCatalog()
console.log(JSON.stringify(result, null, 2))
