import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.env.DATABASE_URL) throw Error('DATABASE_URL is required for PostgreSQL mode');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.PG_SSL === 'require' ? { rejectUnauthorized: true } : undefined
});
pool.on('error', err => console.error('Postgres idle connection error', err.message));
function placeholder(sql) { let n=0; return sql.replace(/\?/g,()=>'$'+(++n)); }
function marshal(rows) {
  return rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>{
    if(typeof value==='bigint')return [key,Number(value)];
    if(typeof value==='string' && /^(id|user_id|balance_cents|protected_cents|amount_cents|expires_at)$/.test(key))return [key,Number(value)];
    return [key,value];
  })));
}
export const db={
  prepare(sql){
    const statement=placeholder(sql);
    return {
      async get(...args){const r=await pool.query(statement,args);return marshal(r.rows)[0];},
      async all(...args){const r=await pool.query(statement,args);return marshal(r.rows);},
      async run(...args){
        const insert=/^\s*INSERT\s+INTO\s+(users|accounts|items)\b/i.test(statement);
        const query=insert && !/\bRETURNING\b/i.test(statement)?statement+' RETURNING id':statement;
        const r=await pool.query(query,args);
        return {changes:r.rowCount,lastInsertRowid:marshal(r.rows)[0]?.id??null};
      }
    };
  },
  close:()=>pool.end()
};
export async function initPostgres(){
  const c=await pool.connect();
  try{
    const migration=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'001_initial.sql'),'utf8');
    await c.query(migration);
    const result=await c.query('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1');
    if(result.rows[0]?.version!==1)throw Error('Unexpected schema migration state');
    console.log('MoneyPilot PostgreSQL schema v1 ready');
  }finally{c.release();}
}
export async function healthPostgres(){const r=await pool.query('SELECT 1 AS ok');return r.rows[0]?.ok===1;}
