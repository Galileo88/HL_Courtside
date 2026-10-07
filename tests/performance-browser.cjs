/* End-to-end performance story creation, replay, and qualitative reporting. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),save=JSON.parse(fs.readFileSync(path.join(root,'sample_save'),'utf8'));
const league=save.seasonLeagues[0],year=league.season.currentYear;
save.seasonLeagues=[league];league.teams=league.teams.slice(0,2);league.freeAgents=[];league.retirees=[];league.hallOfFame=[];league.currentGame=null;
for(const [i,team] of league.teams.entries()){
 const p=team.roster[0];team.roster=[p];p.tid=team.id;p.awards=[];
 p.gameStats={GP:1,PTS:i?10:30,REB:i?2:6,AST:i?6:2,STL:i?1:3,TO:i?3:1,BLK:0,MIN:[600,600,0,0,0,0]};
 p.stats=[{yr:year,league:league.leagueType,season:[{tid:team.id,GP:11,PTS:200+p.gameStats.PTS,REB:40+p.gameStats.REB,AST:40+p.gameStats.AST,STL:20+p.gameStats.STL,TO:20+p.gameStats.TO,MIN:[6600,6600,0,0,0,0]}]}];
}
const [home,away]=league.teams;
Object.assign(league.season,{news:[],currentDay:0,phase:0,totalGames:82,playoffs:[],schedule:[{results:[{gId:99901,gameType:0,tRound:0,homeTeam:home.id,awayTeam:away.id,homeScore:30,awayScore:10,winner:home.id,potg:home.roster[0].id,homeRecord:[8,3],awayRecord:[3,8]}]}]});
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.wav':'audio/wav'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>!document.getElementById('saveFile').disabled);
  async function upload(){await page.locator('#saveFile').setInputFiles({name:'performance.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});await page.waitForFunction(()=>!document.getElementById('saveFile').disabled,null,{timeout:120000});}
  async function archived(){return page.evaluate(async()=>{const a=await new HoopWireArchive().open();try{return (await a.all('stories')).filter(s=>s.performanceSnapshot);}finally{a.db.close();}});}
  await upload();const stories=await archived();assert.equal(stories.length,2);
  const poor=stories.find(s=>s.playerId===away.roster[0].id);assert.match(poor.headline,/quiet scoring night/);
  await page.locator('.nav a[href="#tv"]').click();await page.locator('#tvStorySelect').selectOption({label:poor.headline},{force:true});
  const transcript=await page.locator('#tvTranscript').textContent();assert.match(transcript,/10 points.*20\.0/);assert.doesNotMatch(transcript,/%|percent/i);
  const table=page.locator('#tvSegment table');assert.equal(await table.locator('tbody tr').count(),5);assert.match(await table.textContent(),/This game.*Season average/);
  assert.match(await page.locator('#tvSegment').textContent(),/Featured player/);assert.doesNotMatch(await page.locator('#tvSegment').textContent(),/Player of the game/);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.ok(await table.getByRole('columnheader',{name:'Season average'}).isVisible());
  assert.ok((await table.locator('caption').boundingBox()).height<100,'Caption stays readable on phones');
  fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});await page.locator('#tvSegment').screenshot({path:path.join(root,'artifacts/performance-tv-mobile.png')});
  await upload();assert.equal((await archived()).length,2,'Reimport does not duplicate performance stories');
  await page.reload();await page.waitForFunction(()=>!document.getElementById('saveFile').disabled);
  await page.locator('.nav a[href="#tv"]').click();await page.locator('#tvStorySelect').selectOption({label:poor.headline},{force:true});
  assert.match(await page.locator('#tvTranscript').textContent(),/10 points.*20\.0/);
  assert.deepEqual(errors,[]);console.log('Performance stories, comparison table, qualitative transcript, mobile layout and archive replay passed.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
