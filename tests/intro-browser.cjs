/* Native media completion, intro cancellation and responsive visual checks. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),save=JSON.parse(fs.readFileSync(path.join(root,'sample_save'),'utf8'));
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.wav':'audio/wav','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1100,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('hoopwire.voices.muted','true');const NativeAudio=window.Audio;window.Audio=function(src){const a=new NativeAudio(src);if(String(src).includes('hoopwire-tv-intro'))window.testTheme=a;return a;};});
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>!document.getElementById('saveFile').disabled);
  await page.locator('#saveFile').setInputFiles({name:'league.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});await page.waitForFunction(()=>!document.getElementById('saveFile').disabled);await page.locator('.nav a[href="#tv"]').click();
  await page.locator('#tvIntro').waitFor({state:'visible'});assert.equal(await page.locator('#tvIntro').isVisible(),true);assert.equal(await page.locator('#tvLiveHosts').isVisible(),false);
  assert.equal(await page.locator('.tv-speech').count(),0);assert.equal(await page.locator('#tvBubbles').isVisible(),false);
  await page.locator('#tvStagePlay').click();await page.waitForFunction(()=>window.testTheme?.currentTime>0&&Number.isFinite(window.testTheme.duration));
  const duration=await page.evaluate(()=>testTheme.duration);assert.ok(duration>0);assert.equal(await page.locator('.is-speaking').count(),0);
  assert.equal(await page.evaluate(()=>testTheme.muted),true);
  assert.equal(await page.locator('.tv-speech').count(),0);
  await page.waitForFunction(()=>testTheme.currentTime>testTheme.duration*.55,{},{timeout:15000});await page.locator('#tvPlay').click();
  const paused=await page.evaluate(()=>({time:testTheme.currentTime,frames:document.getElementById('tvIntro').getAnimations({subtree:true}).map(a=>a.currentTime)}));await page.waitForTimeout(200);
  const still=await page.evaluate(()=>({time:testTheme.currentTime,frames:document.getElementById('tvIntro').getAnimations({subtree:true}).map(a=>a.currentTime)}));assert.deepEqual(still,paused);assert.equal(await page.locator('#tvStagePlay').isVisible(),true);
  await page.locator('#tvStagePlay').click();await page.waitForFunction(()=>testTheme&&!testTheme.paused);
  await page.locator('#tvStage').screenshot({path:path.join(root,'artifacts/tv-intro-logo.png')});
  await page.setViewportSize({width:390,height:844});await page.locator('#tvStage').screenshot({path:path.join(root,'artifacts/tv-intro-mobile.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('#tvIntro').isVisible(),true);
  await page.waitForFunction(()=>testTheme.ended&&!document.getElementById('tvStage').classList.contains('is-intro'),{},{timeout:20000});assert.equal(await page.locator('#tvLiveHosts').isVisible(),true);await page.waitForFunction(()=>document.querySelector('.is-speaking'));
  assert.equal(await page.locator('.tv-speech').count(),1);assert.equal(await page.locator('.tv-speech').isVisible(),true);assert.equal(await page.locator('#tvBubbles').evaluate(e=>e.hidden),false);
  assert.match(await page.locator('.tv-speech').textContent(),/Welcome to HoopWire TV/);
  await page.locator('#tvPlay').click();await page.setViewportSize({width:1100,height:1000});await page.locator('#tvStage').screenshot({path:path.join(root,'artifacts/tv-intro-host-reveal.png')});
  await page.locator('#tvNext').click();await page.locator('#tvStagePlay').click();await page.waitForFunction(()=>testTheme.currentTime>0);await page.evaluate(()=>{window.oldTheme=testTheme;});await page.locator('#tvNext').click();await page.evaluate(()=>oldTheme.dispatchEvent(new Event('ended')));assert.equal(await page.locator('.is-speaking').count(),0);assert.equal(await page.locator('#tvStagePlay').isVisible(),true);assert.equal(await page.locator('#tvIntro').isVisible(),true);
  await page.emulateMedia({reducedMotion:'reduce'});await page.route('**/hoopwire-tv-intro.mp3',r=>r.abort());await page.locator('#tvStagePlay').click();assert.equal(await page.locator('#tvIntro').evaluate(e=>e.getAnimations({subtree:true}).length),0);assert.equal(await page.locator('#tvLiveHosts').isVisible(),false);
  await page.waitForFunction(()=>!document.getElementById('tvStage').classList.contains('is-intro'),{},{timeout:15000});assert.equal(await page.locator('#tvLiveHosts').isVisible(),true);
  for(let i=0;i<100;i++){if(await page.locator('#tvLineNext').isDisabled())break;await page.locator('#tvLineNext').evaluate(b=>b.click());}
  assert.match(await page.locator('.tv-speech').textContent(),/Thanks for watching HoopWire TV/);
  await page.unroute('**/hoopwire-tv-intro.mp3');
  await page.clock.install();await page.locator('#tvPlay').click();await page.clock.fastForward(10000);await page.clock.resume();
  assert.equal(await page.locator('#tvIntro.is-outro').isVisible(),true);assert.equal(await page.locator('.tv-speech').count(),0);assert.equal(await page.locator('#tvLiveHosts').isVisible(),false);assert.equal(await page.locator('#tvPlay').textContent(),'Replay');assert.equal(await page.locator('#tvStagePlay').isVisible(),false);
  await page.waitForFunction(()=>testTheme.currentTime>0&&!testTheme.paused);assert.equal(await page.evaluate(()=>testTheme.muted),true);
  await page.locator('#tvMute').click();assert.equal(await page.evaluate(()=>testTheme.muted),false);await page.locator('#tvMute').click();assert.equal(await page.evaluate(()=>testTheme.muted),true);
  await page.evaluate(()=>{window.closingTheme=testTheme;});
  await page.locator('#tvStage').screenshot({path:path.join(root,'artifacts/tv-episode-ending.png')});
  await page.locator('#tvPlay').click();assert.equal(await page.evaluate(()=>closingTheme.paused&&testTheme!==closingTheme),true);assert.equal(await page.locator('#tvIntro').evaluate(e=>e.classList.contains('is-outro')),false);assert.equal(await page.locator('.tv-speech').count(),0);assert.deepEqual(errors,[]);
  console.log(`Intro checks passed: native ${duration.toFixed(2)}s theme, hosts hidden until music ends, pause/resume synchronization, mute, story-change cancellation, silent fallback, reduced motion, desktop/mobile and no page errors.`);
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
