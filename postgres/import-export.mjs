// Import a user-owned /api/export JSON into an existing, empty PostgreSQL account.
// Usage: node postgres/import-export.mjs <export.json> <email>
import fs from 'node:fs';
import {Pool} from 'pg';
const [file,email] = process.argv.slice(2);
if (!file||!email||!process.env.DATABASE_URL) throw Error('Usage: DATABASE_URL=... node postgres/import-export.mjs export.json user@example.com');
const source=JSON.parse(fs.readFileSync(file,'utf8'));
if(!Array.isArray(source.accounts)||!Array.isArray(source.items)) throw Error('Invalid MoneyPilot export');
function validNumber(n){return Number.isSafeInteger(n)&&Math.abs(n)<=100_000_000_000;}
const validKinds=new Set(['income','bill','subscription','debt','budget','goal']);
const validFrequency=new Set(['once','weekly','biweekly','monthly','yearly']);
const validStatus=new Set(['planned','paid','canceled']);
const validCertainty=new Set(['confirmed','estimated']);
for(const a of source.accounts){if(typeof a.name!=='string'||!a.name||a.name.length>100||!validNumber(a.balance_cents)||!validNumber(a.protected_cents)||a.protected_cents<0||a.protected_cents>Math.max(0,a.balance_cents))throw Error('Invalid account in export');}
for(const i of source.items){if(typeof i.name!=='string'||!i.name||i.name.length>100||!validKinds.has(i.kind)||!validNumber(i.amount_cents)||i.amount_cents<0||!/^\d{4}-\d{2}-\d{2}$/.test(i.due_date)||!validFrequency.has(i.frequency)||!validStatus.has(i.status)||!validCertainty.has(i.certainty))throw Error('Invalid financial item in export');}
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,ssl:process.env.PG_SSL==='require'?{rejectUnauthorized:true}:undefined});
const c=await pool.connect();
try{
 await c.query('BEGIN');
 const r=await c.query('SELECT id FROM users WHERE email=$1 FOR UPDATE',[email.trim().toLowerCase()]);
 if(r.rowCount!==1)throw Error('Destination account must exist before importing');
 const userId=r.rows[0].id;
 const existing=await c.query('SELECT (SELECT count(*) FROM accounts WHERE user_id=$1) AS accounts, (SELECT count(*) FROM items WHERE user_id=$1) AS items',[userId]);
 if(Number(existing.rows[0].accounts)!==0||Number(existing.rows[0].items)!==0)throw Error('Destination account is not empty; refusing to duplicate data');
 for(const a of source.accounts)await c.query('INSERT INTO accounts(user_id,name,balance_cents,protected_cents) VALUES($1,$2,$3,$4)',[userId,a.name,a.balance_cents,a.protected_cents]);
 for(const i of source.items)await c.query('INSERT INTO items(user_id,name,kind,amount_cents,due_date,frequency,status,certainty) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[userId,i.name,i.kind,i.amount_cents,i.due_date,i.frequency,i.status,i.certainty]);
 await c.query('COMMIT');
 console.log('Import complete: '+source.accounts.length+' account(s) and '+source.items.length+' financial record(s).');
}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}