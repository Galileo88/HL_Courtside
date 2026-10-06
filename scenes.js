/* Pixel-art story scenes, composed at the game's court and player scale. */
(() => {
  "use strict";
  const art = {};
  let ready;
  function load() {
    ready ||= Promise.all([window.HoopWirePlayer.ready(), ...['press-background','press-table'].map(async name => {
      const image = new Image(); image.src = `scene-assets/${name}.png`; await image.decode(); art[name] = image;
    })]);
    return ready;
  }
  function teamSnapshot(team) {
    return structuredClone({id:team?.id,city:team?.city,name:team?.name,shortName:team?.shortName,
      logoURL:team?.logoURL || null,teamColors:team?.teamColors,uniforms:team?.uniforms,court:team?.court});
  }
  function playerSnapshot(player) {
    if (!player) return null;
    return structuredClone({id:player.id,tid:player.tid,fn:player.fn,ln:player.ln,num:player.num,
      appearance:player.appearance,accessories:player.accessories});
  }
  function sceneKind(id, verified) {
    return verified ? window.HoopWireCore.choose(id,['action','interview','action'],'scene-kind') : 'action';
  }
  const actionVariants=['drive','close-up','dunk','three-point','pass','pass-close-up'];
  function actionDesign(seed, variant, side) {
    variant=actionVariants.includes(variant)?variant:window.HoopWireCore.choose(seed,actionVariants,'action-variant');
    const layouts={
      drive:{label:'Drive to the basket',pose:'dribbling',frame:1,camera:[510,94,384,216],subject:[695,270],support:[[615,192],[641,291],[684,185],[762,249],[783,299]]},
      'close-up':{label:'Close-up ball handling',pose:'dribbling',frame:1,camera:[626,176,192,108],subject:[695,270],support:[[649,235],[755,265],[672,217],[750,245],[790,275]]},
      dunk:{label:'Dunk approach',pose:'dunking',frame:0,camera:[688,148,192,108],subject:[778,216],groundFoot:276,support:[[714,228],[734,254],[720,204],[813,249],[847,247]]},
      'three-point':{label:'Three-point shot',pose:'shooting',frame:4,camera:[576,158,256,144],subject:[610,250],groundFoot:256,flightBall:[636,204],support:[[717,205],[738,286],[662,251],[762,249],[791,290]]},
      pass:{label:'Passing to a teammate',pose:'passing',frame:2,camera:[576,158,256,144],subject:[665,254],flightBall:[694,236],support:[[760,264],[702,201],[713,216],[780,283],[791,208]]},
      'pass-close-up':{label:'Close-up passing',pose:'passing',frame:2,camera:[620,172,192,108],subject:[665,254],flightBall:[694,236],support:[[760,264],[702,201],[713,216],[787,273],[791,208]]}
    };
    side=['left','right'].includes(side)?side:window.HoopWireCore.choose(seed,['left','right'],'court-side');
    const action={variant,side,...structuredClone(layouts[variant])};
    if(side==='left') {
      action.camera[0]=1024-action.camera[0]-action.camera[2];
      action.subject[0]=1024-action.subject[0];
      action.support.forEach(point=>point[0]=1024-point[0]);
      if(action.flightBall)action.flightBall[0]=1024-action.flightBall[0];
    }
    return action;
  }
  function upgrade(scene, story, context) {
    const saved = structuredClone(scene);
    const enriched = context ? inputs(context,story.id) : {};
    const action=actionDesign(story.id);
    return {...saved,version:6,seed:story.id,attackDirection:action.side,action,
      ball:saved.ball || enriched.ball || {pri:'E37033',sec:'E37033',ter:'E37033',outline:'44220F'},
      teammates:saved.teammates || enriched.teammates || [],
      opponents:saved.opponents || enriched.opponents || (saved.opponentPlayer ? [saved.opponentPlayer] : []),
      coach:saved.coach || enriched.coach || story.coach || null,
      kind:sceneKind(story.id,!!story.playerStats),
      pose:action.pose};
  }
  function inputs(ctx, id) {
    const C = window.HoopWireCore;
    const team = ctx.potgSnapshot?.team || ctx.winner;
    const opponent = team?.id === ctx.loser?.id ? ctx.winner : ctx.loser;
    const liveTeam = team?.id === ctx.loser?.id ? ctx.loser : ctx.winner;
    const featured = ctx.potg || ctx.scenePlayer;
    const teammates = (liveTeam?.roster || []).filter(p => p.id !== featured?.id).sort((a,b) => a.id-b.id).slice(0,2).map(playerSnapshot);
    const action=actionDesign(id);
    return {version:6,seed:id,attackDirection:action.side,action,ball:structuredClone(ctx.gameBall),kind:sceneKind(id,ctx.potgStatsTrusted),
      pose:action.pose,
      player:playerSnapshot(ctx.potg || ctx.scenePlayer),team:teamSnapshot(team),opponent:teamSnapshot(opponent),
      opponentPlayer:playerSnapshot(opponent?.roster?.[0]),
      opponents:(opponent?.roster || []).slice(0,3).map(playerSnapshot),
      uniformIndex:team?.id === ctx.game.homeTeam ? 0 : 1,
      opponentUniformIndex:opponent?.id === ctx.game.homeTeam ? 0 : 1,
      teammates,coach:C.coachForTeam(liveTeam),
      home:teamSnapshot(ctx.home)};
  }
  function player(ctx,data,team,uniform,x,y,size,pose='idle',frame=0,facing='left',ball={}) {
    if (!data) return;
    const tile = document.createElement('canvas'); tile.width=128; tile.height=168;
    window.HoopWirePlayer.draw(tile,data,team,uniform,frame,pose,facing,ball);
    ctx.drawImage(tile,x,y,size,size*42/32);
  }
  async function render(scene) {
    await load();
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=432;
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
    let customCourt=null;
    if (scene.kind === 'interview') {
      ctx.fillStyle='#162b49';ctx.fillRect(0,0,768,432);
      ctx.save();ctx.scale(2,2);ctx.fillStyle=ctx.createPattern(art['press-background'],'repeat');ctx.fillRect(0,0,384,216);ctx.restore();
      const left = scene.teammates?.[0], right = scene.coach || scene.teammates?.[1];
      const group = !!(left || right);
      if (group) {
        player(ctx,left,scene.team,scene.uniformIndex,56,104,192);
        player(ctx,scene.player,scene.team,scene.uniformIndex,288,104,192);
        player(ctx,right,scene.team,scene.uniformIndex,520,104,192);
      } else player(ctx,scene.player,scene.team,scene.uniformIndex,256,76,256);
      // Account for the source table's 11-pixel gap before its surface.
      // Align that surface with the hips for both solo and group compositions.
      const tableY = group ? 218 : 250;
      // Keep props in the editable table asset so custom art displays intact.
      ctx.drawImage(art['press-table'],0,tableY,768,192);
      if (group) ctx.drawImage(art['press-table'],0,31,128,1,0,410,768,22);
    } else {
      const floor=await window.HoopWireCourt.render(scene.home || scene.team,{includeHoops:false});
      customCourt=floor.customCourt;
      const world=document.createElement('canvas');world.width=2048;world.height=1024;
      const game=world.getContext('2d');game.imageSmoothingEnabled=false;
      game.scale(2,2);game.drawImage(floor.canvas,0,0);
      // Native player sprites are 32 x 42, on the native 1024 x 512 court.
      // Compose directly at 2x so the finer native number layer survives.
      // The close crop preserves court geometry and keeps players in proportion.
      const action=scene.action || actionDesign(scene.seed,'drive');
      const attack=action.side || scene.attackDirection || 'right',defense=attack==='right'?'left':'right';
      function actor(data,team,uniform,x,foot,pose,frame,groundFoot=foot) {
        if(!data)return;
        player(game,data,team,uniform,x-16,foot-42,32,pose,frame,team?.id===scene.team?.id?attack:defense,scene.ball);
      }
      const actors=[
        [scene.teammates?.[0],scene.team,scene.uniformIndex,...action.support[0],'idle',0],
        [scene.teammates?.[1],scene.team,scene.uniformIndex,...action.support[1],'idle',0],
        [scene.opponents?.[1],scene.opponent,scene.opponentUniformIndex,...action.support[2],'idle',0],
        [scene.opponents?.[0] || scene.opponentPlayer,scene.opponent,scene.opponentUniformIndex,...action.support[3],'idle',0],
        [scene.player,scene.team,scene.uniformIndex,...action.subject,scene.pose || action.pose,action.frame,action.groundFoot || action.subject[1]],
        [scene.opponents?.[2],scene.opponent,scene.opponentUniformIndex,...action.support[4],'idle',0]
      ];
      // Shadows stay on the floor. Bodies and hoop structures share the same
      // ground-depth ordering, including the ground point of airborne players.
      for(const args of actors){if(!args[0])continue;game.fillStyle='#00000033';game.beginPath();game.ellipse(args[3],(args[7]??args[4])-2,11,4,0,0,Math.PI*2);game.fill();}
      const layers=actors.map(args=>({depth:args[7]??args[4],order:0,draw:()=>actor(...args)}));
      layers.push(...floor.hoopLayers.map(layer=>({...layer,order:1,draw:()=>layer.draw(game)})));
      layers.sort((a,b)=>a.depth-b.depth || a.order-b.order).forEach(layer=>layer.draw());
      if(action.flightBall){const ball=document.createElement('canvas');ball.width=ball.height=16;window.HoopWirePlayer.drawBall(ball,scene.ball);game.drawImage(ball,action.flightBall[0]-4,action.flightBall[1]-4,8,8);}
      const [x,y,w,h]=action.camera;ctx.drawImage(world,x*2,y*2,w*2,h*2,0,0,768,432);
    }
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not compose the article image.')),'image/png'));
    const C=window.HoopWireCore, subject=scene.player?C.playerDisplay(scene.player):C.teamDisplay(scene.team);
    const groupNote = scene.coach ? ` • Coach ${C.playerDisplay(scene.coach)}` : '';
    const courtNote=customCourt?.status === 'loaded' ? ` • ${C.teamDisplay(scene.home)} custom court` :
      customCourt?.status === 'unavailable' ? ' • Custom court image unavailable; saved court layout used' : '';
    return {imageBlob:blob,sceneInputs:scene,customCourt,
      imageAlt:scene.kind === 'interview' ? `${subject} behind a hip-height table in a composed postgame interview${scene.teammates?.length ? ` with teammate ${C.playerDisplay(scene.teammates[0])}` : ''}${scene.coach ? ` and head coach ${C.playerDisplay(scene.coach)}` : ''}, wearing ${C.teamDisplay(scene.team)} colors.` :
        `Composed ${scene.action?.label || 'basketball action'} illustration featuring ${C.teamDisplay(scene.team)} and ${C.teamDisplay(scene.opponent)} on ${C.teamDisplay(scene.home)}'s court; this does not document a specific play.`,
      imageCaption:scene.kind === 'interview' ? `Composed postgame interview scene • ${subject}${groupNote} • Hoop Land assets` :
        `Composed action illustration • ${scene.action?.label || 'Basketball action'} • Hoop Land assets${courtNote} • Illustrative scene`};
  }
  window.HoopWireScenes={inputs,render,upgrade,sceneKind,actionDesign,actionVariants};
})();
