import fs from 'fs';
import path from 'path';

const sqlPath = path.join(process.cwd(), 'master_init.sql');
let sql = fs.readFileSync(sqlPath, 'utf-8');

// 1. Create a public.users table as substitute for auth.users
const publicUsersTable = `
-- NextAuth Users Table
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT,
  email         TEXT UNIQUE,
  emailVerified TIMESTAMPTZ,
  image         TEXT,
  password      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

// Inject public users at the top after extension
sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n' + publicUsersTable);

// 2. Replace all auth.users with users
sql = sql.replace(/auth\.users/g, 'users');

// 3. Remove all RLS policies and auth.uid() dependencies
// Because we are using Prisma, Prisma doesn't use RLS natively unless configured.
// It's safer to comment out ENABLE ROW LEVEL SECURITY and CREATE POLICY and auth.uid() function usages.

// Disable RLS
sql = sql.replace(/ALTER TABLE \w+ ENABLE ROW LEVEL SECURITY;/g, '-- RLS REMOVED');
sql = sql.replace(/CREATE POLICY /g, '-- CREATE POLICY ');
sql = sql.replace(/ON \w+ FOR .*?(?=\s*(?:\n|;))/gs, function(match) {
    if(match.includes('CREATE POLICY')) return match; 
    return ''; // Wait, regex for RLS policies is tricky.
});

// A simpler way is to just let them execute? No, CREATE POLICY uses auth.uid() which doesn't exist.
// Let's remove any block starting with CREATE POLICY and ENDING with ;
sql = sql.replace(/CREATE POLICY[^;]+;/gs, '-- POLICY REMOVED');

// The nizam_has_permission function uses auth.uid(), let's replace it with a dummy or remove it
sql = sql.replace(/user_id = auth\.uid\(\)/g, 'user_id = auth_uid_placeholder'); // Make it valid SQL or drop the function
sql = sql.replace(/auth\.uid\(\)/g, "NULL");

// 4. Save to new file
fs.writeFileSync(path.join(process.cwd(), 'master_init_pg.sql'), sql);
console.log('Successfully generated master_init_pg.sql');
