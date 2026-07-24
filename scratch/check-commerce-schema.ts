import { queryPostgres } from '../lib/db/postgres'
async function check() {
  const t1 = await queryPostgres(`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'branches'`)
  const t2 = await queryPostgres(`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'warehouses'`)
  const t3 = await queryPostgres(`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'bank_accounts'`)
  const t4 = await queryPostgres(`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'stores'`)
  console.log("Branches:", t1.rows.filter(r => r.is_nullable === 'NO').map(r => r.column_name))
  console.log("Warehouses:", t2.rows.filter(r => r.is_nullable === 'NO').map(r => r.column_name))
  console.log("Bank Accounts:", t3.rows.filter(r => r.is_nullable === 'NO').map(r => r.column_name))
  console.log("Stores:", t4.rows.filter(r => r.is_nullable === 'NO').map(r => r.column_name))
}
check()
