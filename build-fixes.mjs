import fs from 'node:fs';
const file='/app/public/app.js';
let code=fs.readFileSync(file,'utf8');
const begin=code.indexOf('async function loadSession(){');
const end=code.indexOf('\nasync function refresh()',begin);
if(begin<0||end<0||end<begin)throw new Error('Cannot locate login/session handler; refusing to change code');
const replacement=[
"async function loadSession(){",
"  let session;",
"  try{session=await request('/api/me');}",
"  catch(e){",
"    me=null;snapshot=null;",
"    $('#app').hidden=true;",
"    $('#navDashboard').style.display='none';",
"    return;",
"  }",
"  me=session;",
"  $('#app').hidden=false;",
"  $('#navDashboard').style.display='';",
"  $('#userName').textContent=me.email;",
"  const days=Math.max(0,Math.ceil((Date.parse(me.trial_expires_at)-Date.now())/864e5));",
"  $('#trialStatus').textContent='14-day development trial · '+days+' day(s) remaining · Billing inactive';",
"  try {await refresh();}",
"  catch(e) {",
"    console.error('MoneyPilot snapshot unavailable:',e);",
"    $('#warning').hidden=false;",
"    $('#warning').textContent='Could not load financial data. Your session remains active; retry by reloading.';",
"  }",
"}"
].join('\n');
code=code.slice(0,begin)+replacement+code.slice(end);
fs.writeFileSync(file,code);
console.log('Session handler hardened: snapshot errors no longer masquerade as logout.');