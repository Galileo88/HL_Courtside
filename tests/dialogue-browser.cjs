/* Isolated integration check for editorial content, not playback timing. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),save=JSON.parse(fs.readFileSync(path.join(root,'sample_save'),'utf8'));
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.wav':'audio/wav'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage(),errors=[],blobFailures=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{if(r.url().startsWith('blob:')&&r.failure()?.errorText.includes('ERR_FILE_NOT_FOUND'))blobFailures.push(r.url());});
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>!document.getElementById('saveFile').disabled);
  await page.locator('#saveFile').setInputFiles({name:'league.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});
  await page.waitForFunction(()=>!document.getElementById('saveFile').disabled);await page.locator('.nav a[href="#tv"]').click();
  const stories=await page.evaluate(async()=>{const a=await new HoopWireArchive().open();try{return await a.all('stories');}finally{a.db.close();}});
  const labels=await page.locator('#tvStorySelect option').allTextContents(),game=stories.find(s=>s.playerStats&&s.playerName&&labels.includes(s.headline));assert.ok(game,'A verified named game is available in TV');
  await page.locator('#tvStorySelect').selectOption({label:game.headline},{force:true});
  const transcript=await page.locator('#tvTranscript').textContent();assert.ok(transcript.includes(game.playerName));assert.match(transcript,/points.*rebounds.*assists/);assert.doesNotMatch(transcript,/context matters|interesting part is how|next decision/);
  assert.match(transcript,/What stands out beyond the points|how would you evaluate/);assert.match(transcript,/Let's take that to the next matchup/);
  if(Number.isFinite(game.playerStats.TO))assert.match(transcript,/Where do the .*turnovers? fit into that assessment/);
  assert.equal(await page.locator('#tvSegment table').count(),0);assert.equal(await page.locator('.tv-postgame-player').count(),2);assert.equal(await page.locator('.tv-postgame-player .tv-stat-card').count(),10);assert.ok((await page.locator('.tv-postgame-player').allTextContents()).some(t=>t.includes(game.playerName)));
  await page.locator('#tvSegment').screenshot({path:path.join(root,'artifacts/tv-postgame.png')});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#tvSegment').screenshot({path:path.join(root,'artifacts/tv-postgame-mobile.png')});await page.setViewportSize({width:1100,height:1000});
  const season=stories.find(s=>s.type==='Team season review'&&labels.includes(s.headline));assert.ok(season);await page.locator('#tvStorySelect').selectOption({label:season.headline},{force:true});assert.match(await page.locator('#tvTranscript').textContent(),/points a game/);
  assert.match(await page.locator('#tvTranscript').textContent(),/planning the next step|next step for/);
  assert.match(await page.locator('#tvSegment').textContent(),/PPG/);assert.doesNotMatch(await page.locator('#tvSegment').textContent(),/\bPTS\b/);
  await page.locator('#tv').screenshot({path:path.join(root,'artifacts/dialogue-tv.png')});
  const archiveBefore=JSON.stringify(season.paragraphs);await page.reload();await page.waitForFunction(()=>!document.getElementById('saveFile').disabled);
  const archived=await page.evaluate(async id=>{const a=await new HoopWireArchive().open();try{return (await a.all('stories')).find(s=>s.id===id);}finally{a.db.close();}},season.id);assert.equal(JSON.stringify(archived.paragraphs),archiveBefore);assert.deepEqual(errors,[]);
  await page.waitForFunction(()=>document.getElementById('tvStudio').complete&&document.getElementById('tvStudio').naturalWidth>0);assert.deepEqual(blobFailures,[],'Image URLs must remain valid while loading across TV refresh');
  console.log('Dialogue browser checks passed: verified player names, familiar stats, per-game season discussion, four-host transcript integration, no page errors, and archived prose preserved on reload.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
