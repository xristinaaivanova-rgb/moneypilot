import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as pause} from 'node:timers/promises';
import {randomUUID} from 'node:crypto';
const base='http://127.0.0.1:3099';
let proc;
async function call(path,{method='GET',cookie,body}={}){
 const headers={};if(cookie)headers.Cookie=cookie;if(body)headers['Content-Type']='application/json';
 const response=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined,redirect:'manual'});
 let data=await response.json();
 return {status:response.status,body:data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
before(async()=>{
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required for PostgreSQL integration tests');
 proc=spawn(process.execPath,['src/server-pg.js'],{env:{...process.env,PORT:'3099',COOKIE_SECURE:'0'},stdio:['ignore','pipe','pipe']});
 proc.stdout.on('data',x=>process.stdout.write(x));proc.stderr.on('data',x=>process.stderr.write(x));
 let started=false;
 for(let i=0;i<60;i++){
  if(proc.exitCode!==null)throw Error('PostgreSQL web server exited before startup');
  try{const r=await call('/health');if(r.status===200&&r.body.database==='postgres'){started=true;break}}catch{}
  await pause(300);
 }
 if(!started)throw Error('PostgreSQL health check never became ready');
});
after(()=>proc?.kill('SIGTERM'));
test('PostgreSQL registration, persistence, account isolation and CRUD',async()=>{
 const email='test-'+randomUUID()+'@example.invalid';
 const other='test-'+randomUUID()+'@example.invalid';
 const password='AnotherSecurePassword_123';
 const created=await call('/api/register',{method:'POST',body:{email,password}});
 assert.equal(created.status,201);assert.ok(created.cookie);
 const cookie=created.cookie;
 assert.equal((await call('/api/me',{cookie})).body.email,email);
 const account=await call('/api/accounts',{method:'POST',cookie,body:{name:'Main',balance_cents:125000,protected_cents:20000}});
 assert.equal(account.status,201);
 const item=await call('/api/items',{method:'POST',cookie,body:{name:'Rent',kind:'bill',amount_cents:60000,due_date:'2026-12-01',frequency:'monthly',certainty:'confirmed'}});
 assert.equal(item.status,201);
 const snap=await call('/api/snapshot?days=90',{cookie});
 assert.equal(snap.status,200);assert.equal(snap.body.accounts.length,1);
 assert.equal(snap.body.items.length,1);assert.equal(snap.body.items[0].amount_cents,60000);
 const id=snap.body.items[0].id;
 const second=await call('/api/register',{method:'POST',body:{email:other,password}});
 assert.equal(second.status,201);const otherCookie=second.cookie;
 assert.equal((await call('/api/snapshot',{cookie:otherCookie})).body.items.length,0);
 assert.equal((await call('/api/items/'+id,{method:'DELETE',cookie:otherCookie,body:{}})).status,404);
 const exported=await call('/api/export',{cookie});
 assert.equal(exported.body.items.length,1);
 const logout=await call('/api/logout',{method:'POST',cookie,body:{}});
 assert.equal(logout.status,200);
 assert.equal((await call('/api/me',{cookie})).status,401);
 const login=await call('/api/login',{method:'POST',body:{email,password}});
 assert.equal(login.status,200);const again=await call('/api/snapshot',{cookie:login.cookie});
 assert.equal(again.body.items.length,1);
 assert.equal((await call('/api/items/'+id,{method:'DELETE',cookie:login.cookie,body:{}})).status,200);
 const removed=await call('/api/snapshot',{cookie:login.cookie});assert.equal(removed.body.items.length,0);
 const deleted=await call('/api/delete-account',{method:'POST',cookie:login.cookie,body:{}});
 assert.equal(deleted.status,200);
 assert.equal((await call('/api/login',{method:'POST',body:{email,password}})).status,401);
});
test('Foreign-user account access is denied',async()=>{
 const password='AnotherSecurePassword_123';
 const a=await call('/api/register',{method:'POST',body:{email:'a-'+randomUUID()+'@example.invalid',password}});
 const b=await call('/api/register',{method:'POST',body:{email:'b-'+randomUUID()+'@example.invalid',password}});
 const ca=a.cookie,cb=b.cookie;
 assert.equal((await call('/api/accounts',{method:'POST',cookie:ca,body:{name:'Savings',balance_cents:1000,protected_cents:500}})).status,201);
 const id=(await call('/api/snapshot',{cookie:ca})).body.accounts[0].id;
 assert.equal((await call('/api/accounts/'+id,{method:'PUT',cookie:cb,body:{name:'Hacked',balance_cents:5,protected_cents:0}})).status,404);
 assert.equal((await call('/api/snapshot',{cookie:ca})).body.accounts[0].balance_cents,1000);
});
test('PostgreSQL records survive a full web-server restart', async()=>{
 const email='durable-'+randomUUID()+'@example.invalid',password='SafeLongPassword_456';
 const r=await call('/api/register',{method:'POST',body:{email,password}});
 assert.equal(r.status,201);
 const cookie=r.cookie;
 assert.equal((await call('/api/items',{method:'POST',cookie,body:{name:'Recurrent energy',kind:'bill',amount_cents:1199,due_date:'2026-12-10',frequency:'monthly',certainty:'confirmed'}})).status,201);
 proc.kill('SIGTERM');
 await once(proc,'exit');
 proc=spawn(process.execPath,['src/server-pg.js'],{env:{...process.env,PORT:'3099',COOKIE_SECURE:'0'},stdio:['ignore','pipe','pipe']});
 proc.stdout.on('data',x=>process.stdout.write(x));proc.stderr.on('data',x=>process.stderr.write(x));
 let ready=false;
 for(let i=0;i<60;i++){try{const h=await call('/health');if(h.status===200){ready=true;break}}catch{}await pause(200)}
 assert.ok(ready,'server must restart with the original PostgreSQL data');
 const logged=await call('/api/login',{method:'POST',body:{email,password}});
 assert.equal(logged.status,200);
 const snap=await call('/api/snapshot',{cookie:logged.cookie});
 assert.equal(snap.body.items.length,1);
 assert.equal(snap.body.items[0].name,'Recurrent energy');
 assert.equal(snap.body.items[0].amount_cents,1199);
});