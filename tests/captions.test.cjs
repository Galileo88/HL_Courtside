const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const window={HoopWireCore:require('../core')};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../scenes.js'),'utf8'),{window,structuredClone});
const caption=window.HoopWireScenes.caption;
const scene={kind:'interview',player:{fn:'Keith',ln:'Austin'},teammates:[{fn:'Lee',ln:'Carter'},{fn:'Sam',ln:'Jones'}],coach:{fn:'Tracy',ln:'Poole'},team:{id:1,name:'Dallas'},opponent:{id:2,name:'Kansas City'}};
const story={day:39,season:1967,gameSummary:{home:{id:1,name:'Dallas',score:100},away:{id:2,name:'Kansas City',score:90}}};
test('interview framing is deterministic and captions only name visible participants',()=>{
 const S=window.HoopWireScenes;
 assert.deepEqual(S.interviewDesign('story-1'),S.interviewDesign('story-1'));
 const variants=new Set(Array.from({length:100},(_,i)=>S.interviewDesign('story-'+i).variant));assert.equal(variants.size,4);
 for(const variant of ['player-close-up','player-profile']){
  const text=caption({...scene,interview:{variant}},story);
  assert.match(text,/^Keith Austin answers postgame/);assert.doesNotMatch(text,/Lee Carter|Tracy Poole|Sam Jones/);
 }
 assert.match(caption({...scene,interview:{variant:'player-coach'}},story),/^Keith Austin and Coach Tracy Poole answer/);
});
test('action portraits retain the player and ball inside a much tighter 16:9 frame',()=>{
 const S=window.HoopWireScenes;
 for(const variant of ['drive-tight','shot-close-up','pass-tight','dunk-tight']){
  for(const side of ['left','right']){
   const design=S.actionDesign('player-story',variant,side),[x,y,w,h]=design.camera;
   assert.ok(w<=112);assert.equal(w/h,16/9);
   const [px,foot]=design.subject;
   assert.ok(px-16>=x+4&&px+16<=x+w-4,'Keep the full sprite width in frame');
   assert.ok(foot-42>=y+4&&foot<=y+h-4,'Keep the head and feet in frame');
   if(design.flightBall)assert.ok(design.flightBall[0]-4>=x&&design.flightBall[0]+4<=x+w&&design.flightBall[1]-4>=y&&design.flightBall[1]+4<=y+h);
   assert.doesNotMatch(caption({...scene,kind:'action',action:design},story),/in action/);
  }
 }
});
test('interviews name the people actually shown and carry the matchup, result and date',()=>{
 assert.equal(caption(scene,story),'Keith Austin, Lee Carter and Coach Tracy Poole answer postgame questions after a win. | Dallas vs Kansas City | Day 39, 1967');
 assert.match(caption({...scene,team:scene.opponent,opponent:scene.team},story),/after a loss/);
 assert.doesNotMatch(caption(scene,story),/Sam Jones|assets|Composed|hip-height/);
 const noCoach={...scene,coach:null};assert.match(caption(noCoach,story),/Keith Austin, Lee Carter and Sam Jones/);
 const solo={...scene,coach:null,teammates:[]};assert.match(caption(solo,story),/^Keith Austin answers/);
});
test('action captions describe each pictured action and the correct opposing team',()=>{
 for(const [variant,phrase] of [['drive','drives to the basket'],['close-up','handles the ball'],['dunk','goes up for a dunk'],['three-point','takes a three-point shot'],['pass','passes to a teammate'],['pass-close-up','passes to a teammate']]){
  assert.equal(caption({...scene,kind:'action',action:{variant}},story),`Keith Austin ${phrase} against Kansas City. | Dallas vs Kansas City | Day 39, 1967`);
 }
 const losing={...scene,kind:'action',team:scene.opponent,opponent:scene.team,action:{variant:'dunk'}};assert.match(caption(losing,story),/against Dallas/);
});
test('missing context does not invent results or dates and season interviews use season wording',()=>{
 assert.doesNotMatch(caption(scene),/after a win|after a loss|Day|undefined|NaN/);
 assert.match(caption({...scene,gameContext:{result:'loss',day:39,season:1967}}),/after a loss.*Day 39, 1967/);
 const season=caption(scene,{...story,kind:'season',type:'Award announcement'});assert.match(season,/discuss the award announcement/);assert.doesNotMatch(season,/postgame|after a win|vs/);
 assert.equal(caption(null,story),null);
});
