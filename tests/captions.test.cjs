const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const window={HoopWireCore:require('../core')};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../scenes.js'),'utf8'),{window,structuredClone});
const caption=window.HoopWireScenes.caption;
const scene={kind:'interview',player:{fn:'Keith',ln:'Austin'},teammates:[{fn:'Lee',ln:'Carter'},{fn:'Sam',ln:'Jones'}],coach:{fn:'Tracy',ln:'Poole'},team:{id:1,name:'Dallas'},opponent:{id:2,name:'Kansas City'}};
const story={day:39,season:1967,gameSummary:{home:{id:1,name:'Dallas',score:100},away:{id:2,name:'Kansas City',score:90}}};
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
