/* MoneyPilot UX improvements: safe enhancement layer; no writes without user action. */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const now = () => { const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const locale = () => $('#language')?.value || 'en';
  const msg = (en,bg,nl) => ({bg,nl}[locale()] || en);
  const money = n => new Intl.NumberFormat(locale()==='bg'?'bg-BG':locale()==='nl'?'nl-NL':'en-IE',{style:'currency',currency:'EUR'}).format(n/100);
  const app=$('#app'), nav=$('.mpNav'), calendar=$('#mpCalendar'), modal=$('#modal');
  if(!app||!nav||!calendar||!modal)return;
  let chosenDate=now(), financial=null, loaded=false;
  const day=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
  const month=(s,n)=>{const [y,m,k]=s.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+n,1,12));const cap=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0,12)).getUTCDate();return [d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(2,'0'),String(Math.min(k,cap)).padStart(2,'0')].join('-')};
  function occurrences(items,start,end){const entries=[];for(const x of items||[]){if(x.status!=='planned')continue;for(let n=0;n<600;n++){const f=x.frequency,date=f==='weekly'?day(x.due_date,n*7):f==='biweekly'?day(x.due_date,n*14):f==='monthly'?month(x.due_date,n):f==='yearly'?month(x.due_date,n*12):x.due_date;if(date>end)break;if(date>=start)entries.push({...x,date});if(!['weekly','biweekly','monthly','yearly'].includes(f))break}}return entries.sort((a,b)=>a.date.localeCompare(b.date))}
  async function snapshot(){const response=await fetch('/api/snapshot?days=90',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error('Financial data temporarily unavailable');return await response.json()}
  function showMessage(box,text){box.textContent=text;box.setAttribute('role','status')}
  /* Clicking a calendar day offers income/expense actions on that exact date. */
  const dayTools=document.createElement('div');dayTools.id='mpDayTools';
  dayTools.innerHTML='<div class="mpDayToolsCopy"><strong id="mpDayTitle"></strong><span id="mpDayHint"></span></div><div class="mpDayToolsButtons"><button type="button" id="mpDayIncome"></button><button type="button" id="mpDayExpense"></button></div>';
  $('#mpGrid')?.insertAdjacentElement('afterend',dayTools);
  function dayLabels(){const d=new Date(chosenDate+'T12:00:00');$('#mpDayTitle').textContent=d.toLocaleDateString(locale()==='bg'?'bg-BG':locale()==='nl'?'nl-NL':'en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});$('#mpDayHint').textContent=msg('Add an item to this date','Добави запис за тази дата','Voeg een item toe voor deze datum');$('#mpDayIncome').textContent=msg('+ Income','+ Приход','+ Inkomsten');$('#mpDayExpense').textContent=msg('− Expense','− Разход','− Uitgave')}
  function openDateItem(kind){
    if(app.hidden)return;
    $('#addItem')?.click();
    if(!modal.open)return;
    const fields=$('#modalFields');
    if(!fields)return;
    const date=fields.querySelector('[name="due_date"]'),type=fields.querySelector('[name="kind"]');
    if(date)date.value=chosenDate;
    if(type)type.value=kind;
    $('#modalTitle').textContent=kind==='income'?msg('Add income','Добави приход','Inkomsten toevoegen'):msg('Add expense','Добави разход','Uitgave toevoegen');
    $('#modalNote').textContent=msg('Scheduled for ','Планирано за ','Gepland op ')+chosenDate+'. '+msg('Save to add it to your financial plan.','Запази, за да го добавиш към финансовия план.','Sla op om dit aan je financiële plan toe te voegen.');
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('#mpGrid [data-day]');
    if(b){chosenDate=b.dataset.day;dayLabels();}
  },true);
  $('#mpDayIncome').addEventListener('click',()=>openDateItem('income'));
  $('#mpDayExpense').addEventListener('click',()=>openDateItem('bill'));
  $('#mpAdd')?.addEventListener('click',e=>{e.stopImmediatePropagation();openDateItem('bill')},true);
  modal.addEventListener('close',()=>{if(!app.hidden&&document.body.classList.contains('mpCalendarView')){const c=nav.querySelector('[data-mp="calendar"]');setTimeout(()=>c?.click(),0)}});

  /* Separate private navigation from public marketing: the account session remains active. */
  const signIn=$('#openLogin'), signUp=$('#openRegister'), hero=$('#heroStart'), logo=$('#homeLogo');
  const returnLink=document.createElement('button');returnLink.type='button';returnLink.id='mpReturn';returnLink.textContent=msg('Return to my dashboard','Към моето табло','Terug naar dashboard');returnLink.hidden=true;
  const topActions=$('.topActions');topActions?.insertBefore(returnLink,topActions.firstChild);
  const goDashboard=()=>{nav.querySelector('[data-mp="overview"]')?.click();window.scrollTo(0,0)};
  returnLink.addEventListener('click',goDashboard);
  function authUI(){const logged=!app.hidden;returnLink.hidden=!logged;returnLink.textContent=msg('My dashboard','Моето табло','Mijn dashboard');if(signIn)signIn.hidden=logged;if(signUp)signUp.hidden=logged;if(hero)hero.textContent=logged?msg('Open my dashboard','Отвори моето табло','Open mijn dashboard'):msg('Start now','Започни','Begin nu');}
  document.addEventListener('click',e=>{if(e.target.closest('#heroStart')&&!app.hidden){e.preventDefault();e.stopImmediatePropagation();goDashboard()}},true);
  logo?.addEventListener('click',()=>{if(!app.hidden){authUI();returnLink.hidden=false}},true);
  new MutationObserver(()=>{authUI();if(!app.hidden&&!loaded){loaded=true;setTimeout(()=>refreshInsights(),300)}if(app.hidden)loaded=false}).observe(app,{attributes:true,attributeFilter:['hidden']});
  const passwordHint=()=>{if(!modal.open)return;const password=$('#modalFields input[name="password"]');if(password && /create|съз|registr|aanmak/i.test($('#modalTitle')?.textContent||'')){password.minLength=12;password.setAttribute('autocomplete','new-password')}else if(password)password.setAttribute('autocomplete','current-password')};
  new MutationObserver(passwordHint).observe(modal,{attributes:true,attributeFilter:['open']});

  /* Dashboard: clear next actions, financial health and quick access. */
  const dashboard=document.createElement('section');dashboard.className='mpInsights';dashboard.id='mpInsights';
  const actions=$('.appActions',app);actions?.insertAdjacentElement('afterend',dashboard);
  dashboard.innerHTML='<div class="mpInsightsHead"><div><small>FINANCIAL OVERVIEW</small><h3 id="mpInsightsTitle"></h3><p id="mpInsightsSubtitle"></p></div><button type="button" id="mpUpdateInsights"></button></div><div id="mpInsightsGrid" class="mpInsightsGrid"></div><div class="mpQuickLinks"><button type="button" data-go="calendar"></button><button type="button" data-go="allocation"></button><button type="button" data-go="purchase"></button><button type="button" data-go="whatif"></button></div>';
  async function refreshInsights(){
    if(app.hidden)return;
    try{
      financial=await snapshot();
      const start=now(),all=occurrences(financial.items,start,day(start,90));
      const bills=all.filter(x=>x.kind!=='income'),income=all.find(x=>x.kind==='income'&&x.certainty==='confirmed');
      const due=bills[0],next7=bills.filter(x=>x.date<=day(start,7)).reduce((s,x)=>s+x.amount_cents,0);
      const accountCount=financial.accounts.length;
      $('#mpInsightsTitle').textContent=msg('Your next financial decisions','Следващите ти финансови решения','Je volgende financiële keuzes');
      $('#mpInsightsSubtitle').textContent=accountCount?msg('Based on the records you entered.','Според въведените от теб записи.','Gebaseerd op je ingevoerde gegevens.'):msg('Start by adding your first account and upcoming salary.','Започни с добавяне на банкова сметка и следваща заплата.','Voeg eerst een bankrekening en salaris toe.');
      const tiles=[
        [msg('Next confirmed income','Следващ потвърден доход','Volgende bevestigde inkomsten'),income?money(income.amount_cents):'—',income?.date||msg('Not yet entered','Не е въведен','Nog niet ingevoerd')],
        [msg('Next outgoing payment','Следващо плащане','Volgende betaling'),due?money(due.amount_cents):'—',due?.date||msg('No scheduled payments','Няма записани плащания','Geen geplande betalingen')],
        [msg('Bills in next 7 days','Плащания през следващите 7 дни','Rekeningen komende 7 dagen'),money(next7),msg('Based on saved items','Според записаните разходи','Volgens ingevoerde kosten')],
        [msg('Recorded accounts','Въведени сметки','Geregistreerde rekeningen'),String(accountCount),msg('Update balances regularly','Актуализирай балансите редовно','Werk saldi regelmatig bij')]
      ];
      $('#mpInsightsGrid').innerHTML=tiles.map(x=>'<article><small>'+escape(x[0])+'</small><strong>'+escape(x[1])+'</strong><span>'+escape(x[2])+'</span></article>').join('');
      dashboard.querySelector('[data-go="calendar"]').textContent=msg('Open calendar','Отвори календара','Open kalender');
      dashboard.querySelector('[data-go="allocation"]').textContent=msg('Plan payday','Планирай заплатата','Plan salaris');
      dashboard.querySelector('[data-go="purchase"]').textContent=msg('Check a purchase','Провери покупка','Controleer aankoop');
      dashboard.querySelector('[data-go="whatif"]').textContent=msg('Explore a scenario','Пробвай сценарий','Probeer scenario');
      $('#mpUpdateInsights').textContent=msg('Refresh','Обнови','Vernieuwen');
    }catch(e){showMessage($('#mpInsightsGrid'),msg('Unable to refresh financial summary.','Неуспешно обновяване на финансовото обобщение.','Financieel overzicht kon niet worden vernieuwd.'))}
  }
  dashboard.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)nav.querySelector('[data-mp="'+b.dataset.go+'"]')?.click()});
  $('#mpUpdateInsights').onclick=refreshInsights;
  $('#addAccount')?.addEventListener('click',()=>setTimeout(refreshInsights,600));
  $('#addItem')?.addEventListener('click',()=>setTimeout(refreshInsights,600));
  document.addEventListener('click',e=>{if(e.target.closest('#modalForm #submitModal'))setTimeout(refreshInsights,600)});
  /* Allocation details are derived from saved financial events, not percentages. */
  const allocation=$('#mpAllocation'),result=$('#mpAllocationResult');
  if(allocation&&result){
    const details=document.createElement('div');details.id='mpPaydayDetails';result.after(details);
    async function fillAllocation(){
      if(app.hidden)return;
      try{
        const snap=await snapshot(),start=now(),ev=occurrences(snap.items,start,day(start,90));
        const salaries=ev.filter(x=>x.kind==='income'&&x.certainty==='confirmed');
        const first=salaries[0],next=salaries.find(x=>first&&x.date>first.date);
        if(!first){details.innerHTML='<div class="mpEmpty">'+msg('Add an income with an expected date to plan your next payday.','Добави доход с дата, за да планираш следващата заплата.','Voeg een inkomen en datum toe om je salaris te plannen.')+' <button id="mpNewIncome" type="button">'+msg('+ Add salary','+ Добави заплата','+ Salaris toevoegen')+'</button></div>';$('#mpNewIncome')?.addEventListener('click',()=>{chosenDate=now();openDateItem('income')});return}
        const end=next?next.date:day(first.date,30),bills=ev.filter(x=>x.kind!=='income'&&x.date>=first.date&&x.date<end),total=bills.reduce((v,x)=>v+x.amount_cents,0),remain=first.amount_cents-total;
        let groups={};for(const b of bills){const k=b.kind==='subscription'?msg('Subscriptions','Абонаменти','Abonnementen'):b.kind==='debt'?msg('Debt payments','Дългове','Schulden'):b.kind==='goal'?msg('Savings commitments','Спестявания','Spaardoelen'):msg('Bills and budgets','Сметки и бюджети','Rekeningen en budgetten');groups[k]=(groups[k]||0)+b.amount_cents}
        details.innerHTML='<h3>'+msg('Suggested allocation by category','Предложено разпределение по категории','Voorgestelde verdeling per categorie')+'</h3><p>'+msg('Payday','Ден на заплатата','Salarisdag')+': '+escape(first.date)+' · '+msg('Plan through','Планиране до','Planning tot')+': '+escape(end)+'</p><div class="mpAllocationRows">'+Object.entries(groups).map(([name,value])=>'<div><span>'+escape(name)+'</span><strong>'+money(value)+'</strong></div>').join('')+'<div class="mpRemaining"><span>'+msg('Remaining after listed obligations','Остатък след записаните задължения','Over na genoemde verplichtingen')+'</span><strong>'+money(remain)+'</strong></div></div><p class="mpCaveat">'+msg('The remainder is not necessarily safe to spend: unentered daily expenses may still apply.','Остатъкът не е задължително безопасен за харчене — може да има невъведени ежедневни разходи.','Het restant is niet per se veilig besteedbaar: dagelijkse kosten kunnen ontbreken.')+'</p>';
      }catch(e){showMessage(details,msg('Could not calculate the breakdown.','Не успях да изчисля разпределението.','Verdeling kon niet worden berekend.'))}
    }
    $('#mpAllocationRun')?.addEventListener('click',()=>setTimeout(fillAllocation,50));
    nav.querySelector('[data-mp="allocation"]')?.addEventListener('click',()=>setTimeout(fillAllocation,200));
  }
  /* Avoid false sense that the homepage logs the user out. */
  $('#language')?.addEventListener('change',()=>{dayLabels();authUI();if(!app.hidden)refreshInsights()});
  dayLabels();authUI();
})();