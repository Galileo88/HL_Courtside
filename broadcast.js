/* Local, fact-based host discussions with Animalese voices. */
(() => {
  'use strict';
  const ids=['tvMute','tvPlay','tvLinePrevious','tvLineNext','tvVoice','tvDiscussionStatus','tvLiveHosts','tvBubbles','tvTranscript','tvStage','tvStagePlay','tvIntro'];
  const el=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
  const pitches=[1.25,.83,.65,1.45];
  const introSrc='assets/hoopwire-tv-intro.mp3',introLeadMs=8500;
  let turns=[],hosts=[],line=0,running=false,audio=null,introAudio=null,outroAudio=null,timer=null,epoch=0,samples=null,needsIntro=true,completed=false;
  let introElapsed=0,introDuration=introLeadMs,introFrame=null,introAnimations=[],outroActive=false;
  function introVisible(value){el.tvIntro.hidden=!value;el.tvStage.classList.toggle('is-intro',value);}
  function settleLogo(){
    cancelAnimationFrame(introFrame);introFrame=null;
    introAnimations.forEach(a=>a.cancel());introAnimations=[];
    introElapsed=0;introDuration=introLeadMs;
    outroActive=false;updateStagePlay();
  }
  function clearIntro(){
    settleLogo();
    el.tvIntro.classList.remove('is-outro');
    el.tvIntro.querySelector('.tv-intro-eyebrow').textContent='THE DAILY DESK';
    el.tvIntro.querySelector('.tv-intro-tagline').textContent='THE GAME. THE STORIES. THE CONVERSATION.';
    introVisible(false);
  }
  function animateIntro(){
    if(introAnimations.length||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const animate=(selector,frames)=>{const a=el.tvIntro.querySelector(selector).animate(frames,{duration:10000,fill:'both',easing:'linear'});a.pause();a.currentTime=0;introAnimations.push(a);};
    animate('.tv-intro-grid',[{transform:'rotate(-12deg) scale(1.1)'},{transform:'rotate(-12deg) scale(1)'}]);
    animate('.tv-intro-orbit',[{opacity:0,transform:'scale(.7)',offset:0},{opacity:.5,transform:'scale(1)',offset:.3},{opacity:.25,transform:'scale(1.1)',offset:1}]);
    animate('.slash-one',[{transform:'translateX(-160%) skewX(-20deg)',offset:0},{transform:'translateX(0) skewX(-20deg)',offset:.18},{transform:'translateX(0) skewX(-20deg)',offset:.9},{transform:'translateX(350%) skewX(-20deg)',offset:1}]);
    animate('.slash-two',[{transform:'translateX(160%) skewX(-20deg)',offset:0},{transform:'translateX(0) skewX(-20deg)',offset:.22},{transform:'translateX(0) skewX(-20deg)',offset:.9},{transform:'translateX(-350%) skewX(-20deg)',offset:1}]);
    animate('.tv-intro-brand',[{opacity:0,transform:'translateY(20px) scale(1.12)',offset:0},{opacity:0,transform:'translateY(20px) scale(1.12)',offset:.1},{opacity:1,transform:'translateY(0) scale(1)',offset:.3},{opacity:1,transform:'translateY(0) scale(1)',offset:.92},{opacity:0,transform:'translateY(0) scale(.96)',offset:1}]);
    animate('.tv-intro-logo',[{clipPath:'inset(0 100% 0 0)',offset:0},{clipPath:'inset(0 100% 0 0)',offset:.14},{clipPath:'inset(0 0% 0 0)',offset:.34},{clipPath:'inset(0 0% 0 0)',offset:1}]);
    animate('.tv-intro-tagline',[{opacity:0,transform:'translateY(8px)',offset:0},{opacity:0,transform:'translateY(8px)',offset:.34},{opacity:1,transform:'translateY(0)',offset:.46},{opacity:1,transform:'translateY(0)',offset:1}]);
    animate('.tv-intro-wipe',[{transform:'translateX(-130%) skewX(-18deg)',offset:0},{transform:'translateX(-130%) skewX(-18deg)',offset:.9},{transform:'translateX(0%) skewX(-18deg)',offset:1}]);
    animate('.tv-intro-progress',[{transform:'scaleX(0)'},{transform:'scaleX(1)'}]);
  }
  function introTick(token,media=null,closing=false){
    const started=performance.now(),resumeAt=introElapsed;
    const tick=()=>{
      if(token!==epoch||(closing?!completed:!running||!needsIntro))return;
      if(media&&Number.isFinite(media.duration)&&media.duration>0)introDuration=media.duration*1000;
      introElapsed=media?media.currentTime*1000:resumeAt+performance.now()-started;
      const progress=Math.min(1,introElapsed/introDuration);
      introAnimations.forEach(a=>{a.currentTime=progress*10000;});
      if(!media&&progress>=1){if(closing)settleLogo();else beginHosts(token);return;}
      introFrame=requestAnimationFrame(tick);
    };
    tick();
  }
  function discussion(story) {
    if(!story)return [];
    const scripted=window.HoopWireBroadcastContent?.episode(story,hosts.length?hosts.map(h=>HoopWireCore.playerDisplay(h)):undefined)||[
      {speaker:0,text:story.headline}
    ];
    const result=[];
    for(const turn of scripted){
      const chunks=window.HoopWireBroadcastContent?.chunkDialogue(turn.text)||[turn.text];
      chunks.forEach((text,i)=>result.push({speaker:turn.speaker,text,continuation:i>0}));
    }
    return result;
  }
  function spoken(text) {
    const ones=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
    const tens=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
    const number=n=>n<20?ones[n]:n<100?tens[Math.floor(n/10)]+(n%10?' '+ones[n%10]:''):n<1000?ones[Math.floor(n/100)]+' hundred'+(n%100?' '+number(n%100):''):String(n).split('').map(d=>ones[Number(d)]).join(' ');
    return text.replace(/(\d+)[–-](\d+)/g,'$1 to $2').replace(/\d+/g,n=>number(Number(n)));
  }
  function voiceSamples() {
    if(!samples)samples=new Promise((resolve,reject)=>{
      let synth;
      synth=new Animalese('vendor/animalese/animalese.wav',()=>resolve(synth),reject);
    }).catch(error=>{samples=null;throw error;});
    return samples;
  }
  function talking(value) {
    for(const host of el.tvLiveHosts.children)host.classList.toggle('is-speaking',value&&Number(host.dataset.host)===turns[line]?.speaker);
    el.tvStage.classList.toggle('is-talking',value);
  }
  function updateStagePlay() {
    if(!el.tvStagePlay)return;
    const available=turns.length>0;
    let label='Play episode';
    if(available&&completed)label='Replay episode';
    else if(available&&(!needsIntro||introElapsed>0))label='Resume episode';
    el.tvStagePlay.disabled=!available;
    el.tvStagePlay.hidden=running||!available||outroActive;
    el.tvStagePlay.setAttribute('aria-label',label.replace('episode','HoopWire TV episode'));
    const text=el.tvStagePlay.querySelector('.tv-stage-play-label');
    if(text)text.textContent=label;
  }
  function stop(resetIntro=true) {
    epoch++;running=false;clearTimeout(timer);timer=null;
    cancelAnimationFrame(introFrame);introFrame=null;
    if(audio){audio.onended=audio.onerror=null;audio.pause();audio.removeAttribute('src');audio=null;}
    if(outroAudio){outroAudio.onended=outroAudio.onerror=null;outroAudio.pause();outroAudio.removeAttribute('src');outroAudio=null;}
    if(introAudio){introElapsed=introAudio.currentTime*1000;introAudio.onended=introAudio.onerror=null;introAudio.pause();if(resetIntro){introAudio.removeAttribute('src');introAudio=null;}}
    if(resetIntro)clearIntro();
    else if(completed)settleLogo();
    talking(false);el.tvPlay.textContent=completed?'Replay':needsIntro?'Play':'Resume';updateStagePlay();
  }
  function beginHosts(token) {
    if(token!==epoch||!running||!needsIntro)return;
    clearTimeout(timer);timer=null;
    if(introAudio){introAudio.onended=introAudio.onerror=null;introAudio.pause();introAudio=null;}
    clearIntro();
    needsIntro=false;
    show();playLine();
  }
  async function playIntro() {
    const token=epoch;
    talking(false);
    introVisible(true);animateIntro();
    el.tvDiscussionStatus.textContent='Opening theme…';
    try {
      introAudio ||= new Audio(introSrc);
      const media=introAudio;
      introAudio.volume=.55;
      introAudio.muted=!el.tvVoice.checked;
      media.onended=()=>beginHosts(token);
      media.onerror=()=>{if(token!==epoch||!running)return;media.pause();media.onended=media.onerror=null;introAudio=null;cancelAnimationFrame(introFrame);introTick(token);};
      await media.play();
      if(token!==epoch||!running)return;
      introTick(token,media);
    } catch(error) {
      if(token!==epoch||!running)return;
      if(introAudio){introAudio.pause();introAudio.onended=introAudio.onerror=null;introAudio=null;}
      cancelAnimationFrame(introFrame);introTick(token);
    }
  }
  async function playOutro() {
    const token=epoch,media=new Audio(introSrc);
    outroActive=true;updateStagePlay();
    animateIntro();
    outroAudio=media;media.volume=.55;media.muted=!el.tvVoice.checked;
    const release=()=>{media.onended=media.onerror=null;media.pause();outroAudio=null;};
    media.onended=()=>{if(token!==epoch||outroAudio!==media)return;release();settleLogo();};
    const fallback=()=>{
      if(token!==epoch||outroAudio!==media)return;
      release();cancelAnimationFrame(introFrame);introTick(token,null,true);
    };
    media.onerror=fallback;
    try {await media.play();if(token===epoch&&outroAudio===media)introTick(token,media,true);}catch {fallback();}
  }
  function startPlayback() {
    if(!turns.length)return;
    if(completed){stop();line=0;needsIntro=true;completed=false;}
    running=true;updateStagePlay();show();
    if(needsIntro)playIntro();
    else playLine();
  }
  function show() {
    el.tvBubbles.replaceChildren();
    el.tvBubbles.hidden=needsIntro||completed;
    const turn=turns[line];
    if(turn){
      if(!needsIntro&&!completed){
        const bubble=document.createElement('div');bubble.className=`tv-speech host-${turn.speaker}`;
        const name=document.createElement('strong');name.textContent=HoopWireCore.playerDisplay(hosts[turn.speaker]);
        const text=document.createElement('span');text.textContent=turn.text;bubble.append(name,text);el.tvBubbles.appendChild(bubble);
      }
      el.tvDiscussionStatus.textContent=`Line ${line+1} of ${turns.length}`;
    }else el.tvDiscussionStatus.textContent='Choose a story to start the discussion.';
    el.tvPlay.disabled=!turn;el.tvLinePrevious.disabled=!turn||needsIntro||line===0;el.tvLineNext.disabled=!turn||needsIntro||line===turns.length-1;
    el.tvPlay.textContent=running?'Pause':completed?'Replay':needsIntro&&introElapsed===0?'Play':'Resume';
    if(needsIntro&&!el.tvIntro.hidden)el.tvDiscussionStatus.textContent=running?'Opening theme…':introElapsed>0?'Opening theme paused.':'Play episode to start the show.';
    if(completed)el.tvDiscussionStatus.textContent='Episode complete. Replay or choose the next story.';
    for(const [i,p] of [...el.tvTranscript.children].entries())p.classList.toggle('current-line',i===line);
    updateStagePlay();
  }
  function advance(token) {
    if(token!==epoch||!running)return;
    talking(false);
    if(line>=turns.length-1){
      completed=true;stop();el.tvBubbles.replaceChildren();el.tvBubbles.hidden=true;
      introVisible(true);el.tvIntro.classList.add('is-outro');
      el.tvIntro.querySelector('.tv-intro-eyebrow').textContent='THANKS FOR WATCHING';
      el.tvIntro.querySelector('.tv-intro-tagline').textContent='SEE YOU NEXT TIME ON THE DAILY DESK';
      el.tvDiscussionStatus.textContent='Episode complete. Replay or choose the next story.';
      playOutro();
      return;
    }
    timer=setTimeout(()=>{if(token!==epoch||!running)return;line++;show();playLine();},turns[line+1]?.continuation?0:450);
  }
  async function playLine() {
    const token=epoch,turn=turns[line];
    try {
      if(el.tvVoice.checked){
        el.tvDiscussionStatus.textContent='Preparing voice…';
        const synth=await voiceSamples();if(token!==epoch||!running)return;
        const wav=synth.Animalese(spoken(turn.text),true,pitches[turn.speaker]);
        audio=new Audio(wav.dataURI);audio.volume=.38;audio.muted=!el.tvVoice.checked;
        audio.onended=()=>advance(token);
        audio.onerror=()=>{if(token!==epoch)return;stop();el.tvDiscussionStatus.textContent='Voice playback failed. Turn off Animalese voices to continue with speech bubbles.';};
        await audio.play();if(token!==epoch||!running)return;
        el.tvDiscussionStatus.textContent=`Line ${line+1} of ${turns.length}`;talking(true);
      }else{talking(true);timer=setTimeout(()=>advance(token),Math.max(2500,Math.min(8500,turn.text.length*45)));}
    }catch(error){if(token!==epoch||!running)return;audio?.pause();audio=null;el.tvDiscussionStatus.textContent='Voice unavailable; continuing with speech bubbles.';talking(true);timer=setTimeout(()=>advance(token),Math.max(2500,Math.min(8500,turn.text.length*45)));}
  }
  function mount(story,studio,autoplay=false) {
    stop();line=0;needsIntro=true;completed=false;hosts=studio?.inputs.announcers || HoopWireTV.inputs({teams:[]}).announcers;turns=discussion(story);
    el.tvLiveHosts.replaceChildren();el.tvTranscript.replaceChildren();
    if(studio?.backdropBlob)hosts.forEach((person,i)=>{
      const slot=document.createElement('div');slot.className='tv-live-host';slot.dataset.host=i;slot.style.left=`${(70+i*220)/960*100}%`;
      const canvas=document.createElement('canvas');canvas.width=128;canvas.height=168;
      const draw=()=>{HoopWirePlayer.draw(canvas,person,null,0,0,'idle');if(i<2){const copy=document.createElement('canvas');copy.width=128;copy.height=168;copy.getContext('2d').drawImage(canvas,0,0);const c=canvas.getContext('2d');c.clearRect(0,0,128,168);c.save();c.translate(128,0);c.scale(-1,1);c.drawImage(copy,0,0);c.restore();}};
      HoopWirePlayer.ready().then(()=>{if(slot.isConnected)draw();});slot.appendChild(canvas);el.tvLiveHosts.appendChild(slot);
    });
    turns.forEach(turn=>{const p=document.createElement('p');const name=document.createElement('strong');name.textContent=HoopWireCore.playerDisplay(hosts[turn.speaker])+': ';p.append(name,document.createTextNode(turn.text));el.tvTranscript.appendChild(p);});
    introVisible(turns.length>0);
    show();
    if(autoplay&&turns.length)startPlayback();
  }
  el.tvPlay.addEventListener('click',()=>{if(running){stop(false);show();return;}startPlayback();});
  el.tvStagePlay.addEventListener('click',startPlayback);
  el.tvLinePrevious.addEventListener('click',()=>{stop();completed=false;needsIntro=false;line=Math.max(0,line-1);show();});
  el.tvLineNext.addEventListener('click',()=>{stop();completed=false;needsIntro=false;line=Math.min(turns.length-1,line+1);show();});
  function muteLabel() {
    const label=el.tvVoice.checked?'Mute voices':'Unmute voices';
    const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');icon.textContent=el.tvVoice.checked?'🔊':'🔇';
    el.tvMute.replaceChildren(icon);el.tvMute.setAttribute('aria-label',label);el.tvMute.title=label;
    el.tvMute.setAttribute('aria-pressed',String(!el.tvVoice.checked));
  }
  el.tvMute.addEventListener('click',()=>{
    el.tvVoice.checked=!el.tvVoice.checked;
    try {localStorage.setItem('hoopwire.voices.muted',String(!el.tvVoice.checked));}catch{}
    if(audio)audio.muted=!el.tvVoice.checked;
    if(introAudio)introAudio.muted=!el.tvVoice.checked;
    if(outroAudio)outroAudio.muted=!el.tvVoice.checked;
    if(!audio&&!introAudio&&running&&el.tvVoice.checked&&!needsIntro){clearTimeout(timer);epoch++;playLine();}
    muteLabel();
  });
  el.tvVoice.addEventListener('change',()=>{stop();muteLabel();show();});
  try {el.tvVoice.checked=localStorage.getItem('hoopwire.voices.muted')!=='true';}catch{}
  muteLabel();
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop(false);show();}});
  window.addEventListener('pagehide',()=>stop());
  window.HoopWireBroadcast={mount,stop,discussion,spoken,voiceSamples,voicePitches:[...pitches],introSrc,introLeadMs};
})();
