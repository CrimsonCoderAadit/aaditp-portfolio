const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://localhost:3002');await page.waitForFunction(()=>performance.getEntriesByName('studio:ready').length,null,{timeout:60000});
 await page.getByRole('button',{name:'Workstation view'}).click();await page.waitForTimeout(1800);await page.touchscreen.tap(275,340);await page.waitForTimeout(1800);await page.getByRole('button',{name:/START RUN/}).tap();await page.waitForTimeout(300);
 const before=await page.evaluate(()=>window.__runnerDebug.player.y);const box=await page.getByRole('button',{name:'↑'}).boundingBox();const x=box.x+box.width/2,y=box.y+box.height/2;
 const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await page.waitForTimeout(600);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const after=await page.evaluate(()=>window.__runnerDebug.player.y);
 console.log('TOUCH MOVE',before,after,after<before-30?'PASS':'FAIL');
 const p0=await page.evaluate(()=>window.__runnerDebug.stats.pulses);await page.getByRole('button',{name:'PULSE'}).tap();await page.waitForTimeout(150);const p1=await page.evaluate(()=>window.__runnerDebug.stats.pulses);console.log('TOUCH PULSE',p0,p1,p1===p0+1?'PASS':'FAIL');
 await page.screenshot({path:'/private/tmp/system-runner-mobile-final.png'});await page.getByRole('button',{name:'Exit terminal'}).first().click();await page.waitForTimeout(2500);const returned=await page.locator('.workbench-hero').getAttribute('data-mode');console.log('MOBILE RETURN',returned,returned==='workbench'?'PASS':'FAIL');console.log('ERRORS',errors);
 if(!(after<before-30&&p1===p0+1&&returned==='workbench'&&errors.length===0))process.exitCode=1;
}finally{await browser.close()}
