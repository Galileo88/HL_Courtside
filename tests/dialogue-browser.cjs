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
  await page.waitForFunction(()=>!document.getElementById('saveFile').disabled);
  const captions=await page.locator('.article-image figcaption').allTextContents();assert.ok(captions.length>0);assert.ok(captions.every(c=>!/(?:Composed|Hoop Land assets|Illustrative scene)/.test(c)));assert.ok(captions.some(c=>/\| Day \d+, \d+/.test(c)));
  await page.locator('.nav a[href="#tv"]').click();
  const stories=await page.evaluate(async()=>{const a=await new HoopWireArchive().open();try{return await a.all('stories');}finally{a.db.close();}});
  const labels=await page.locator('#tvStorySelect option').allTextContents(),game=stories.find(s=>s.playerStats&&s.playerName&&labels.includes(s.headline));assert.ok(game,'A verified named game is available in TV');
  await page.locator('#tvStorySelect').selectOption({label:game.headline},{force:true});
  const transcript=await page.locator('#tvTranscript').textContent();assert.ok(transcript.includes(game.playerName));assert.match(transcript,/points.*rebounds.*assists/);assert.doesNotMatch(transcript,/context matters|interesting part is how|next decision/);
  assert.match(transcript,/What stands out beyond the points|how would you evaluate/);assert.match(transcript,/Let's take that to the next matchup/);
  const chunks=await page.evaluate(story=>HoopWireBroadcast.discussion(story),game);assert.ok(chunks.some(t=>t.continuation));
  for(let i=0;i<chunks.length;i++)if(chunks[i].continuation){assert.equal(chunks[i].speaker,chunks[i-1].speaker);assert.ok(chunks[i].text.split(/\s+/).length>=5);}
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
  await page.clock.install();
  const delays=await page.evaluate(()=>{
   window.Audio=class{constructor(src){window.testAudio=this;this.src=src;this.currentTime=0;this.duration=10;}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}removeAttribute(){}};
   const text='basketball '.repeat(14)+'tonight.';
   HoopWireBroadcastContent.episode=()=>[{speaker:0,text},{speaker:1,text:'Now let me respond to that point.'}];
   document.getElementById('tvVoice').checked=false;HoopWireBroadcast.mount({headline:'Chunk timing'},null);
   return HoopWireBroadcastContent.chunkDialogue(text).map(c=>Math.max(2800,Math.min(9800,c.length*52)));
  });
  await page.locator('#tvStagePlay').click();await page.evaluate(()=>testAudio.onended());
  await page.clock.runFor(1000);await page.locator('#tvStage').click({position:{x:100,y:100}});const frozen=await page.locator('.tv-speech').textContent();
  await page.clock.runFor(10000);assert.equal(await page.locator('.tv-speech').textContent(),frozen);assert.equal(await page.locator('.is-speaking').count(),0);
  await page.locator('#tvStage').focus();await page.keyboard.press('Space');await page.clock.runFor(delays[0]-1300);assert.match(await page.locator('#tvDiscussionStatus').textContent(),/Line 1 of 3/,'Silent reading time should resume where it paused');
  await page.clock.runFor(305);assert.match(await page.locator('#tvDiscussionStatus').textContent(),/Line 2 of 3/);
  await page.clock.runFor(delays[1]);assert.match(await page.locator('#tvDiscussionStatus').textContent(),/Line 2 of 3/,'Host handoff should retain its pause');
  await page.clock.runFor(450);assert.match(await page.locator('#tvDiscussionStatus').textContent(),/Line 3 of 3/);assert.deepEqual(errors,[]);
  await page.evaluate(()=>{HoopWireBroadcastContent.episode=()=>[{speaker:0,text:'Take care of the ball and make the next possession count.'}];document.getElementById('tvVoice').checked=true;HoopWireBroadcast.mount({headline:'Voice pace'},null);});
  await page.locator('#tvStagePlay').click();await page.evaluate(()=>testAudio.onended());await page.waitForFunction(()=>testAudio.src.startsWith('data:'));
  assert.equal(await page.evaluate(()=>testAudio.playbackRate),.9);assert.equal(await page.evaluate(()=>testAudio.preservesPitch),true);
  await page.evaluate(()=>{window.speechAudio=testAudio;speechAudio.currentTime=1.25;});await page.locator('#tvStage').click({position:{x:100,y:100}});assert.equal(await page.evaluate(()=>speechAudio.paused),true);
  await page.locator('#tvStagePlay').click();assert.equal(await page.evaluate(()=>testAudio===speechAudio&&speechAudio.currentTime===1.25&&!speechAudio.paused),true);
  await page.locator('#tvMute span').click();assert.equal(await page.evaluate(()=>speechAudio.muted&&!speechAudio.paused),true);assert.equal(await page.locator('#tvStagePlay').isVisible(),false);
  await page.locator('#tvMute span').click();assert.equal(await page.evaluate(()=>!speechAudio.muted&&!speechAudio.paused),true);assert.equal(await page.locator('#tvStagePlay').isVisible(),false);
  await page.locator('#tvStage').click({position:{x:100,y:100}});await page.locator('#tvMute span').click();assert.equal(await page.evaluate(()=>speechAudio.muted&&speechAudio.paused),true);assert.equal(await page.locator('#tvStagePlay').isVisible(),true);
  await page.locator('#tvMute span').click();assert.equal(await page.evaluate(()=>!speechAudio.muted&&speechAudio.paused),true);assert.equal(await page.locator('#tvStagePlay').isVisible(),true);
  assert.equal(await page.locator('#tvMute').evaluate(e=>getComputedStyle(e).fontSize),'22px');assert.equal(await page.locator('#tvMute').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');assert.deepEqual(errors,[]);
  const leaders=stories.find(s=>s.type==='Season leaders');assert.ok(leaders);
  await page.evaluate(async id=>{const a=await new HoopWireArchive().open();try{const story=await a.get('stories',id),row=story.seasonSnapshot.rows.find(r=>r[0]==='PTS'),type=story.seasonSnapshot.leagueType;story.seasonSnapshot.leaderHonors=[{...HoopWireSeason.honorHistory(row[1],'the scoring title',[{league:type,yearsWon:[story.season-2,story.season-1,story.season]}],type,story.season),category:'PTS'}];await a.write({stories:[{...story,editorialVersion:3,paragraphs:story.seasonSnapshot.rows.map(r=>`${r[1]} led the league with ${(r[2]/r[3]).toFixed(1)} ${r[0]} per game.`)}]});}finally{a.db.close();}},leaders.id);
  await page.reload();await page.waitForFunction(()=>!document.getElementById('saveFile').disabled);await page.evaluate(()=>{location.hash='#stories';});await page.locator('#feed').waitFor({state:'visible'});await page.locator('#archiveLeague').selectOption(leaders.fingerprint,{force:true});await page.locator('#archiveSeason').selectOption(String(leaders.season),{force:true});await page.locator('#archiveDay').selectOption(String(leaders.day),{force:true});
  const article=page.locator('.article-card').filter({has:page.getByRole('heading',{name:leaders.headline,exact:true})});assert.equal(await article.locator('.article-body p').count(),2);assert.doesNotMatch(await article.locator('.article-body').textContent(),/led the league with/);assert.match(await article.locator('.article-body').textContent(),/scoring title for the third time.*3 straight wins/);
  await article.screenshot({path:path.join(root,'artifacts/season-leaders-article.png')});assert.deepEqual(errors,[]);
  console.log('Dialogue browser checks passed: verified player names, familiar stats, per-game season discussion, four-host transcript integration, no page errors, and archived prose preserved on reload.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
