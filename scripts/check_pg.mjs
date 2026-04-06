const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgres://postgres:postgres@127.0.0.1:54322/postgres'
});
client.connect().then(() => {
  client.query("SELECT polname, polcmd, pg_get_expr(polqual, polrelid) as qual FROM pg_policy pol JOIN pg_class t ON pol.polrelid = t.oid WHERE t.relname = 'employees';")
    .then(r => { console.log(r.rows); client.end(); })
    .catch(e => { console.error('Query error:', e); client.end(); });
}).catch(e => console.error('Connection error:', e));
