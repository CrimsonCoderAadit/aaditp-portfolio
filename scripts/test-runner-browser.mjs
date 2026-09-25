const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const errors=[];
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
page.on('pageerror',e=>errors.push(e.message));
const state=()=>page.evaluate(()=>{const w=window.__runnerDebug;if(!w)return null;return {time:w.time,score:Math.floor(w.score),health:w.integrity,charge:w.pulseCharge,level:w.level,player:{x:w.player.x,y:w.player.y},stats:{...w.stats},packets:w.packets.filter(p=>p.alive).map(p=>({x:p.x,y:p.y,r:p.r})),walls:w.walls.map(q=>({x:q.x,gapY:q.gapY,gapH:q.gapH})),fragments:w.fragments.filter(f=>f.alive).map(f=>({x:f.x,y:f.y})),nodes:w.nodes.filter(n=>!n.used).map(n=>({x:n.x,y:n.y}))}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let held='';
const steer=async direction=>{if(direction===held)return;if(held)await page.keyboard.up(held);held=direction;if(held)await page.keyboard.down(held)};
try{
 await page.goto('http://localhost:3002',{waitUntil:'load'});
 await page.waitForFunction(()=>performance.getEntriesByName('studio:ready').length,null,{timeout:60000});
 await page.getByRole('button',{name:'Workstation view'}).click();
 await sleep(1700);
 await page.mouse.move(855,398);await sleep(300);
 console.log('HOVER',await page.locator('.terminal-tooltip').count());
 await page.mouse.click(855,398);
 await page.getByRole('dialog',{name:'System Runner game'}).waitFor({timeout:5000});
 await page.getByRole('button',{name:/START RUN/}).click();
 console.log('START',await state());
 let pulseDone=false;
 while(true){
  const s=await state();if(!s||s.time>=22||s.health<=0)break;
  const wall=s.walls.find(w=>w.x>s.player.x-25&&w.x<s.player.x+350);
  let target=300;
  if(wall)target=wall.gapY;
  else{const node=s.nodes.find(n=>n.x>s.player.x-15&&n.x<s.player.x+600);const fragment=s.fragments.find(f=>f.x>s.player.x-15&&f.x<s.player.x+550);target=node?.y??fragment?.y??300;}
  await steer(target<s.player.y-9?'ArrowUp':target>s.player.y+9?'ArrowDown':'');
  const packet=s.packets.find(p=>Math.hypot(p.x-s.player.x,p.y-s.player.y)<125);
  if(packet&&s.charge>=1&&!pulseDone){await page.keyboard.press('Space');pulseDone=true;}
  await sleep(60);
 }
 await steer('');
 const played=await state();console.log('PLAYED',JSON.stringify(played));
 await page.screenshot({path:'/private/tmp/system-runner-playing.png'});
 if(played.health>0){await page.keyboard.press('p');console.log('PAUSED',await page.locator('.runner-layer').getAttribute('data-phase'));await page.keyboard.press('p');console.log('RESUMED',await page.locator('.runner-layer').getAttribute('data-phase'));}
 await page.getByRole('button',{name:'Exit terminal'}).first().click();await sleep(2000);
 console.log('EXIT',await page.locator('.workbench-hero').getAttribute('data-mode'),await page.locator('.runner-layer').count());
 await page.mouse.click(855,398);await sleep(2000);console.log('REOPEN',await page.locator('.runner-layer').getAttribute('data-phase'));
 await page.screenshot({path:'/private/tmp/system-runner-reopen.png'});
 console.log('ERRORS',JSON.stringify(errors));
}finally{await browser.close()}
