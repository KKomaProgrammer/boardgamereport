(()=>{
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const store={get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set(k,v){localStorage.setItem(k,JSON.stringify(v));return v},del(k){localStorage.removeItem(k)}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const attr=v=>esc(v).replace(/\n/g,' ');
  const date=v=>{try{return new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v))}catch{return '방금 전'}};
  const modeName=m=>m==='video'?'영상 편집':'PPT 제작';
  const go=p=>location.href=p;
  let supa=null, cfg={authReady:false,siteUrl:''}, saveTimer=null, ffmpegInstance=null, videoFile=null;

  function user(){return store.get('bls_user',null)}
  function token(){return store.get('bls_token',null)}
  function toast(msg){const t=$('#toast'); if(!t)return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200)}
  function showAuthWarning(msg){const n=$('[data-auth-warning]'); if(n){n.hidden=false; n.textContent=msg}}
  function cleanOldDemo(){if(store.get('bls_token',null)==='demo-token'||store.get('bls_user',{})?.id==='demo-user'){store.del('bls_token');store.del('bls_user')}}
  function redirectBase(){const local=['localhost','127.0.0.1','0.0.0.0'].includes(location.hostname); const configured=(cfg.siteUrl||'').replace(/\/$/,''); if(local&&configured)return configured; return location.origin}
  function authReady(){return !!(supa&&cfg.authReady)}

  async function initConfig(){
    try{const r=await fetch('/api/auth/public-config',{cache:'no-store'}); if(r.ok)cfg=await r.json()}catch{}
    if(cfg.supabaseUrl&&cfg.supabaseAnonKey&&window.supabase){
      supa=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      const {data,error}=await supa.auth.getSession();
      if(!error&&data?.session){store.set('bls_token',data.session.access_token); store.set('bls_user',{id:data.session.user.id,email:data.session.user.email,nickname:user()?.nickname||data.session.user.email?.split('@')[0]||'사용자'})}
    }else cleanOldDemo();
    const params=new URLSearchParams(location.search);
    if(params.get('error_description'))showAuthWarning(params.get('error_description'));
    if(location.pathname==='/login/'&&!cfg.authReady)showAuthWarning('Supabase 환경변수 설정이 필요합니다. 자동 데모 로그인은 제거되었습니다.');
  }

  async function api(path,body={},method='POST'){
    const headers={'content-type':'application/json'}; if(token())headers.authorization=`Bearer ${token()}`;
    const r=await fetch(path,{method,headers,body:method==='GET'?undefined:JSON.stringify(body)});
    let data=null; try{data=await r.json()}catch{}
    if(!r.ok)throw new Error(data?.error||'요청 실패');
    return data;
  }

  function requireUser(){if(!user()&&!['/','/login/','/signup/'].includes(location.pathname)&&!location.pathname.startsWith('/s/')){go('/login/'); return null} return user()}
  function saveState(v){const e=$('[data-save-state]'); if(e){e.dataset.state=v; e.textContent={saving:'저장 중',saved:'저장됨',offline:'저장 실패',conflict:'충돌 확인 필요'}[v]||v}}
  function debounce(fn){saveState('saving'); clearTimeout(saveTimer); saveTimer=setTimeout(async()=>{try{await fn();saveState('saved')}catch(e){saveState('offline');toast(e.message)}},650)}
  async function loadProject(){requireUser(); const id=store.get('bls_current_project',null); if(!id)throw new Error('대시보드에서 프로젝트를 먼저 열어주세요.'); return await api('/api/projects/load',{projectId:id})}
  async function save(projectId,workspaceType,content,mode){await api('/api/projects/save',{projectId,workspaceType,content,mode})}
  async function ai(path,body,target){const box=$(target); if(!box)return; box.innerHTML='<div class="notice is-loading">AI 제안을 만드는 중입니다.</div>'; try{const r=await api(path,body); box.innerHTML=`<div class="notice"><b>AI 제안</b><p>${esc(r.suggestion).replace(/\n/g,'<br>')}</p></div>`}catch(e){box.innerHTML=`<div class="notice danger-note">${esc(e.message)}</div>`}}

  function icon(label){const icons={홈:'<path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',프로젝트:'<path d="M4 5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>',알림:'<path d="M18 15v-4a6 6 0 0 0-12 0v4l-2 3h16z"/><path d="M10 21h4"/>',설정:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="M4 12h2m12 0h2M12 4v2m0 12v2M6.5 6.5l1.5 1.5m8 8 1.5 1.5m0-11-1.5 1.5m-8 8-1.5 1.5"/>'};return `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${icons[label]||icons.홈}</g></svg>`}
  function enhanceMobileNav(){const nav=$('.mobile-nav'); if(!nav)return; $$('a',nav).forEach(a=>{const label=a.textContent.replace(/\s+/g,'')||'홈'; a.innerHTML=`<span class="nav-ico">${icon(label)}</span><span class="nav-label">${esc(label)}</span>`}); nav.addEventListener('click',e=>{if(e.target===nav)nav.classList.toggle('expanded')})}

  async function ensureFFmpeg(){
    if(ffmpegInstance)return ffmpegInstance;
    if(!window.FFmpegWASM?.FFmpeg)throw new Error('영상 편집 라이브러리가 아직 로드되지 않았습니다.');
    const {FFmpeg}=window.FFmpegWASM;
    const util=window.FFmpegUtil||{};
    ffmpegInstance=new FFmpeg();
    ffmpegInstance.on?.('log',({message})=>{const box=$('[data-video-result]'); if(box)box.innerHTML=`<div class="notice">${esc(message)}</div>`});
    const coreBase='https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
    if(util.toBlobURL){
      await ffmpegInstance.load({
        coreURL:await util.toBlobURL(`${coreBase}/ffmpeg-core.js`,'text/javascript'),
        wasmURL:await util.toBlobURL(`${coreBase}/ffmpeg-core.wasm`,'application/wasm'),
        workerURL:await util.toBlobURL(`${coreBase}/ffmpeg-core.worker.js`,'text/javascript')
      });
    }else await ffmpegInstance.load({coreURL:`${coreBase}/ffmpeg-core.js`});
    return ffmpegInstance;
  }

  async function exportTrimmedVideo(){
    const out=$('[data-video-result]');
    if(!videoFile){toast('먼저 영상을 선택하세요.');return}
    out.innerHTML='<div class="notice is-loading">영상 라이브러리를 준비하고 있습니다.</div>';
    const ffmpeg=await ensureFFmpeg();
    const util=window.FFmpegUtil||{};
    const start=Math.max(0,Number($('[data-trim-start]')?.value||0));
    const end=Math.max(start+0.1,Number($('[data-trim-end]')?.value||10));
    const input='input.mp4', output='output.mp4';
    const bytes=util.fetchFile?await util.fetchFile(videoFile):new Uint8Array(await videoFile.arrayBuffer());
    out.innerHTML='<div class="notice is-loading">구간을 처리하는 중입니다.</div>';
    await ffmpeg.writeFile(input,bytes);
    await ffmpeg.exec(['-ss',String(start),'-to',String(end),'-i',input,'-c','copy',output]);
    const data=await ffmpeg.readFile(output);
    const blob=new Blob([data.buffer],{type:'video/mp4'});
    const url=URL.createObjectURL(blob);
    out.innerHTML=`<div class="notice"><b>완료</b><p>아래 버튼으로 결과 영상을 저장하세요.</p><a class="button" href="${url}" download="boardlab-video.mp4">영상 저장</a></div>`;
  }

  async function exportPptx(projectTitle,data){
    if(!window.pptxgen)throw new Error('PPT 라이브러리가 아직 로드되지 않았습니다.');
    const pptx=new window.pptxgen();
    pptx.layout='LAYOUT_WIDE';
    pptx.author='BoardLab Studio';
    const slides=data.slides?.length?data.slides:[{title:projectTitle,body:'내용을 입력하세요.',notes:''}];
    slides.forEach(s=>{const slide=pptx.addSlide(); slide.background={color:'F8FAFC'}; slide.addText(s.title||'제목',{x:0.7,y:0.55,w:11.8,h:0.8,fontFace:'Aptos Display',fontSize:34,bold:true,color:'111827'}); slide.addText(s.body||'',{x:0.9,y:1.7,w:11.2,h:4.3,fontFace:'Aptos',fontSize:20,color:'475467',breakLine:false,fit:'shrink'}); if(s.notes)slide.addNotes(String(s.notes));});
    await pptx.writeFile({fileName:`${(projectTitle||'boardlab').replace(/[\\/:*?"<>|]/g,'_')}.pptx`});
  }

  const Pages={
    landing(){ $$('[data-start]').forEach(b=>b.onclick=()=>go(user()?'/dashboard/':'/login/')) },
    login(){
      $('[data-google-login]')?.addEventListener('click',async()=>{if(!authReady())return showAuthWarning('로그인 기능을 사용하려면 Supabase 환경변수를 설정하세요.'); const base=redirectBase(); if(['localhost','127.0.0.1'].includes(location.hostname)&&!cfg.siteUrl)return showAuthWarning('localhost 리다이렉트를 막았습니다. PUBLIC_SITE_URL을 실제 배포 주소로 설정하세요.'); const {error}=await supa.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${base}/dashboard/`}}); if(error)toast(error.message)});
      $('[data-login-form]')?.addEventListener('submit',async e=>{e.preventDefault(); if(!authReady())return showAuthWarning('Supabase 설정이 없어 로그인할 수 없습니다.'); const f=new FormData(e.target), email=f.get('email'), password=f.get('password'); const {data,error}=await supa.auth.signInWithPassword({email,password}); if(error)return toast(error.message); store.set('bls_token',data.session.access_token); store.set('bls_user',{id:data.user.id,email,nickname:email.split('@')[0]}); go('/dashboard/')})
    },
    signup(){ $('[data-signup-form]')?.addEventListener('submit',async e=>{e.preventDefault(); if(!authReady())return toast('Supabase 설정이 필요합니다.'); const f=new FormData(e.target); if(f.get('password')!==f.get('password2'))return toast('비밀번호가 서로 다릅니다.'); const {data,error}=await supa.auth.signUp({email:f.get('email'),password:f.get('password'),options:{emailRedirectTo:`${redirectBase()}/nickname/`}}); if(error)return toast(error.message); store.set('bls_user',{id:data.user?.id||'pending',email:f.get('email'),nickname:''}); go('/nickname/')})},
    nickname(){requireUser(); $('[data-nickname-form]')?.addEventListener('submit',async e=>{e.preventDefault(); try{const nickname=new FormData(e.target).get('nickname'); await api('/api/profile/update',{nickname}); store.set('bls_user',{...user(),nickname}); go('/dashboard/')}catch(err){toast(err.message)}})},
    async dashboard(){requireUser(); const box=$('[data-project-list]'); try{const projects=await api('/api/projects/list',{}); const list=projects.projects||[]; box.innerHTML=list.map(p=>`<article class="card project-card"><div class="row"><span class="pill">${modeName(p.current_mode)}</span><span class="mini">${date(p.updated_at)}</span></div><h3>${esc(p.title)}</h3><p class="muted">${esc(p.description)}</p><div class="row"><button class="small" data-open-project="${p.id}">열기</button></div></article>`).join('')||'<div class="empty">아직 프로젝트가 없습니다.</div>'; $$('[data-open-project]').forEach(b=>b.onclick=()=>{store.set('bls_current_project',b.dataset.openProject); go('/project/')})}catch(e){box.innerHTML=`<div class="empty">${esc(e.message)}</div>`} $('[data-create-project]')?.addEventListener('submit',async e=>{e.preventDefault(); try{const f=new FormData(e.target), r=await api('/api/projects/create',{title:f.get('title'),description:f.get('description'),mode:f.get('mode')}); store.set('bls_current_project',r.project.id); go(r.project.current_mode==='video'?'/project/video/':'/project/ppt/')}catch(err){toast(err.message)}})},
    async project(){try{const c=await loadProject(); $('[data-project-title]').textContent=c.project.title}catch(e){toast(e.message)}},
    async video(){try{const c=await loadProject(); $('[data-project-title]').textContent=c.project.title; const data=c.documents.video_workspace||{scenes:[],editor:{clips:[]}}; let idx=0; const draw=()=>{const list=$('[data-scenes]'), ed=$('[data-scene-editor]'); list.innerHTML=(data.scenes||[]).map((s,i)=>`<div class="list-item ${i===idx?'active':''}" data-i="${i}"><b>${i+1}. ${esc(s.title||'새 장면')}</b><p class="mini">${esc(s.screen||'화면 설명 없음')}</p></div>`).join('')||'<div class="empty">장면을 추가하세요.</div>'; const s=data.scenes[idx]||{}; ed.innerHTML=`<div class="form"><input data-f="title" value="${attr(s.title)}" placeholder="장면 제목"><textarea data-f="screen" placeholder="화면 설명">${esc(s.screen||'')}</textarea><textarea data-f="script" placeholder="대본">${esc(s.script||'')}</textarea></div>`; $$('[data-i]').forEach(x=>x.onclick=()=>{idx=+x.dataset.i; draw()}); $$('[data-f]',ed).forEach(x=>x.oninput=()=>{data.scenes[idx]=data.scenes[idx]||{}; data.scenes[idx][x.dataset.f]=x.value; debounce(()=>save(c.project.id,'video_workspace',data,'video'))})}; $('[data-add-scene]').onclick=()=>{data.scenes=data.scenes||[]; data.scenes.push({title:'새 장면',screen:'',script:''}); idx=data.scenes.length-1; draw(); save(c.project.id,'video_workspace',data,'video')}; $('[data-ai-video]').onclick=()=>ai('/api/ai/video',{projectId:c.project.id,text:JSON.stringify(data.scenes||[])},'[data-ai-result]'); $('[data-video-file]')?.addEventListener('change',e=>{videoFile=e.target.files?.[0]||null; if(videoFile){$('[data-video-preview]').src=URL.createObjectURL(videoFile); data.editor=data.editor||{}; data.editor.lastFileName=videoFile.name; debounce(()=>save(c.project.id,'video_workspace',data,'video'))}}); $('[data-export-video]')?.addEventListener('click',exportTrimmedVideo); draw()}catch(e){toast(e.message)}},
    async ppt(){try{const c=await loadProject(); $('[data-project-title]').textContent=c.project.title; const data=c.documents.ppt_workspace||{template:'classic',slides:[{title:c.project.title,body:'내용을 입력하세요.',notes:''}]}; let idx=0; const draw=()=>{const list=$('[data-slides]'), cv=$('[data-slide-canvas]'), notes=$('[data-notes]'); list.innerHTML=data.slides.map((s,i)=>`<div class="list-item ${i===idx?'active':''}" data-i="${i}"><b>${i+1}. ${esc(s.title)}</b><p class="mini">${esc((s.body||'').slice(0,32))}</p></div>`).join(''); const s=data.slides[idx]; cv.innerHTML=`<input class="slide-title" data-f="title" value="${attr(s.title)}"><textarea class="slide-body" data-f="body">${esc(s.body)}</textarea>`; notes.value=s.notes||''; $$('[data-i]').forEach(x=>x.onclick=()=>{idx=+x.dataset.i; draw()}); $$('[data-f]',cv).forEach(x=>x.oninput=()=>{s[x.dataset.f]=x.value; debounce(()=>save(c.project.id,'ppt_workspace',data,'ppt'))}); notes.oninput=()=>{s.notes=notes.value; debounce(()=>save(c.project.id,'ppt_workspace',data,'ppt'))}; $('[name="template"]').value=data.template||'classic'}; $('[data-add-slide]').onclick=()=>{data.slides.push({title:'새 슬라이드',body:'핵심 문장',notes:''}); idx=data.slides.length-1; draw(); save(c.project.id,'ppt_workspace',data,'ppt')}; $('[name="template"]').onchange=e=>{data.template=e.target.value; save(c.project.id,'ppt_workspace',data,'ppt')}; $('[data-export-pptx]').onclick=()=>exportPptx(c.project.title,data).catch(e=>toast(e.message)); $('[data-ai-ppt]').onclick=()=>ai('/api/ai/ppt',{projectId:c.project.id,text:JSON.stringify(data.slides[idx])},'[data-ai-result]'); draw()}catch(e){toast(e.message)}},
    async team(){try{const c=await loadProject(); $('[data-members]').innerHTML=(c.members||[]).map(m=>`<div class="notification"><b>${esc(m.nickname||m.user_id)}</b><span class="mini">권한: ${m.role} · AI ${m.ai_enabled?'허용':'차단'}</span></div>`).join('')||'<div class="empty">팀원이 없습니다.</div>'}catch(e){toast(e.message)}},
    async share(){try{const c=await loadProject(); $('[data-share-form]')?.addEventListener('submit',async e=>{e.preventDefault(); const f=new FormData(e.target), r=await api('/api/share/create',{projectId:c.project.id,customId:f.get('customId'),scope:f.get('scope'),expiresAt:f.get('expiresAt'),password:f.get('password')}); $('[data-share-result]').innerHTML=`<div class="share-box">${esc(r.url)}</div>`})}catch(e){toast(e.message)}},
    async notifications(){requireUser(); try{const r=await api('/api/notifications/list',{}); $('[data-notifications]').innerHTML=(r.notifications||[]).map(n=>`<div class="notification ${n.unread?'unread':''}"><b>${esc(n.title)}</b><p>${esc(n.body)}</p><span class="mini">${date(n.created_at)}</span></div>`).join('')||'<div class="empty">알림이 없습니다.</div>'; $('[data-read-all]').onclick=async()=>{await api('/api/notifications/read',{});location.reload()}}catch(e){toast(e.message)}},
    account(){requireUser(); const f=$('[data-account-form]'); if(f){f.email.value=user()?.email||''; f.nickname.value=user()?.nickname||''; f.addEventListener('submit',async e=>{e.preventDefault(); try{const data=new FormData(e.target), body={nickname:data.get('nickname')}; if(data.get('email'))body.email=data.get('email'); if(data.get('password'))body.password=data.get('password'); await api('/api/profile/update',body); store.set('bls_user',{...user(),nickname:body.nickname,email:body.email||user().email}); toast('계정 정보를 저장했습니다')}catch(err){toast(err.message)}})}},
    async shareview(){try{const slug=location.pathname.split('/').filter(Boolean).pop(); const r=await api('/api/share/load',{slug}); $('[data-public-title]').textContent=r.project?.title||'공유 프로젝트'; $('[data-public-content]').innerHTML='<section class="card"><h2>공유 결과물</h2><p>공유된 영상/PPT 프로젝트입니다.</p></section>'}catch(e){$('[data-public-content]').innerHTML=`<div class="empty">${esc(e.message)}</div>`}}
  };
  document.addEventListener('click',async e=>{if(e.target.matches('[data-action="logout"]')){if(supa)await supa.auth.signOut(); store.del('bls_user'); store.del('bls_token'); go('/login/')}});
  document.addEventListener('DOMContentLoaded',async()=>{await initConfig(); enhanceMobileNav(); $$('[data-action="logout"]').forEach(b=>b.hidden=!user()); const p=document.body.dataset.page; if(Pages[p])Pages[p]()});
})();
