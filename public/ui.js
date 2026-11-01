const $=s=>document.querySelector(s),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let db,data={schemaVersion:1,tasks:[],rpg:initial()},page='tasks',filter='all',queue=Promise.resolve(),ready=false;const labels=['未着手','進行中','完了'];let draft='';try{draft=localStorage.getItem('glass-draft')||''}catch{}$('#memo').value=draft;$('#memo').oninput=()=>{try{localStorage.setItem('glass-draft',$('#memo').value);$('#draftState').textContent='下書き保存済み'}catch{$('#draftState').textContent='下書きを保存できません'}};
const open=indexedDB.open('glass-task',1);open.onupgradeneeded=()=>open.result.createObjectStore('app');open.onsuccess=()=>{db=open.result;let r=db.transaction('app').objectStore('app').get('data');r.onsuccess=()=>{data=r.result||data;ready=true;document.body.classList.add('ready');render();connectCloud()};r.onerror=error};open.onerror=error;function error(){document.body.classList.add('ready');$('#save').textContent='保存領域を利用できません';toast('保存に失敗しました。入力内容をコピーしてください')}
function mutate(fn){queue=queue.then(async()=>{if(!ready)throw Error('読み込み中です');const backup=structuredClone(data);try{fn();await new Promise((resolve,reject)=>{let tx=db.transaction('app','readwrite');tx.objectStore('app').put(data,cloudUser?'cloud-state:'+cloudUser:'data');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});$('#save').textContent='端末に保存済み';render();await saveCloud()}catch(e){data=backup;throw e}}).catch(e=>toast(e.message));return queue}
function toast(t){$('#notice').textContent=t;$('#notice').style.display='block';clearTimeout(window.timer);window.timer=setTimeout(()=>$('#notice').style.display='none',3500)}
$('#capture').onsubmit=async e=>{e.preventDefault();let text=$('#memo').value.trim();if(!text)return;if(!ready){toast('読み込み中です。下書きは保持しています');return}const id=uid();await mutate(()=>data.tasks.unshift({id,text,status:0,createdAt:new Date().toISOString()}));if(data.tasks.some(t=>t.id===id)){$('#memo').value='';try{localStorage.removeItem('glass-draft')}catch{}$('#memo').focus()}};
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page;render()});
function change(id,step){let t=data.tasks.find(t=>t.id===id);let old=t.status,next=Math.max(0,Math.min(2,old+step));if(old===next)return;mutate(()=>{t.status=next;t.updatedAt=new Date().toISOString()}).then(()=>{toast(labels[next]+'に変更');let undo=document.createElement('button');undo.textContent='元に戻す';undo.onclick=()=>mutate(()=>data.tasks.find(t=>t.id===id).status=old);$('#notice').append(undo)})}
function render(){document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('selected',b.dataset.page===page));let c=calculate(data.rpg);if(page==='tasks'){$('#content').innerHTML=`<div class="tabs">${[['all','すべて'],['0','未着手'],['1','進行中'],['2','完了']].map(([id,t])=>`<button data-filter="${id}" class="${filter===id?'selected':''}">${t} ${data.tasks.filter(x=>id==='all'||x.status===+id).length}</button>`).join('')}</div><div class="muted">右フリックで進める・左フリックで戻す</div>${data.tasks.filter(t=>filter==='all'||t.status===+filter).map(t=>`<article class="task glass ${t.status===2?'done':''}" data-id="${t.id}"><h2>${escape(t.text)}</h2><div class="row"><span class="status">${labels[t.status]}</span><div><button data-step="-1" aria-label="前の状態へ" ${t.status===0?'disabled':''}>←</button> <button data-step="1" aria-label="次の状態へ" ${t.status===2?'disabled':''}>→</button></div></div></article>`).join('')||'<div class="empty">タスクはありません</div>'}`;document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render()});document.querySelectorAll('.task').forEach(el=>{let x,y;el.onpointerdown=e=>{if(e.target.closest('button'))return;x=e.clientX;y=e.clientY};el.onpointermove=e=>{if(x===undefined)return;let dx=e.clientX-x,dy=e.clientY-y;if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>15){x=undefined;el.style.transform='';return}if(Math.abs(dx)>12)el.style.transform=`translateX(${Math.max(-100,Math.min(100,dx))}px)`};el.onpointerup=e=>{let dx=e.clientX-x,dy=e.clientY-y;x=undefined;el.style.transform='';if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.4)change(el.dataset.id,dx>0?1:-1)};el.onpointercancel=()=>{x=undefined;el.style.transform=''};el.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>change(el.dataset.id,+b.dataset.step))})}
if(page==='habits'){$('#content').innerHTML='<h2>習慣</h2>'+data.rpg.quests.filter(q=>q.enabled&&!q.deleted).map(q=>`<div class="habit glass row"><div>${escape(q.description)}<br><span class="muted">${q.targetValue}${q.targetUnit} · ${q.xpReward} XP</span></div><button data-quest="${q.id}">記録</button></div>`).join('');document.querySelectorAll('[data-quest]').forEach(b=>b.onclick=()=>{let q=data.rpg.quests.find(q=>q.id===b.dataset.quest),n=prompt('今回の数量（'+q.targetUnit+'）',q.id==='train'?'1':String(q.targetValue));if(n===null||!Number.isFinite(+n)||+n<=0)return;mutate(()=>report(data.rpg,{operationId:uid(),date:day(),quantity:+n,quest:structuredClone(q)}))})}
if(page==='growth')$('#content').innerHTML=`<h2>Lv.${c.level} <small>${c.xp} XP</small></h2><div class="stats">${STATS.map((s,i)=>`<div class="glass">${s}<b>${c.stats[i].value}</b></div>`).join('')}</div><h2>実績</h2>${achievements(data.rpg).map(a=>`<div class="habit glass">${a.ok?'✓':'○'} ${a.name}</div>`).join('')}`;
if(page==='settings'){$('#content').innerHTML=`<h2>データ</h2><button id="export">JSONを書き出す</button><button id="retryCloud">同期を再試行</button><button id="loadCloud">クラウドから読み直す</button><h2>接続状況</h2><div class="habit glass">Google認証：${cloudUser?'接続済み':'未接続'}<br>Cloudflare同期：${cloudBlocked?'同期未完了':cloudReady?'接続済み':'未接続'}<br><a href='/auth/google'>Googleでログイン</a></div><p class="muted">保存状況は画面右上で確認できます。</p>`;$('#retryCloud').onclick=()=>retryCloud();$('#loadCloud').onclick=()=>reloadCloud();$('#export').onclick=()=>{let u=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='glass-task.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}}}

let cloudUser=null,cloudReady=false,cloudRevision=0,cloudBlocked=false;
async function requestCloud(path,options={}){
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
 if(!response.ok){const e=new Error(response.status===401?'再ログインが必要です':response.status===409?'別の端末で更新されています。JSONを書き出してから再読み込みしてください':'クラウド保存に失敗しました');e.status=response.status;throw e}
 return response.json();
}
function persistLocal(){return new Promise((resolve,reject)=>{const tx=db.transaction('app','readwrite');tx.objectStore('app').put(data,cloudUser?'cloud-state:'+cloudUser:'data');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function connectCloud(){
 // Serialize initialization with edits made while the account is being checked.
 queue=queue.then(async()=>{
  const me=await requestCloud('/api/me');
  if(!me.userId)throw Error('同期対応版のサーバーへ更新してください');
  cloudUser=me.userId;
  const snapshot=await requestCloud('/api/state');
  const key='cloud:'+cloudUser;
  const cached=await new Promise((resolve,reject)=>{const r=db.transaction('app').objectStore('app').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  if(cached?.dirty){data=cached.state;cloudRevision=cached.revision;cloudBlocked=true;await persistLocal();render();throw Error('前回の未同期データがあります。設定からJSONを書き出してください')}
  cloudRevision=snapshot.revision;
  if(snapshot.state){data=snapshot.state}
  else {
   const hasLocal=data.tasks.length||data.rpg.ledger?.length;
   const useLocal=hasLocal&&confirm('この端末のデータを、現在ログイン中のGoogleアカウントへ保存しますか？');
   if(!useLocal)data={schemaVersion:1,tasks:[],rpg:initial()};
  }
  await persistLocal();cloudReady=true;render();
  if(!snapshot.state)await saveCloud();else $('#save').textContent='クラウドと同期済み';
 }).catch(e=>{$('#save').textContent=e.status===401?'端末に保存（未ログイン）':'端末に保存・同期未完了';if(e.status!==401)toast(e.message)});
}
async function saveCloud(){
 if(!cloudReady||cloudBlocked)return;
 const snapshot=structuredClone(data),revision=cloudRevision,key='cloud:'+cloudUser;
 async function cache(dirty){await new Promise((resolve,reject)=>{const tx=db.transaction('app','readwrite');tx.objectStore('app').put({state:snapshot,revision:cloudRevision,dirty},key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
 try{
  await cache(true);$('#save').textContent='クラウドへ保存中';
  const me=await requestCloud('/api/me');if(me.userId!==cloudUser)throw Error('アカウントが変更されました。再読み込みしてください');
  const result=await requestCloud('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:snapshot,revision})});
  cloudRevision=result.revision;await cache(false);$('#save').textContent='クラウドと同期済み';
 }catch(e){cloudBlocked=true;$('#save').textContent='端末に保存・同期未完了';toast(e.message)}
}

async function retryCloud(){
 queue=queue.then(async()=>{
  if(!cloudUser){location.href='/auth/google';return}
  const me=await requestCloud('/api/me');if(me.userId!==cloudUser)throw Error('アカウントが変更されました。再読み込みしてください');
  const current=await requestCloud('/api/state');
  if(current.revision!==cloudRevision)throw Error('別の端末の更新があります。JSONを書き出してからクラウドから読み直してください');
  cloudReady=true;cloudBlocked=false;await saveCloud();render();
 }).catch(e=>toast(e.message));
}
async function reloadCloud(){
 if(!confirm('JSONのバックアップは保存しましたか？この端末の表示をクラウドのデータに置き換えます。'))return;
 queue=queue.then(async()=>{
  const me=await requestCloud('/api/me');if(me.userId!==cloudUser)throw Error('アカウントが変更されました。再読み込みしてください');
  const current=await requestCloud('/api/state');if(!current.state)throw Error('クラウドに保存されたデータはありません');
  data=current.state;cloudRevision=current.revision;await persistLocal();
  await new Promise((resolve,reject)=>{const tx=db.transaction('app','readwrite');tx.objectStore('app').put({state:data,revision:cloudRevision,dirty:false},'cloud:'+cloudUser);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
  cloudReady=true;cloudBlocked=false;$('#save').textContent='クラウドと同期済み';render();
 }).catch(e=>toast(e.message));
}
