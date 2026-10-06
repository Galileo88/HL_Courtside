/* Local, fact-based host discussions with Animalese voices. */
(() => {
  'use strict';
  const ids=['tvMute','tvPlay','tvLinePrevious','tvLineNext','tvVoice','tvDiscussionStatus','tvLiveHosts','tvBubbles','tvTranscript','tvStage','tvStagePlay'];
  const el=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
  const pitches=[1.25,.83,.65,1.45];
  const introSrc='assets/hoopwire-tv-intro.mp3',introDelayMs=1000;
  let turns=[],hosts=[],line=0,running=false,audio=null,timer=null,epoch=0,samples=null,needsIntro=true,completed=false;
  function chunks(text) {
    const result=[];let part='';
    for(const word of String(text).split(/\s+/)){if(part.length+word.length>160){result.push(part);part='';}part+=(part?' ':'')+word;}
    if(part)result.push(part);return result;
  }
  function discussion(story) {
    if(!story)return [];
    const scripted=window.HoopWireBroadcastContent?.script(story)||[
      {speaker:0,text:`Here's the latest from HoopWire: ${story.headline}.`},
      {speaker:1,text:'The headline is only the start. The important question is what changes from here.'},
      {speaker:2,text:'That is what we will be watching when the next game or league decision arrives.'},
      {speaker:3,text:'More from around the league is coming up on HoopWire TV.'}
    ];
    const result=[];
    for(const turn of scripted)chunks(turn.text).forEach(text=>result.push({speaker:turn.speaker,text}));
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
    else if(available&&!needsIntro)label='Resume episode';
    el.tvStagePlay.disabled=!available;
    el.tvStagePlay.hidden=running||!available;
    el.tvStagePlay.setAttribute('aria-label',label.replace('episode','HoopWire TV episode'));
    const text=el.tvStagePlay.querySelector('.tv-stage-play-label');
    if(text)text.textContent=label;
  }
  function stop() {
    epoch++;running=false;clearTimeout(timer);timer=null;
    if(audio){audio.onended=audio.onerror=null;audio.pause();audio.removeAttribute('src');audio=null;}
    talking(false);el.tvPlay.textContent=completed?'Replay':needsIntro?'Play':'Resume';updateStagePlay();
  }
  function beginHosts(token) {
    if(token!==epoch||!running)return;
    needsIntro=false;
    el.tvDiscussionStatus.textContent='On air in 1 second…';
    timer=setTimeout(()=>{if(token!==epoch||!running)return;show();playLine();},introDelayMs);
  }
  async function playIntro() {
    const token=epoch;
    talking(false);
    el.tvDiscussionStatus.textContent='Opening theme…';
    try {
      audio=new Audio(introSrc);
      audio.volume=.55;
      audio.muted=!el.tvVoice.checked;
      audio.onended=()=>{audio=null;beginHosts(token);};
      audio.onerror=()=>{audio=null;beginHosts(token);};
      await audio.play();
    } catch(error) {
      if(token!==epoch||!running)return;
      audio=null;
      beginHosts(token);
    }
  }
  function startPlayback() {
    if(!turns.length)return;
    if(completed){line=0;needsIntro=true;completed=false;}
    running=true;updateStagePlay();show();
    if(needsIntro)playIntro();
    else playLine();
  }
  function show() {
    el.tvBubbles.replaceChildren();
    const turn=turns[line];
    if(turn){
      const bubble=document.createElement('div');bubble.className=`tv-speech host-${turn.speaker}`;
      const name=document.createElement('strong');name.textContent=HoopWireCore.playerDisplay(hosts[turn.speaker]);
      const text=document.createElement('span');text.textContent=turn.text;bubble.append(name,text);el.tvBubbles.appendChild(bubble);
      el.tvDiscussionStatus.textContent=`Line ${line+1} of ${turns.length}`;
    }else el.tvDiscussionStatus.textContent='Choose a story to start the discussion.';
    el.tvPlay.disabled=!turn;el.tvLinePrevious.disabled=!turn||line===0;el.tvLineNext.disabled=!turn||line===turns.length-1;
    el.tvPlay.textContent=running?'Pause':completed?'Replay':needsIntro?'Play':'Resume';
    for(const [i,p] of [...el.tvTranscript.children].entries())p.classList.toggle('current-line',i===line);
    updateStagePlay();
  }
  function advance(token) {
    if(token!==epoch||!running)return;
    talking(false);
    if(line>=turns.length-1){completed=true;stop();el.tvDiscussionStatus.textContent='Discussion complete. Choose the next story when you are ready.';return;}
    timer=setTimeout(()=>{if(token!==epoch||!running)return;line++;show();playLine();},450);
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
    stop();line=0;needsIntro=true;completed=false;turns=discussion(story);hosts=studio?.inputs.announcers || HoopWireTV.inputs({teams:[]}).announcers;
    el.tvLiveHosts.replaceChildren();el.tvTranscript.replaceChildren();
    if(studio?.backdropBlob)hosts.forEach((person,i)=>{
      const slot=document.createElement('div');slot.className='tv-live-host';slot.dataset.host=i;slot.style.left=`${(70+i*220)/960*100}%`;
      const canvas=document.createElement('canvas');canvas.width=128;canvas.height=168;
      const draw=()=>{HoopWirePlayer.draw(canvas,person,null,0,0,'idle');if(i<2){const copy=document.createElement('canvas');copy.width=128;copy.height=168;copy.getContext('2d').drawImage(canvas,0,0);const c=canvas.getContext('2d');c.clearRect(0,0,128,168);c.save();c.translate(128,0);c.scale(-1,1);c.drawImage(copy,0,0);c.restore();}};
      HoopWirePlayer.ready().then(()=>{if(slot.isConnected)draw();});slot.appendChild(canvas);el.tvLiveHosts.appendChild(slot);
    });
    turns.forEach(turn=>{const p=document.createElement('p');const name=document.createElement('strong');name.textContent=HoopWireCore.playerDisplay(hosts[turn.speaker])+': ';p.append(name,document.createTextNode(turn.text));el.tvTranscript.appendChild(p);});
    show();
    if(autoplay&&turns.length)startPlayback();
  }
  el.tvPlay.addEventListener('click',()=>{if(running){stop();show();return;}startPlayback();});
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
    else if(running&&el.tvVoice.checked){clearTimeout(timer);epoch++;playLine();}
    muteLabel();
  });
  el.tvVoice.addEventListener('change',()=>{stop();muteLabel();show();});
  try {el.tvVoice.checked=localStorage.getItem('hoopwire.voices.muted')!=='true';}catch{}
  muteLabel();
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();show();}});
  window.addEventListener('pagehide',stop);
  window.HoopWireBroadcast={mount,stop,discussion,spoken,voiceSamples,voicePitches:[...pitches],introSrc,introDelayMs};
})();
