import { writeFileSync, readFileSync } from 'fs'
const p = 'modules/edu/actions/lms-sales.actions.ts'
let c = readFileSync(p, 'utf-8')
if (!c.includes("'use server'") && !c.includes('"use server"')) {
  writeFileSync(p, "'use server'\n\n" + c)
}
