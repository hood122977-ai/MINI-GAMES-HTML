/* Shared offline controls. No requests, libraries or account connection. */
window.Arcade=(()=>{
 const $=id=>document.getElementById(id), keys=new Set();let audio=null,sound=false,muted=false;
 const best=(key,value)=>{try{const old=Number(localStorage.getItem('hs-'+key))||0;if(value>old)localStorage.setItem('hs-'+key,value);return Math.max(old,value||0);}catch{return value||0;}};
 const beep=(freq=440,duration=.07,type='sine',volume=.035)=>{if(!sound||muted)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{}};
 const physical=new Set(),pointers=new Map(),gameCodes=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyF','KeyE','KeyP','Escape']);
 const sync=()=>{keys.clear();for(const key of physical)keys.add(key);for(const key of pointers.values())keys.add(key);const canvas=$('game');if(canvas)canvas.dataset.inputKeys=[...keys].filter(key=>gameCodes.has(key)).join(' ');};
 const release=()=>{physical.clear();pointers.clear();sync();};
 const controlCode=e=>(e.code&&e.code!=='Unidentified'?e.code:null)||({' ':'Space',ArrowUp:'ArrowUp',ArrowDown:'ArrowDown',ArrowLeft:'ArrowLeft',ArrowRight:'ArrowRight'}[e.key])||(/^\w$/.test(e.key||'')?'Key'+e.key.toUpperCase():'');
 const down=(code,repeat=false)=>{if(!gameCodes.has(code)||repeat&&!physical.has(code))return;physical.add(code);sync();};
 const up=e=>{if(e.arcadeVirtual)return;physical.delete(controlCode(e));sync();};
 document.addEventListener('keydown',e=>{if(e.arcadeVirtual)return;if(e.ctrlKey||e.metaKey||e.altKey){release();return;}if(e.target.matches?.('input,select,textarea,a')||e.target.isContentEditable)return;const code=controlCode(e);if(code==='Space'&&e.target.matches?.('button'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(code))e.preventDefault();down(code,e.repeat);},true);
 document.addEventListener('keyup',up,true);window.addEventListener('keyup',up,true);
 for(const event of ['blur','pagehide'])window.addEventListener(event,release);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
 document.addEventListener('pointerlockchange',release);
 const virtual=(type,key,repeat=false)=>{const e=new KeyboardEvent(type,{code:key,key:key==='Space'?' ':key,bubbles:true,repeat});Object.defineProperty(e,'arcadeVirtual',{value:true});document.dispatchEvent(e);};
 const endPointer=e=>{const key=pointers.get(e.pointerId);if(!key)return;pointers.delete(e.pointerId);sync();virtual('keyup',key);};
 // Pointer capture can be cancelled by mouse lock or by an embedded viewer.
 // Observe releases outside the button as well as releases on the button.
 for(const target of [document,window])for(const type of ['pointerup','pointercancel'])target.addEventListener(type,endPointer,true);
 window.addEventListener('mouseup',e=>{if(e.buttons===0){pointers.clear();sync();}},true);
 window.addEventListener('message',e=>{if(window.parent===window||e.source!==window.parent)return;if(e.data?.type==='hs-input:reset'){release();window.dispatchEvent(new Event('hs-input-lost'));return;}if(e.data?.type!=='hs-input:key'||!gameCodes.has(e.data.code))return;const {code,phase,repeat}=e.data;if(phase==='up'){physical.delete(code);sync();virtual('keyup',code);}else if(phase==='down'){if(repeat&&!physical.has(code))return;down(code,repeat);virtual('keydown',code,repeat);}});
 document.querySelectorAll('[data-key]').forEach(b=>{const key=b.dataset.key;b.addEventListener('pointerdown',e=>{e.preventDefault();try{b.setPointerCapture(e.pointerId);}catch{}pointers.set(e.pointerId,key);sync();virtual('keydown',key);});const end=e=>{if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);sync();virtual('keyup',key);};for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,end);b.addEventListener('click',e=>{if(e.detail===0){pointers.set('keyboard-button',key);sync();virtual('keydown',key);setTimeout(()=>{pointers.delete('keyboard-button');sync();virtual('keyup',key);},100);}});});
 $('sound')?.addEventListener('click',()=>{sound=!sound;$('sound').textContent='소리 '+(sound?'켬':'끔');$('sound').setAttribute('aria-pressed',sound);if(sound)beep();});
 const overlay=(title,body,button='다시 하기',tag='')=>{release();$('overlay').hidden=false;$('overlay-title').textContent=title;$('overlay-body').textContent=body;$('play').textContent=button;if($('eyebrow'))$('eyebrow').textContent=tag;};
 const hide=()=>{release();$('overlay').hidden=true;};
 const loop=fn=>{let prev=0;const step=t=>{const dt=prev?Math.min((t-prev)/1000,.04):0;prev=t;if(document.hidden)release();fn(dt,t/1000);requestAnimationFrame(step);};document.addEventListener('visibilitychange',()=>{prev=0;muted=document.hidden;if(document.hidden)release();});window.addEventListener('blur',()=>prev=0);requestAnimationFrame(step);};
 const fit=(canvas,scale=1)=>{const dpr=Math.min(devicePixelRatio||1,1.6)*scale,r=canvas.getBoundingClientRect(),w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}return[w,h];};
 return{$,keys,release,best,beep,overlay,hide,loop,fit,clamp:(x,a,b)=>Math.min(b,Math.max(a,x)),rand:(a,b)=>a+Math.random()*(b-a)};
})();
