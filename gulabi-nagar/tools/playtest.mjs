import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
fs.mkdirSync('art/verification',{recursive:true});
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--no-first-run'],defaultViewport:{width:1440,height:900,deviceScaleFactor:1},protocolTimeout:300000});
const errors=[];const report={};
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text())});
 await page.goto(process.env.PLAYTEST_URL || 'http://127.0.0.1:5180/?q=medium',{waitUntil:'load',timeout:120000});
 await page.waitForFunction('window.__ready === true',{timeout:240000});
 await new Promise(r=>setTimeout(r,900));
 await page.screenshot({path:'art/verification/welcome.png'});
 report.build=await page.evaluate(()=>({errors:__errors,modules:Object.keys(__stats.modules),jaipur:__ctx.services.jaipur}));
 assert.deepEqual(report.build.errors,[]);assert.equal(report.build.jaipur.rickshaws,3);
 await page.click('#go');await page.waitForFunction(()=>document.body.classList.contains('playing'));
 await new Promise(r=>setTimeout(r,1200));await page.screenshot({path:'art/verification/bazaar.png'});
 const before=await page.evaluate(()=>__ctx.playerObj.pos.toArray());
 await page.keyboard.down('KeyW');await new Promise(r=>setTimeout(r,1000));await page.keyboard.up('KeyW');
 const after=await page.evaluate(()=>__ctx.playerObj.pos.toArray());
 report.walkDistance=Math.hypot(after[0]-before[0],after[2]-before[2]);assert.ok(report.walkDistance>1);
 for(const [key,name] of [['Digit2','chowk'],['Digit3','platform'],['Digit4','crossing'],['Digit5','promenade']]){await page.keyboard.press(key);await new Promise(r=>setTimeout(r,350));await page.screenshot({path:`art/verification/${name}.png`});}
 await page.keyboard.press('KeyM');assert.equal(await page.$eval('#mute',e=>e.getAttribute('aria-pressed')),'true');
 await page.keyboard.press('KeyF');assert.equal(await page.evaluate(()=>__ctx.playerObj.fly),true);
 await page.keyboard.press('Digit1');assert.equal(await page.evaluate(()=>__ctx.playerObj.fly),false);
 report.trains=await page.evaluate(()=>{__sim(40);return Object.keys(__ctx.services.rail||{});});
 await page.evaluate(()=>document.exitPointerLock());
 await page.click('[data-place="2"]');assert.ok(Math.abs(await page.evaluate(()=>__ctx.playerObj.pos.x)-9.5)<.2);
 await page.evaluate(()=>__setCam(2,2.2,-6,4,0));await new Promise(r=>setTimeout(r,300));await page.screenshot({path:'art/verification/station.png'});
 report.stats=await page.evaluate(()=>({fps:__stats.fps,calls:__stats.calls,triangles:__stats.triangles}));
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await page.reload({waitUntil:'load'});await page.waitForFunction('window.__ready===true',{timeout:240000});
 await new Promise(r=>setTimeout(r,900));await page.screenshot({path:'art/verification/mobile-welcome.png'});await page.click('#go');await new Promise(r=>setTimeout(r,500));await page.screenshot({path:'art/verification/mobile-playing.png'});
 report.mobile=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,playing:document.body.classList.contains('playing')}));assert.equal(report.mobile.overflow,false);
 report.errors=errors;fs.writeFileSync('art/verification/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
