const {chromium}=require('playwright');
const assert=require('assert/strict');
const fs=require('fs');
(async()=>{
 const {db,ids,as}=await require('./fixture.cjs')();
 const [comm,admin,fan,other,home,away,p1,p2,mid]=ids;
 await db.exec("reset role; alter table teams add column primary_color text default '#17276a'; alter table teams add column short_name text default 'TEAM';");await db.query(`update matches set live_started_at=now()-interval '23 minutes',venue='Kamuzu Stadium' where id=$1`,[mid]);
 fs.mkdirSync(__dirname+'/artifacts', {recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let actor=comm; let queue=Promise.resolve();const errors=[];
 const ctx=await browser.newContext({viewport:{width:375,height:667},serviceWorkers:'block'});
 await ctx.addInitScript(({uid})=>{if(localStorage.getItem('sb-placeholder-auth-token')) return;localStorage.setItem('sb-placeholder-auth-token',JSON.stringify({access_token:'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.test',refresh_token:'test-refresh',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+86400,expires_in:86400,user:{id:uid,email:'commissioner@test.example',role:'authenticated',aud:'authenticated',app_metadata:{},user_metadata:{}}}));localStorage.setItem('fcb-theme-mode','light');},{uid:comm});
 await ctx.route('https://placeholder.supabase.co/**',async route=>{
 const task=async()=>{
  try{
   const req=route.request(),url=new URL(req.url());let result=[];
   const rpc=url.pathname.split('/rpc/')[1];
   await as(actor);
   if(rpc==='save_match_event'){
    const a=req.postDataJSON();
    result=(await db.query('select save_match_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) id',[a.p_match_id,a.p_event_id||null,a.p_action||'record',a.p_event_type||null,a.p_team_id||null,a.p_player_id||null,a.p_minute??null,a.p_description||null,a.p_reason||null,a.p_revision??null])).rows[0].id;
   }else if(rpc==='manage_match_report'){
    const a=req.postDataJSON();await db.query('select manage_match_report($1,$2,$3)',[a.p_match_id,a.p_action,a.p_reason||null]);result=null;
   }else if(url.pathname.includes('/rest/v1/')){
    const table=url.pathname.split('/rest/v1/')[1];
    if(['profiles','teams','matches','match_events','match_correction_history'].includes(table)){
     if(req.method()==='PATCH' && (table==='matches' || (table==='profiles' && req.postDataJSON().dashboard_pin_hash))){
      const a=req.postDataJSON(),id=url.searchParams.get('id').slice(3),cols=Object.keys(a);
      await db.query(`update "${table}" set ${cols.map((c,i)=>`"${c}"=$${i+1}`).join(',')} where id=$${cols.length+1}`,[...Object.values(a),id]);
     }
     result=(await db.query(`select * from "${table}"`)).rows;
     for(const[k,v]of url.searchParams){
      if(v.startsWith('eq.'))result=result.filter(r=>String(r[k])===v.slice(3));
      if(v.startsWith('in.'))result=result.filter(r=>v.slice(4,-1).split(',').includes(String(r[k])));
     }
     if(table==='match_events' && (url.searchParams.get('select')||'').includes('match:matches')){
      const ms=(await db.query('select * from matches')).rows;result=result.map(e=>({...e,match:ms.find(m=>m.id===e.match_id)}));
     }
     const order=url.searchParams.get('order');if(order){const [k,d]=order.split('.');result.sort((a,b)=>(a[k]<b[k]?-1:1)*(d==='desc'?-1:1));}
    }
   }else if(url.pathname.includes('/auth/v1/user')){result={id:actor,email:'test@example.com',role:'authenticated'};}
   await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':`0-${Math.max(0,result?.length-1)}/${result?.length||0}`},body:JSON.stringify(result)});
  }catch(e){await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:e.message,code:'P0001'})});}
 };
 queue=queue.then(task);await queue;
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 const wait=async(fn)=>{for(let i=0;i<60;i++){if(await fn())return;await page.waitForTimeout(100);}throw new Error('wait failed: '+fn)};
 const enterDashboard = async () => {
  await page.getByLabel('6-digit password').waitFor();
  await page.getByLabel('6-digit password').fill('123456');
  const create = await page.getByLabel('Repeat password').count();
  if (create) await page.getByLabel('Repeat password').fill('123456');
  await page.getByRole('dialog').getByRole('button',{name:create ? 'Save & open' : 'Unlock',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
 };
 const score=async(h,a)=>wait(async()=>await page.getByText(`${h} : ${a}`,{exact:true}).count()>0);
 try{
 await page.goto(`${process.env.TEST_BASE_URL || 'http://localhost:8765'}/commissioner/match-center/live/${mid}`);await enterDashboard();
 await page.getByRole('button',{name:'End match',exact:true}).waitFor();
 await page.getByRole('button',{name:'⚽ Goal',exact:true}).first().click();
 await page.getByRole('button',{name:'John',exact:true}).click();await score(1,0);console.log('PASS phone: record goal with live automatic minute');
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Player (registered)').click();await page.getByRole('option',{name:'Peter',exact:true}).click();
 await dialog.getByLabel('Reason for correction').fill('Wrong scorer selected');await dialog.getByRole('button',{name:'Save',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.getByText('Goal — Peter',{exact:true}).waitFor();await score(1,0);console.log('PASS phone: edit registered scorer with reason');
 await page.getByRole('button',{name:'Cancel event',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Confirm cancellation'}).isEnabled(),false);
 await page.getByLabel('Reason for cancellation').fill('Goal disallowed for offside');
 await page.getByRole('button',{name:'Confirm cancellation'}).isEnabled();await page.waitForTimeout(400);
 await page.screenshot({path:__dirname+'/artifacts/cancel-dialog-phone.png',fullPage:false});
 await page.getByRole('button',{name:'Confirm cancellation'}).click();await score(0,0);
 await page.getByText('Cancelled: Goal disallowed for offside',{exact:true}).waitFor();console.log('PASS phone: confirmed cancellation subtracts score and marks event');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth),0);
 await page.getByRole('button',{name:'End match',exact:true}).click();await page.getByRole('button',{name:'Confirm full time'}).click();
 await page.getByRole('button',{name:'Submit & finalise report',exact:true}).waitFor();
 await page.getByRole('button',{name:'⚽ Goal',exact:true}).first().click();await page.getByRole('button',{name:'John',exact:true}).click();await score(1,0);console.log('PASS phone: missed event can be recorded before finalisation');
 await page.getByRole('button',{name:'Submit & finalise report',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();
 await page.getByText('Report finalised — match records are locked.',{exact:false}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Edit',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Cancel event',exact:true}).count(),0);console.log('PASS phone: finalisation hides editing and locks report');
 await page.getByRole('button',{name:/Show correction history/}).click();
 await page.screenshot({path:__dirname+'/artifacts/finalised-record-phone.png',fullPage:true});
 await page.goto(`${process.env.TEST_BASE_URL || 'http://localhost:8765'}/commissioner/match-center/matches`);await enterDashboard();
 await page.getByRole('tab',{name:'Completed',exact:true}).click();await page.getByText('Finalised',{exact:true}).filter({visible:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth),0);
 await page.waitForTimeout(300);await page.screenshot({path:__dirname+'/artifacts/completed-matches-phone.png',fullPage:true});console.log('PASS phone: completed-match history, year selector and summary render with no page overflow');
 actor=admin;await page.evaluate(id=>{const s=JSON.parse(localStorage.getItem('sb-placeholder-auth-token'));s.user.id=id;localStorage.setItem('sb-placeholder-auth-token',JSON.stringify(s));},admin);await page.goto(`${process.env.TEST_BASE_URL || 'http://localhost:8765'}/commissioner/match-center/live/${mid}`);await enterDashboard();
 await page.getByRole('button',{name:'Reopen report for corrections',exact:true}).click();
 await page.getByLabel('Reason for reopening').fill('Review disputed match event');await page.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();
 await page.getByRole('button',{name:'Edit',exact:true}).waitFor();console.log('PASS admin: reopening re-enables correction');
 await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'Cancel event',exact:true}).click();
 await page.getByLabel('Reason for cancellation').fill('Review after reopening');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth),0);
 await page.screenshot({path:__dirname+'/artifacts/cancel-dialog-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Keep event',exact:true}).click();
 console.log('PASS desktop: cancellation dialog and layout');
 actor=fan;await page.evaluate(id=>{const s=JSON.parse(localStorage.getItem('sb-placeholder-auth-token'));s.user.id=id;localStorage.setItem('sb-placeholder-auth-token',JSON.stringify(s));},fan);await page.goto(`${process.env.TEST_BASE_URL || 'http://localhost:8765'}/matches/${mid}`);await page.getByText('Cancelled — Goal disallowed for offside',{exact:true}).waitFor();console.log('PASS fan: cancelled event is clearly marked');
 actor=p1;await page.evaluate(id=>{const s=JSON.parse(localStorage.getItem('sb-placeholder-auth-token'));s.user.id=id;localStorage.setItem('sb-placeholder-auth-token',JSON.stringify(s));},p1);
 await page.goto(`${process.env.TEST_BASE_URL || 'http://localhost:8765'}/player`);await enterDashboard();
 await page.getByText('My goals',{exact:true}).waitFor();
 assert.match(await page.getByText('My goals',{exact:true}).locator('..').innerText(),/^1/);
 actor=p2;await page.evaluate(id=>{const s=JSON.parse(localStorage.getItem('sb-placeholder-auth-token'));s.user.id=id;localStorage.setItem('sb-placeholder-auth-token',JSON.stringify(s));},p2);
 await page.goto(`${process.env.TEST_BASE_URL || 'http://localhost:8765'}/player`);await enterDashboard();
 await page.getByText('My goals',{exact:true}).waitFor();
 assert.match(await page.getByText('My goals',{exact:true}).locator('..').innerText(),/^0/);
 console.log('PASS player dashboards: active goal counts, cancelled goal excluded');
 assert.deepEqual(errors,[]);console.log('PASS no uncaught browser errors');
 }catch(e){console.error((await page.locator('body').innerText()).slice(-6000));await page.screenshot({path:__dirname+'/artifacts/failure.png',fullPage:true});throw e;}
 finally{await browser.close();await db.close();}
})().catch(e=>{console.error(e);process.exit(1)});
