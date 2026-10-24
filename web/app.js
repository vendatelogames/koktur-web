(() => {
  'use strict';
  const CONFIG = window.KOKTUR_CONFIG || {};
  const DEFAULT_API = 'https://koktur-core.vendatelogames.workers.dev';
  const THEMES = [
    {id:'koktur',name:'KOKTUR',desc:'Фирменный бирюзовый и золото',color:'#39dec2',bg:'#07100f',effect:'stars'},
    {id:'nauryz',name:'Наурыз',desc:'Золото, орнаменты и весенние лепестки',color:'#e7bf47',bg:'#11100a',effect:'petals'},
    {id:'newyear',name:'Новый год',desc:'Красный, белый и падающий снег',color:'#ff6778',bg:'#160d11',effect:'snow'},
    {id:'christmas',name:'Рождество',desc:'Заснеженная хвоя и тёплые огни',color:'#dcebe1',bg:'#0d1411',effect:'snow'},
    {id:'winter',name:'Зима',desc:'Ледяной свет и снежинки',color:'#75d9ff',bg:'#08121f',effect:'snow'},
    {id:'halloween',name:'Хэллоуин',desc:'Тыквенное сияние и таинственные искры',color:'#ff9b42',bg:'#140e0a',effect:'embers'},
    {id:'republic',name:'День Республики',desc:'Небесные оттенки и золотые детали',color:'#4ed3df',bg:'#07131a',effect:'stars'},
    {id:'independence',name:'День Независимости',desc:'Голубой свет, золото и звёзды',color:'#6dbaff',bg:'#07131b',effect:'stars'},
    {id:'oraiz',name:'Ораза айт',desc:'Тёплое золото и мягкие фонари',color:'#f0c779',bg:'#15100d',effect:'lanterns'},
    {id:'qurban',name:'Құрбан айт',desc:'Спокойные зелёные оттенки и геометрия',color:'#86d59b',bg:'#0b1511',effect:'stars'},
    {id:'spring',name:'Весна',desc:'Свежая зелень и нежные цветы',color:'#9add8a',bg:'#0d1510',effect:'petals'},
    {id:'daylight',name:'Daylight',desc:'Чистая светлая студия',color:'#008d7b',bg:'#f2f7f7',effect:'none'},
    {id:'cyber',name:'Cyber Neon',desc:'Электрический циан и графит',color:'#7affef',bg:'#070c18',effect:'stars'},
    {id:'sapphire',name:'Сапфир',desc:'Глубокий синий и холодный свет',color:'#70a7ff',bg:'#080f20',effect:'stars'},
    {id:'violet',name:'Фиолетовая орбита',desc:'Аметистовые акценты и космическая пыль',color:'#bb9aff',bg:'#110b1c',effect:'stars'}
  ];
  const STORAGE_KEY = CONFIG.storageKey || 'koktur-web-v1';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
  const defaultState = () => ({version:2,theme:'koktur',profileName:'',reduceMotion:false,compactMode:false,deepReasoning:false,apiEndpoint:CONFIG.coreApi || DEFAULT_API,conversations:[],currentId:null,library:[]});
  let state = loadState();
  let sending = false;
  let abortController = null;
  let activeView = 'chat';
  let currentThinking = false;
  let authMode = 'login';
  const streamCleanup = [];
  const CLOUD_SESSION_KEY = 'koktur-cloud-session-v1';
  const CLOUD_DELETES_KEY = 'koktur-cloud-pending-deletes-v1';
  let cloudSession = loadCloudSession();
  let cloudSyncTimer = 0, cloudSyncBusy = false, cloudSyncPending = false, cloudSuppressSchedule = false;
  let pendingCloudDeletes = loadCloudDeletes();

  function loadState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return defaultState();
      const base = {...defaultState(),...data};
      base.conversations = Array.isArray(base.conversations) ? base.conversations.slice(-100) : [];
      base.library = Array.isArray(base.library) ? base.library.slice(-100) : [];
      base.deepReasoning = Boolean(base.deepReasoning);
      if (!THEMES.some(theme => theme.id === base.theme)) base.theme = 'koktur';
      base.apiEndpoint = (typeof base.apiEndpoint === 'string' && /^https?:\/\//i.test(base.apiEndpoint)) ? base.apiEndpoint : (CONFIG.coreApi || DEFAULT_API);
      return base;
    } catch { return defaultState(); }
  }
  function saveState(options={}){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { toast('Браузеру не удалось сохранить данные. Освободи место или экспортируй историю.', 'error'); }
    if (!options.skipCloudSchedule && !cloudSuppressSchedule) scheduleCloudSync();
  }
  function loadCloudSession(){try{const v=JSON.parse(localStorage.getItem(CLOUD_SESSION_KEY)||'null');return v&&typeof v.token==='string'&&typeof v.email==='string'?v:null;}catch{return null;}}
  function loadCloudDeletes(){try{const v=JSON.parse(localStorage.getItem(CLOUD_DELETES_KEY)||'[]');return Array.isArray(v)?v.filter(x=>x&&typeof x.id==='string'):[];}catch{return [];}}
  function storeCloudSession(){try{if(cloudSession)localStorage.setItem(CLOUD_SESSION_KEY,JSON.stringify(cloudSession));else localStorage.removeItem(CLOUD_SESSION_KEY);}catch{}}
  function storeCloudDeletes(){try{localStorage.setItem(CLOUD_DELETES_KEY,JSON.stringify(pendingCloudDeletes.slice(-200)));}catch{}}
  function cloudMessage(text,kind=''){const el=$('#cloudAccountMessage');if(el){el.textContent=text;el.className=`test-result ${kind}`;}const status=$('#cloudAccountStatus');if(status)status.textContent=text;}
  function cloudRenderAccount(){const signed=!!cloudSession;const identity=$('#cloudAccountIdentity');if(identity)identity.textContent=signed?`Вход выполнен: ${cloudSession.email}`:'Не выполнен вход';const status=$('#cloudAccountStatus');if(status)status.textContent=signed?'Облако подключено. Проверяю состояние синхронизации…':'Войди в тот же аккаунт на всех устройствах.';const logout=$('#cloudLogoutBtn');if(logout)logout.disabled=!signed;const sync=$('#cloudSyncBtn');if(sync)sync.disabled=!signed;const open=$('#openAccountBtn');if(open)open.innerHTML=signed?'Управление общей синхронизацией <span>☁</span>':'Войти и синхронизировать чаты <span>☁</span>';}
  async function cloudRequest(path, options={}){
    const {auth=true,...fetchOptions}=options;const headers=new Headers(fetchOptions.headers||{});headers.set('Accept','application/json');
    if(fetchOptions.body!==undefined&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
    if(auth&&cloudSession?.token)headers.set('Authorization',`Bearer ${cloudSession.token}`);
    const endpoint=(state.apiEndpoint||CONFIG.coreApi||DEFAULT_API).replace(/\/$/,'');
    const response=await fetch(`${endpoint}${path}`,{...fetchOptions,headers,cache:'no-store',signal:fetchOptions.signal||AbortSignal.timeout(20000)});
    const raw=await response.text();let body={};try{body=raw?JSON.parse(raw):{};}catch{body={raw};}
    if(!response.ok)throw new Error(body.message||body.error||body.code||`HTTP ${response.status}`);
    return body;
  }
  function cloudConversationPayload(c){return {id:String(c.id),title:String(c.title||'Новый диалог').slice(0,120),createdAt:Number(c.createdAt)||Date.now(),updatedAt:Number(c.updatedAt)||Date.now(),messages:(Array.isArray(c.messages)?c.messages:[]).slice(-50).map(m=>({id:String(m.id||''),role:m.role==='assistant'?'assistant':'user',content:String(m.content||'').slice(0,4000),createdAt:Number(m.createdAt)||Date.now()}))};}
  function mergeCloudConversations(data){
    const map=new Map(state.conversations.map(c=>[String(c.id),c]));
    for(const dead of (Array.isArray(data.deleted)?data.deleted:[])){const local=map.get(String(dead.id));if(!local||Number(dead.updatedAt)>=Number(local.updatedAt||0))map.delete(String(dead.id));}
    for(const remoteRaw of (Array.isArray(data.conversations)?data.conversations:[])){
      const remote=cloudConversationPayload(remoteRaw);const local=map.get(remote.id);
      if(!local||remote.updatedAt>Number(local.updatedAt||0))map.set(remote.id,remote);
    }
    state.conversations=[...map.values()].sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0)).slice(0,100);
    if(!state.conversations.some(c=>c.id===state.currentId))state.currentId=state.conversations[0]?.id||null;
    cloudSuppressSchedule=true;try{saveState({skipCloudSchedule:true});}finally{cloudSuppressSchedule=false;}
    renderHistory();if(activeView==='chat')renderConversation();else if(activeView==='history')setView('history');syncBreadcrumb();
  }
  async function cloudSyncNow(options={}){
    const quiet=Boolean(options.quiet);if(!cloudSession?.token){if(!quiet)cloudMessage('Сначала войди или создай аккаунт.','error');return;}
    if(cloudSyncBusy){cloudSyncPending=true;return;}cloudSyncBusy=true;cloudRenderAccount();if(!quiet)cloudMessage('Синхронизирую диалоги…');
    try{
      const remaining=[];
      for(const item of pendingCloudDeletes){try{await cloudRequest(`/api/sync/conversations/${encodeURIComponent(item.id)}`,{method:'DELETE'});}catch{remaining.push(item);}}
      pendingCloudDeletes=remaining;storeCloudDeletes();
      const remote=await cloudRequest('/api/sync/conversations',{method:'GET'});mergeCloudConversations(remote);
      const all=state.conversations.map(cloudConversationPayload);
      for(let i=0;i<all.length;i+=10){await cloudRequest('/api/sync/conversations',{method:'PUT',body:JSON.stringify({conversations:all.slice(i,i+10)})});}
      if(!quiet)cloudMessage(`Синхронизация завершена · ${state.conversations.length} диалогов`,'success');else {const status=$('#cloudAccountStatus');if(status)status.textContent=`Синхронизировано · ${state.conversations.length} диалогов`;}cloudRenderAccount();
    }catch(error){cloudMessage(`Не удалось синхронизировать: ${error.message||'ошибка сервера'}`,'error');if(!quiet)toast('Синхронизация не удалась. Проверь настройки KOKTUR CORE.','error');}
    finally{cloudSyncBusy=false;if(cloudSyncPending){cloudSyncPending=false;scheduleCloudSync(250);}}
  }
  function scheduleCloudSync(delay=1200){if(!cloudSession?.token)return;if(cloudSyncTimer)clearTimeout(cloudSyncTimer);cloudSyncTimer=setTimeout(()=>{cloudSyncTimer=0;cloudSyncNow({quiet:true});},delay);}
  async function performCloudAuth(mode){
    const email=$('#cloudEmail').value.trim().toLowerCase();const password=$('#cloudPassword').value;
    if(!email||!password){cloudMessage('Укажи почту и пароль.','error');return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){cloudMessage('Проверь адрес электронной почты.','error');return;}
    if(mode==='register'&&password.length<10){cloudMessage('Для аккаунта KOKTUR нужен пароль не короче 10 символов.','error');return;}
    cloudMessage(mode==='register'?'Создаю аккаунт…':'Выполняю вход…');
    const loginButton=$('#cloudLoginBtn'),registerButton=$('#cloudRegisterBtn');loginButton.disabled=true;registerButton.disabled=true;
    try{
      const result=await cloudRequest(`/api/auth/${mode}`,{method:'POST',auth:false,body:JSON.stringify({email,password,displayName:state.profileName||email.split('@')[0]||'KOKTUR'})});
      if(!result||typeof result.token!=='string'||!result.token)throw new Error('Сервер не вернул токен сессии. Проверь версию KOKTUR CORE.');
      cloudSession={token:result.token,email:result.user?.email||email,expiresAt:result.expiresAt};storeCloudSession();$('#cloudPassword').value='';cloudRenderAccount();
      await cloudSyncNow({quiet:false});
      const accountDialog=$('#accountModal');if(accountDialog?.open)accountDialog.close();
      if(document.body.classList.contains('landing-active')) enterChatFromLanding({newChat:!currentConversation()});
      toast(mode==='register'?'Аккаунт KOKTUR создан.':'Вход выполнен.');
    }catch(error){cloudMessage(`Ошибка: ${error.message||'не удалось войти'}`,'error');}
    finally{loginButton.disabled=false;registerButton.disabled=false;}
  }
  function setAuthMode(mode){
    authMode=mode==='register'?'register':'login';
    const title=$('#accountTitle'),description=$('#accountDescription'),switcher=$('#switchAuthMode');
    if(title)title.textContent=authMode==='register'?'Создать аккаунт KOKTUR':'Войти в KOKTUR';
    if(description)description.textContent=authMode==='register'?'Создай общий аккаунт, чтобы пользоваться синхронизацией на своих устройствах.':'Продолжи работу в своём общем пространстве.';
    if(switcher)switcher.textContent=authMode==='register'?'Уже есть аккаунт? Войти':'Впервые здесь? Создать аккаунт';
    $('#cloudLoginBtn').classList.toggle('primary-button',authMode==='login');$('#cloudLoginBtn').classList.toggle('secondary-button',authMode!=='login');
    $('#cloudRegisterBtn').classList.toggle('primary-button',authMode==='register');$('#cloudRegisterBtn').classList.toggle('secondary-button',authMode!=='register');
    $('#cloudPassword').autocomplete=authMode==='register'?'new-password':'current-password';
  }
  function openLandingAuth(mode){setAuthMode(mode);cloudRenderAccount();openDialog('accountModal');window.setTimeout(()=>$('#cloudEmail')?.focus({preventScroll:true}),80);}
  function enterChatFromLanding(options={}){
    const stage=$('#landingStage');
    if(!document.body.classList.contains('landing-active')){if(options.newChat)createConversation();return;}
    stage?.classList.add('leaving');
    const reduced=state.reduceMotion||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(()=>{
      if(stage){stage.hidden=true;stage.inert=true;}
      document.body.classList.remove('landing-active');
      const shell=$('.app-shell');if(shell)shell.inert=false;
      redrawAmbience();
      if(options.newChat||!currentConversation())createConversation();
      else{activeView='chat';showChatView();renderHistory();renderConversation();}
      if(cloudSession?.token)cloudSyncNow({quiet:true});
      $('#messageInput').focus({preventScroll:true});
    },reduced?0:510);
  }
  function initLanding(){
    const shell=$('.app-shell');if(document.body.classList.contains('landing-active')&&shell)shell.inert=true;
    const year=$('#landingYear');if(year)year.textContent=String(new Date().getFullYear());
    const loader=$('#landingLoader');if(loader){const reduced=state.reduceMotion||window.matchMedia('(prefers-reduced-motion: reduce)').matches;window.setTimeout(()=>loader.classList.add('is-done'),reduced?100:1100);window.setTimeout(()=>{loader.hidden=true;},reduced?180:1750);}
    const visual=$('#landingVisual'),object=$('#coreObject');
    if(visual&&object&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){let rect=null;visual.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||state.reduceMotion)return;rect=rect||visual.getBoundingClientRect();const nx=(e.clientX-rect.left)/rect.width-.5,ny=(e.clientY-rect.top)/rect.height-.5;object.style.setProperty('--tilt-y',`${(nx*9).toFixed(2)}deg`);object.style.setProperty('--tilt-x',`${(-ny*7).toFixed(2)}deg`);});visual.addEventListener('pointerleave',()=>{rect=null;object.style.setProperty('--tilt-y','0deg');object.style.setProperty('--tilt-x','0deg');});}
    const enter=()=>enterChatFromLanding({newChat:!currentConversation()});
    $('#enterChatBtn')?.addEventListener('click',enter);$('#landingTrustChatBtn')?.addEventListener('click',enter);$('#landingFooterChat')?.addEventListener('click',enter);
    $('#landingLoginBtn')?.addEventListener('click',()=>openLandingAuth('login'));$('#landingRegisterBtn')?.addEventListener('click',()=>openLandingAuth('register'));
    $('#landingLearnBtn')?.addEventListener('click',()=>$('#capabilities')?.scrollIntoView({behavior:state.reduceMotion?'auto':'smooth',block:'start'}));
    $('#switchAuthMode')?.addEventListener('click',()=>setAuthMode(authMode==='login'?'register':'login'));
    const heroStatus=$('#landingCoreStatus'),heroDot=$('#landingStatusDot');
    window.addEventListener('koktur-core-status',e=>{if(!heroStatus||!heroDot)return;const online=!!e.detail?.online;heroDot.classList.toggle('online',online);heroDot.classList.toggle('offline',!online);heroStatus.textContent=online?'KOKTUR CORE ДОСТУПЕН':'ЯДРО ПРОВЕРЯЕТСЯ';});
  }
  async function performCloudLogout(){if(cloudSession?.token){try{await cloudRequest('/api/auth/logout',{method:'POST',body:'{}'});}catch{}}cloudSession=null;storeCloudSession();cloudRenderAccount();cloudMessage('Ты вышел из общего аккаунта. Локальная история осталась на этом устройстве.');}
  function queueCloudDelete(id){if(!cloudSession?.token)return;pendingCloudDeletes.push({id:String(id),updatedAt:Date.now()});storeCloudDeletes();scheduleCloudSync(100);}
  function escapeHtml(value){return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function safeUrl(url){try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}}
  function renderMarkdown(input){
    let text = String(input ?? '').replace(/\r\n?/g,'\n');
    const blocks=[];
    text=text.replace(/```([\w+#.-]*)\n([\s\S]*?)```/g,(_,lang,code)=>{const i=blocks.length;blocks.push(`<div class="code-block"><div class="code-block-head"><span>${escapeHtml(lang||'code')}</span><button class="copy-code" data-copy-code="${i}">Копировать код</button></div><pre><code>${escapeHtml(code.replace(/\n$/,''))}</code></pre></div>`);return `\n§§CODE${i}§§\n`;});
    text=escapeHtml(text);
    text=text.replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>');
    text=text.replace(/^> ?(.+)$/gm,'<blockquote>$1</blockquote>');
    text=text.replace(/^\s*[-*] (.+)$/gm,'<li>$1</li>');
    text=text.replace(/(?:<li>.*<\/li>\n?)+/g,m=>`<ul>${m}</ul>`);
    text=text.replace(/^\s*\d+\. (.+)$/gm,'<li>$1</li>');
    text=text.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/`([^`\n]+)`/g,'<code>$1</code>');
    text=text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(_,label,url)=>{const safe=safeUrl(url);return safe?`<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>`:label;});
    text=text.split(/\n{2,}/).map(chunk=>{
      const trimmed=chunk.trim();
      if(!trimmed) return '';
      if(/^<(h[1-3]|ul|ol|blockquote|div|pre)/.test(trimmed) || /^§§CODE\d+§§$/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g,'<br>')}</p>`;
    }).join('');
    text=text.replace(/§§CODE(\d+)§§/g,(_,i)=>blocks[Number(i)]||'');
    return text;
  }
  function currentTheme(){return THEMES.find(t=>t.id===state.theme)||THEMES[0];}
  function currentConversation(){return state.conversations.find(c=>c.id===state.currentId)||null;}
  function formatTime(ts){try{return new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'}).format(new Date(ts));}catch{return '';}}
  function applyState(){
    document.body.dataset.theme=currentTheme().id;
    document.body.classList.toggle('reduce-motion',!!state.reduceMotion);
    document.body.classList.toggle('compact',!!state.compactMode);
    $('#themeLabel').textContent=currentTheme().name;
    $('#composerTheme').textContent=currentTheme().name;
    $('#themeSwatch').style.background=currentTheme().color;
    $('#themeSwatch').style.boxShadow=`0 0 12px ${currentTheme().color}55`;
    $('#profileName').textContent=state.profileName?.trim()||'Гость KOKTUR';
    $('#avatarInitial').textContent=(state.profileName?.trim()?.[0]||'K').toUpperCase();
    $('#largeAvatar').textContent=$('#avatarInitial').textContent;
    $('#profileModalName').textContent=state.profileName?.trim()||'Гость KOKTUR';
    $('#displayName').value=state.profileName||'';
    $('#reduceMotion').checked=!!state.reduceMotion;
    $('#compactMode').checked=!!state.compactMode;
    $('#thinkToggle').setAttribute('aria-pressed',String(!!state.deepReasoning));
    $('#thinkToggle').classList.toggle('is-active',!!state.deepReasoning);
    $('#apiEndpoint').value=state.apiEndpoint;
    const site=CONFIG.websiteUrl && safeUrl(CONFIG.websiteUrl);
    const siteLink=$('#websiteLink');
    if(site){siteLink.href=site;siteLink.hidden=false;} else siteLink.hidden=true;
    renderSocials();
    renderHistory();
    renderConversation();
    syncBreadcrumb();
  }
  function renderSocials(){
    const area=$('#socialLinks'); area.innerHTML='';
    const socials=CONFIG.socials||{};
    const labels={instagram:'IG',telegram:'TG',youtube:'YT',tiktok:'TT'};
    Object.entries(labels).forEach(([key,label])=>{const url=safeUrl(socials[key]||'');if(!url)return;const a=document.createElement('a');a.className='social-link';a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label;a.title=key[0].toUpperCase()+key.slice(1);a.setAttribute('aria-label',`KOKTUR в ${key}`);area.append(a);});
  }
  function syncBreadcrumb(){
    const viewNames={chat: currentConversation()?.title||'Новый диалог',history:'История диалогов',library:'Библиотека'};
    $('#breadcrumb').innerHTML=`Пространство интеллекта <span>/</span> <strong>${escapeHtml(viewNames[activeView]||'KOKTUR')}</strong>`;
  }
  function renderHistory(){
    const list=$('#historyList');const q=($('#historySearch').value||'').trim().toLowerCase();list.innerHTML='';
    const rows=[...state.conversations].sort((a,b)=>b.updatedAt-a.updatedAt).filter(c=>!q||c.title.toLowerCase().includes(q)||c.messages.some(m=>m.content.toLowerCase().includes(q))).slice(0,30);
    if(!rows.length){const empty=document.createElement('div');empty.className='history-empty';empty.textContent=q?'Ничего не найдено':'Твои новые диалоги появятся здесь.';list.append(empty);return;}
    for(const chat of rows){list.append(createConversationRow(chat,'history-row'));}
  }
  function createConversationRow(chat, rowClass='history-row'){
    const row=document.createElement('div');row.className=rowClass;
    const open=document.createElement('button');open.className='history-item'+(chat.id===state.currentId?' active':'');open.dataset.openChat=chat.id;open.innerHTML=`<span class="history-glyph">◌</span><span class="history-title">${escapeHtml(chat.title||'Новый диалог')}</span>`;open.title=chat.title||'Новый диалог';
    const actions=document.createElement('span');actions.className='history-actions';
    const rename=document.createElement('button');rename.className='history-action';rename.type='button';rename.dataset.renameChat=chat.id;rename.title='Переименовать диалог';rename.setAttribute('aria-label','Переименовать диалог');rename.textContent='✎';
    const remove=document.createElement('button');remove.className='history-action danger';remove.type='button';remove.dataset.deleteChat=chat.id;remove.title='Удалить диалог';remove.setAttribute('aria-label','Удалить диалог');remove.textContent='×';
    actions.append(rename,remove);row.append(open,actions);return row;
  }
  function renameConversation(id){
    const chat=state.conversations.find(item=>item.id===id);if(!chat)return;
    const title=prompt('Новое название диалога:',chat.title||'Новый диалог');if(title===null)return;
    const clean=title.trim().replace(/\s+/g,' ').slice(0,70);if(!clean){toast('Название не может быть пустым.','error');return;}
    chat.title=clean;chat.updatedAt=Date.now();saveState();renderHistory();if(activeView==='history')setView('history');syncBreadcrumb();toast('Название диалога изменено.');
  }
  function deleteConversation(id){
    const chat=state.conversations.find(item=>item.id===id);if(!chat)return;
    if(!confirm(`Удалить диалог «${chat.title||'Новый диалог'}»? Это действие нельзя отменить.`))return;
    queueCloudDelete(id);state.conversations=state.conversations.filter(item=>item.id!==id);
    if(state.currentId===id){state.currentId=[...state.conversations].sort((a,b)=>b.updatedAt-a.updatedAt)[0]?.id||null;activeView='chat';showChatView();renderConversation();}
    saveState();renderHistory();if(activeView==='history')setView('history');syncBreadcrumb();toast('Диалог удалён.');
  }
  function createConversation(){const c={id:uid(),title:'Новый диалог',createdAt:Date.now(),updatedAt:Date.now(),messages:[]};state.conversations.push(c);state.currentId=c.id;saveState();activeView='chat';showChatView();renderHistory();renderConversation();$('#messageInput').focus();}
  function showChatView(){
    $('#welcome').hidden=!!currentConversation()?.messages?.length;
    $('#conversation').hidden=false;$('#alternateView').hidden=true;
    $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view==='chat'));
    syncBreadcrumb();
  }
  function renderConversation(){
    const c=currentConversation();const box=$('#conversation');box.innerHTML='';
    if(!c||!c.messages.length){box.hidden=true;$('#welcome').hidden=false;return;}
    $('#welcome').hidden=true;box.hidden=false;
    for(const msg of c.messages){box.append(makeMessage(msg));}
    scrollToBottom(false);
  }
  function makeMessage(msg){
    const wrap=document.createElement('article');wrap.className=`message ${msg.role==='user'?'user':'assistant'}`;wrap.dataset.messageId=msg.id||'';
    const avatar=document.createElement('div');avatar.className='message-avatar'+(msg.role==='assistant'?' assistant-emblem':'');
    if(msg.role==='assistant'){const img=document.createElement('img');img.src='assets/koktur-mark.svg';img.alt='';img.width=27;img.height=27;avatar.append(img);}else avatar.textContent=(state.profileName?.[0]||'Я').toUpperCase();
    const main=document.createElement('div');main.className='message-main';
    const meta=document.createElement('div');meta.className='message-meta';const who=document.createElement('strong');who.textContent=msg.role==='user'?(state.profileName||'Ты'):'KOKTUR';const time=document.createElement('span');time.textContent=formatTime(msg.createdAt||Date.now());meta.append(who,time);
    const content=document.createElement('div');content.className='message-content';content.innerHTML=renderMarkdown(msg.content||'');
    main.append(meta,content);
    if(msg.role==='assistant' && msg.content){const actions=document.createElement('div');actions.className='message-actions';const copy=document.createElement('button');copy.className='message-action';copy.textContent='Копировать';copy.dataset.copyMessage=msg.id||'';const save=document.createElement('button');save.className='message-action';save.textContent='Сохранить в библиотеку';save.dataset.saveMessage=msg.id||'';actions.append(copy,save);main.append(actions);}
    wrap.append(avatar,main);return wrap;
  }
  function scrollToBottom(smooth=true){const w=$('#workspace');if(!w)return;requestAnimationFrame(()=>w.scrollTo({top:w.scrollHeight,behavior:smooth&&!state.reduceMotion?'smooth':'auto'}));}
  function renderThemeGrid(){
    const grid=$('#themeGrid');grid.innerHTML='';
    THEMES.forEach(theme=>{const b=document.createElement('button');b.className='theme-option'+(theme.id===state.theme?' selected':'');b.style.setProperty('--theme-color',theme.color);b.style.setProperty('--theme-bg',theme.bg);b.innerHTML=`<span class="theme-preview"></span><span class="theme-option-copy"><strong>${escapeHtml(theme.name)}</strong><small>${escapeHtml(theme.desc)}</small></span><span class="theme-check">✓</span>`;b.addEventListener('click',()=>{state.theme=theme.id;saveState();applyState();renderThemeGrid();$('#themeModal').close();$('#themeTrigger').setAttribute('aria-expanded','false');redrawAmbience();toast(`Тема «${theme.name}» включена.`);});grid.append(b);});
  }
  function toast(message,type=''){const node=document.createElement('div');node.className='toast'+(type?' '+type:'');node.textContent=message;$('#toastRegion').append(node);setTimeout(()=>node.remove(),3800);}
  function openDialog(id){const d=$(`#${id}`);if(!d)return;if(!d.open)d.showModal();}
  function closeSidebar(){if(innerWidth<=760){$('#sidebar').classList.remove('open');$('#mobileScrim').classList.remove('active');}}
  function toggleSidebar(){const open=$('#sidebar').classList.toggle('open');$('#mobileScrim').classList.toggle('active',open);}
  function setView(view){
    activeView=view;
    $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===view));
    $('#welcome').hidden=true;$('#conversation').hidden=true;$('#alternateView').hidden=true;
    if(view==='chat') showChatView();
    else if(view==='history'){
      const box=$('#alternateView');box.hidden=false;box.innerHTML=`<div class="eyebrow left-eyebrow">YOUR CONVERSATIONS</div><h1>История диалогов</h1><p>Открывай прошлые разговоры или ищи по их содержимому. Данные хранятся только в этом браузере.</p><div class="alternate-list" id="allHistory"></div>`;
      const list=$('#allHistory');const chats=[...state.conversations].sort((a,b)=>b.updatedAt-a.updatedAt);if(!chats.length){list.innerHTML='<div class="library-empty">Пока нет диалогов. Создай новый разговор с KOKTUR.</div>';}else chats.forEach(c=>{const wrap=createConversationRow(c,'history-row history-row-expanded');const open=$('[data-open-chat]',wrap);open.classList.add('alternate-row');open.innerHTML=`<span>◷</span><span style="flex:1;min-width:0"><strong>${escapeHtml(c.title)}</strong><small>${c.messages.length} сообщений · ${escapeHtml(new Date(c.updatedAt).toLocaleDateString('ru-RU'))}</small></span><span>↗</span>`;list.append(wrap);});
    } else if(view==='library'){
      const box=$('#alternateView');box.hidden=false;box.innerHTML=`<div class="eyebrow left-eyebrow">YOUR KNOWLEDGE SPACE</div><h1>Библиотека</h1><p>Сохраняй полезные ответы из диалогов и возвращайся к ним позже.</p><div class="alternate-list" id="libraryList"></div>`;
      const list=$('#libraryList');if(!state.library.length)list.innerHTML='<div class="library-empty">В библиотеке пока пусто. Нажми «Сохранить в библиотеку» под ответом KOKTUR.</div>';else state.library.slice().reverse().forEach(item=>{const row=document.createElement('div');row.className='alternate-row';row.innerHTML=`<span>▤</span><span style="flex:1;min-width:0"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.content.slice(0,150))}${item.content.length>150?'…':''}</small></span><button class="message-action" data-library-copy="${escapeHtml(item.id)}">Копировать</button>`;list.append(row);});
    }
    syncBreadcrumb();closeSidebar();
  }
  async function healthCheck(){
    const light=$('#statusLight');const label=$('#connectionLabel');
    try{const r=await fetch(`${state.apiEndpoint.replace(/\/$/,'')}/health`,{method:'GET',headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(7000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);const data=await r.json();light.className='status-light online';label.textContent=`Ядро онлайн · ${data.version||'готово'}`;$('#coreVersion').textContent=data.model?'AI READY':'WEB 1.0';window.dispatchEvent(new CustomEvent('koktur-core-status',{detail:{online:true,version:data.version||''}}));return true;}
    catch{light.className='status-light offline';label.textContent='Ядро не отвечает';$('#coreVersion').textContent='OFFLINE';window.dispatchEvent(new CustomEvent('koktur-core-status',{detail:{online:false}}));return false;}
  }
  function createTypingBubble(){
    const wrap=document.createElement('article');wrap.className='message assistant';wrap.dataset.typing='true';
    const avatar=document.createElement('div');avatar.className='message-avatar assistant-emblem';avatar.innerHTML='<img src="assets/koktur-mark.svg" alt="" width="27" height="27">';
    const main=document.createElement('div');main.className='message-main';const meta=document.createElement('div');meta.className='message-meta';meta.innerHTML='<strong>KOKTUR</strong><span>сейчас</span>';
    const status=document.createElement('div');status.className='typing-status';status.innerHTML='<span class="typing-mini-logo"><img src="assets/koktur-mark.svg" alt="" width="20" height="20"></span><strong>Обдумываю запрос</strong><span class="typing-bars"><i></i><i></i><i></i></span>';
    main.append(meta,status);wrap.append(avatar,main);$('#conversation').append(wrap);scrollToBottom();return {wrap,status,main};
  }
  function updateTypingLabel(el,label){const strong=$('strong',el);if(strong)strong.textContent=label;}
  function appendAssistantMessage(text,animateFallback=false){
    const c=currentConversation();const msg={id:uid(),role:'assistant',content:'',createdAt:Date.now()};c.messages.push(msg);c.updatedAt=Date.now();saveState();
    const node=makeMessage(msg);$('#conversation').append(node);const content=$('.message-content',node);content.innerHTML='';
    const cursor=document.createElement('span');cursor.className='stream-cursor';content.append(cursor);
    if(animateFallback){let index=0;const words=text.match(/\s+|[^\s]+/g)||[text];const step=()=>{if(!node.isConnected)return;if(index>=words.length){msg.content=text;content.innerHTML=renderMarkdown(text);cursor.remove();saveState();renderHistory();return;}const count=state.reduceMotion?8:Math.min(3,words.length-index);for(let i=0;i<count;i++)cursor.before(document.createTextNode(words[index++]));scrollToBottom(false);requestAnimationFrame(()=>setTimeout(step,state.reduceMotion?0:17));};step();}
    return {msg,node,content,cursor};
  }
  function appendText(stream,text){if(!text)return;stream.msg.content+=text;stream.cursor.before(document.createTextNode(text));scrollToBottom(false);}
  function finishStream(stream){stream.cursor.remove();stream.content.innerHTML=renderMarkdown(stream.msg.content);stream.msg.createdAt=stream.msg.createdAt||Date.now();saveState();renderHistory();scrollToBottom(false);}
  async function sendMessage(forcedText){
    if(sending)return;
    const input=$('#messageInput');const message=(forcedText??input.value).trim();if(!message)return;
    if(message.length>8000){toast('Сообщение слишком длинное. Лимит — 8000 символов.','error');return;}
    if(activeView!=='chat')setView('chat');
    let c=currentConversation();if(!c){createConversation();c=currentConversation();}
    c.messages.push({id:uid(),role:'user',content:message,createdAt:Date.now()});
    if(c.title==='Новый диалог'){c.title=message.replace(/\s+/g,' ').slice(0,52)+(message.length>52?'…':'');}
    c.updatedAt=Date.now();saveState();input.value='';resizeInput();$('#sendBtn').disabled=true;renderHistory();renderConversation();
    sending=true;$('#sendBtn').innerHTML='<span>Стоп</span><span class="send-arrow">■</span>';$('#sendBtn').disabled=false;$('#sendBtn').setAttribute('aria-label','Остановить ответ');
    abortController=new AbortController();const timer=setTimeout(()=>abortController?.abort('timeout'),120000);
    const typing=createTypingBubble();let liveStream=null;currentThinking=$('#thinkToggle').getAttribute('aria-pressed')==='true';
    const history=c.messages.slice(0,-1).slice(-6).map(m=>({role:m.role,content:m.content}));
    try{
      const requestMessage=message;
      const url=`${state.apiEndpoint.replace(/\/$/,'')}/api/chat?stream=1`;
      const currentHistory=[...history,{role:'user',content:requestMessage}];
      const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'text/event-stream',...(cloudSession?.token?{Authorization:`Bearer ${cloudSession.token}`}:{})},body:JSON.stringify({message:requestMessage,history,messages:currentHistory,stream:true,mode:currentThinking?'deep':'balanced',deepReasoning:currentThinking,reasoning:currentThinking?'deep':'balanced',reasoningEffort:currentThinking?'high':'low',maxTokens:currentThinking?4096:1536}),signal:abortController.signal,cache:'no-store'});
      if(!response.ok){let reason=`HTTP ${response.status}`;try{const body=await response.json();reason=body.error||body.code||reason;}catch{}throw new Error(reason);}
      const contentType=response.headers.get('Content-Type')||'';
      typing.wrap.remove();
      const stream=appendAssistantMessage('',false);liveStream=stream;
      if(contentType.includes('text/event-stream')&&response.body){
        const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';let first=true;
        while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:!done});let split;while((split=buffer.search(/\r?\n\r?\n/))!==-1){const frame=buffer.slice(0,split);buffer=buffer.slice(split+ (buffer.startsWith('\r\n',split)?4:2));const data=frame.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');if(!data||data==='[DONE]')continue;let parsed;try{parsed=JSON.parse(data);}catch{appendText(stream,data);continue;}const delta=extractDelta(parsed);if(delta){if(first){first=false;scrollToBottom(false);}appendText(stream,delta);}if(parsed.error)throw new Error('KOKTUR временно не смог завершить ответ.');}}
        const tail=buffer.trim();if(tail.startsWith('data:')){const raw=tail.slice(5).trim();if(raw&&raw!=='[DONE]'){try{const delta=extractDelta(JSON.parse(raw));if(delta)appendText(stream,delta);}catch{}}}
      }else{
        const body=await response.json();const answer=extractDelta(body);if(!answer)throw new Error(body?.error||body?.message||body?.code||`Сервер вернул пустой ответ (HTTP ${response.status}).`);stream.node.remove();const chat=currentConversation();if(chat)chat.messages=chat.messages.filter(m=>m.id!==stream.msg.id);liveStream=null;appendAssistantMessage(String(answer),true);
      }
      if(!stream.msg.content.trim() && $('#conversation').contains(stream.node)) {stream.node.remove();throw new Error('Сервер не вернул текст. Проверь формат потокового ответа Worker.');}
      if($('#conversation').contains(stream.node))finishStream(stream);liveStream=null;
      const now=currentConversation();if(now){now.updatedAt=Date.now();saveState();}
    }catch(error){typing.wrap.remove();if(liveStream){liveStream.cursor?.remove();if(!liveStream.msg.content.trim()){const c3=currentConversation();if(c3)c3.messages=c3.messages.filter(m=>m.id!==liveStream.msg.id);liveStream.node.remove();}else{saveState();if($('#conversation').contains(liveStream.node))finishStream(liveStream);}}const cancelled=error?.name==='AbortError'||abortController?.signal.aborted;if(cancelled){toast('Генерация остановлена.');}else{const errMsg=error?.message==='Failed to fetch'?'Не удалось подключиться к KOKTUR CORE. Проверь интернет и настройки адреса сервера.':`Не удалось получить ответ: ${error?.message||'неизвестная ошибка'}`;toast(errMsg,'error');const c2=currentConversation();if(c2){c2.messages.push({id:uid(),role:'assistant',content:`Не получилось получить ответ. ${errMsg}`,createdAt:Date.now(),error:true});c2.updatedAt=Date.now();saveState();renderConversation();}}
    }finally{clearTimeout(timer);sending=false;abortController=null;$('#sendBtn').innerHTML='<span>Отправить</span><span class="send-arrow">↗</span>';$('#sendBtn').setAttribute('aria-label','Отправить сообщение');$('#sendBtn').disabled=!$('#messageInput').value.trim();$('#messageInput').focus();}
  }
  function extractDelta(obj){
    if(typeof obj==='string')return obj;
    if(!obj||typeof obj!=='object')return '';
    for(const key of ['response','reply','response_delta','text_delta','output_text','answer','token','text','delta'])if(typeof obj[key]==='string')return obj[key];
    if(typeof obj.message==='string')return obj.message;
    if(typeof obj.message?.content==='string')return obj.message.content;
    if(obj.choices?.[0]?.delta?.content)return String(obj.choices[0].delta.content);
    if(obj.choices?.[0]?.message?.content)return String(obj.choices[0].message.content);
    if(obj.choices?.[0]?.text)return String(obj.choices[0].text);
    for(const key of ['data','result','output'])if(obj[key]&&typeof obj[key]==='object'){const nested=extractDelta(obj[key]);if(nested)return nested;}
    if(Array.isArray(obj.content)){const joined=obj.content.map(item=>typeof item?.text==='string'?item.text:'').join('');if(joined)return joined;}
    return '';
  }
  function resizeInput(){const el=$('#messageInput');el.style.height='auto';el.style.height=`${Math.min(el.scrollHeight,180)}px`;$('#sendBtn').disabled=sending?!sending:!el.value.trim();}
  function stopGeneration(){if(sending&&abortController){abortController.abort();toast('Останавливаю генерацию…');}}
  async function copyText(text){try{await navigator.clipboard.writeText(text);toast('Скопировано.');}catch{const input=document.createElement('textarea');input.value=text;document.body.append(input);input.select();const ok=document.execCommand('copy');input.remove();toast(ok?'Скопировано.':'Не удалось скопировать.','error');}}
  function downloadJson(data,filename){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function saveToLibrary(id){const msg=state.conversations.flatMap(c=>c.messages).find(m=>m.id===id);if(!msg||msg.role!=='assistant')return;state.library.push({id:uid(),title:msg.content.split('\n')[0].slice(0,65)||'Ответ KOKTUR',content:msg.content,createdAt:Date.now()});state.library=state.library.slice(-100);saveState();toast('Ответ добавлен в библиотеку.');}
  function bindEvents(){
    $('#newChatBtn').addEventListener('click',createConversation);
    $('#openSidebar').addEventListener('click',toggleSidebar);$('#closeSidebar').addEventListener('click',closeSidebar);$('#mobileScrim').addEventListener('click',closeSidebar);
    $('#themeTrigger').addEventListener('click',()=>{renderThemeGrid();openDialog('themeModal');$('#themeTrigger').setAttribute('aria-expanded','true');});
    $('#settingsBtn').addEventListener('click',()=>openDialog('settingsModal'));
    $('#profileBtn').addEventListener('click',()=>{cloudRenderAccount();openDialog('profileModal');});
    $('#openAccountBtn').addEventListener('click',()=>{setAuthMode('login');cloudRenderAccount();openDialog('accountModal');if(cloudSession?.token)cloudSyncNow({quiet:true});});
    $('#cloudLoginBtn').addEventListener('click',()=>performCloudAuth('login'));
    $('#cloudRegisterBtn').addEventListener('click',()=>performCloudAuth('register'));
    $('#cloudSyncBtn').addEventListener('click',()=>cloudSyncNow({quiet:false}));
    $('#cloudLogoutBtn').addEventListener('click',performCloudLogout);
    $('#cloudPassword').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();performCloudAuth(authMode);}});
    $('#editProfile').addEventListener('click',()=>{ $('#profileModal').close();openDialog('settingsModal');chooseSettingsTab('general');$('#displayName').focus();});
    $('#suggestionGrid').addEventListener('click',e=>{const b=e.target.closest('[data-prompt]');if(b)sendMessage(b.dataset.prompt);});
    $('#sendBtn').addEventListener('click',()=>sending?stopGeneration():sendMessage());
    $('#messageInput').addEventListener('input',resizeInput);
    $('#messageInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();sendMessage();}});
    $('#thinkToggle').addEventListener('click',()=>{state.deepReasoning=$('#thinkToggle').getAttribute('aria-pressed')!=='true';$('#thinkToggle').setAttribute('aria-pressed',String(state.deepReasoning));$('#thinkToggle').classList.toggle('is-active',state.deepReasoning);saveState();toast(state.deepReasoning?'Глубокое размышление включено: следующий запрос отправится с reasoning_effort=high.':'Обычный режим включён.');});
    $('#attachHint').addEventListener('click',()=>toast('Загрузка файлов пока не подключена к серверному API.'));
    $('#historySearch').addEventListener('input',renderHistory);$('#clearSearch').addEventListener('click',()=>{$('#historySearch').value='';renderHistory();$('#historySearch').focus();});
    $$('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
    $$('[data-close]').forEach(b=>b.addEventListener('click',()=>{const d=$(`#${b.dataset.close}`);if(d?.open)d.close();if(d?.id==='themeModal')$('#themeTrigger').setAttribute('aria-expanded','false');}));
    $('#themeModal').addEventListener('close',()=>$('#themeTrigger').setAttribute('aria-expanded','false'));
    $$('.settings-tab').forEach(b=>b.addEventListener('click',()=>chooseSettingsTab(b.dataset.settingsTab)));
    $('#saveSettings').addEventListener('click',()=>{const name=$('#displayName').value.trim();const endpoint=$('#apiEndpoint').value.trim().replace(/\/$/,'');if(!/^https?:\/\//i.test(endpoint)){toast('Адрес API должен начинаться с http:// или https://.','error');chooseSettingsTab('connection');return;}state.profileName=name;state.reduceMotion=$('#reduceMotion').checked;state.compactMode=$('#compactMode').checked;state.apiEndpoint=endpoint;saveState();applyState();$('#settingsModal').close();redrawAmbience();toast('Настройки сохранены на этом устройстве.');});
    $('#testConnection').addEventListener('click',async()=>{const result=$('#connectionTestResult');result.className='test-result';result.textContent='Проверяю…';const endpoint=$('#apiEndpoint').value.trim().replace(/\/$/,'');try{const r=await fetch(`${endpoint}/health`,{cache:'no-store',signal:AbortSignal.timeout(7000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);const data=await r.json();result.className='test-result success';result.textContent=`Связь работает. ${data.service||'KOKTUR CORE'} · версия ${data.version||'не указана'}.`;toast('KOKTUR CORE доступен.');}catch(e){result.className='test-result error';result.textContent=`Проверка не пройдена: ${e.message||'сеть недоступна'}. Проверь URL и CORS Worker.`;}});
    $('#exportData').addEventListener('click',()=>downloadJson(state,`koktur-export-${new Date().toISOString().slice(0,10)}.json`));
    $('#clearAllData').addEventListener('click',()=>{if(!confirm('Удалить историю, библиотеку и локальные настройки KOKTUR из этого браузера? Это действие нельзя отменить.'))return;localStorage.removeItem(STORAGE_KEY);state=defaultState();saveState();applyState();$('#settingsModal').close();toast('Локальные данные очищены.');});
    document.addEventListener('click',e=>{const openChat=e.target.closest('[data-open-chat]');if(openChat){state.currentId=openChat.dataset.openChat;activeView='chat';saveState();showChatView();renderHistory();renderConversation();closeSidebar();return;}const renameChat=e.target.closest('[data-rename-chat]');if(renameChat){e.preventDefault();e.stopPropagation();renameConversation(renameChat.dataset.renameChat);return;}const deleteChat=e.target.closest('[data-delete-chat]');if(deleteChat){e.preventDefault();e.stopPropagation();deleteConversation(deleteChat.dataset.deleteChat);return;}const copy=e.target.closest('[data-copy-message]');if(copy){const id=copy.dataset.copyMessage;const msg=state.conversations.flatMap(c=>c.messages).find(m=>m.id===id);if(msg)copyText(msg.content);return;}const save=e.target.closest('[data-save-message]');if(save){saveToLibrary(save.dataset.saveMessage);return;}const code=e.target.closest('[data-copy-code]');if(code){const n=Number(code.dataset.copyCode);const blocks=[...e.target.closest('.message-main').querySelectorAll('.code-block pre code')];if(blocks[n])copyText(blocks[n].textContent);return;}const lib=e.target.closest('[data-library-copy]');if(lib){const item=state.library.find(i=>i.id===lib.dataset.libraryCopy);if(item)copyText(item.content);}});
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();createConversation();}if(e.key==='Escape')closeSidebar();});
    window.addEventListener('resize',()=>{if(innerWidth>760)closeSidebar();});
  }
  function chooseSettingsTab(tab){$$('.settings-tab').forEach(b=>b.classList.toggle('active',b.dataset.settingsTab===tab));$$('[data-settings-pane]').forEach(p=>p.hidden=p.dataset.settingsPane!==tab);}

  // Low-cost seasonal ambience on canvas. Effects never sit over the chat UI.
  let canvas=$('#ambience'),ctx=canvas.getContext('2d'),particles=[],raf=0,lastFrame=0;
  function resizeCanvas(){const dpr=Math.min(window.devicePixelRatio||1,1.5);canvas.width=Math.floor(innerWidth*dpr);canvas.height=Math.floor(innerHeight*dpr);canvas.style.width=`${innerWidth}px`;canvas.style.height=`${innerHeight}px`;ctx.setTransform(dpr,0,0,dpr,0,0);particles=[];const theme=currentTheme();const count=state.reduceMotion||theme.effect==='none'?0:(theme.effect==='snow'?48:theme.effect==='petals'?18:theme.effect==='embers'?20:theme.effect==='lanterns'?12:16);for(let i=0;i<count;i++)particles.push(makeParticle(theme,true));}
  function makeParticle(theme,randomY=false){const w=innerWidth,h=innerHeight;return{x:Math.random()*w,y:randomY?Math.random()*h:-10-Math.random()*h,r:theme.effect==='snow'?1+Math.random()*2.2:1+Math.random()*2.8,vx:(Math.random()-.5)*(theme.effect==='snow'?.45:.8),vy:theme.effect==='snow'?.35+Math.random()*.8:.18+Math.random()*.65,phase:Math.random()*Math.PI*2,spin:(Math.random()-.5)*.025,alpha:.18+Math.random()*.4,kind:theme.effect};}
  function redrawAmbience(){resizeCanvas();if(!raf&&!state.reduceMotion)raf=requestAnimationFrame(drawAmbience);}
  function drawAmbience(now=0){raf=0;if(document.hidden)return;if(document.body.classList.contains('landing-active')){ctx.clearRect(0,0,innerWidth,innerHeight);return;}if(state.reduceMotion){ctx.clearRect(0,0,innerWidth,innerHeight);return;}if(now-lastFrame<32){raf=requestAnimationFrame(drawAmbience);return;}lastFrame=now;ctx.clearRect(0,0,innerWidth,innerHeight);const theme=currentTheme();for(const p of particles){p.phase+=.012;p.x+=p.vx+Math.sin(p.phase)*.23;p.y+=p.vy;if(p.kind==='snow'){ctx.globalAlpha=p.alpha;ctx.fillStyle=theme.id==='newyear'?'#fff1ef':'#e5faff';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}else if(p.kind==='petals'){ctx.globalAlpha=p.alpha;ctx.fillStyle=theme.id==='nauryz'?(Math.random()>.45?'#f0c2a7':'#e7bf47'):'#d89cc6';ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.phase);ctx.beginPath();ctx.ellipse(0,0,p.r*1.4,p.r*.65,0,0,Math.PI*2);ctx.fill();ctx.restore();}else if(p.kind==='embers'){ctx.globalAlpha=p.alpha;ctx.fillStyle=Math.random()>.6?'#ffbf68':'#df6b36';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}else if(p.kind==='lanterns'){ctx.globalAlpha=p.alpha*.8;ctx.strokeStyle='#f0c779';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(p.x,p.y-5);ctx.lineTo(p.x,p.y+5);ctx.stroke();ctx.fillStyle='#f0c779';ctx.beginPath();ctx.ellipse(p.x,p.y,2,4,0,0,Math.PI*2);ctx.fill();}else{ctx.globalAlpha=p.alpha;ctx.fillStyle=theme.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r*.8,0,Math.PI*2);ctx.fill();}if(p.y>innerHeight+15||p.x<-15||p.x>innerWidth+15){p.x=Math.random()*innerWidth;p.y=-10;}}ctx.globalAlpha=1;raf=requestAnimationFrame(drawAmbience);}
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&raf){cancelAnimationFrame(raf);raf=0;}else if(!document.hidden&&!raf)raf=requestAnimationFrame(drawAmbience);});window.addEventListener('resize',redrawAmbience);

  applyState();initLanding();bindEvents();resizeInput();redrawAmbience();healthCheck();renderThemeGrid();cloudRenderAccount();if(cloudSession?.token){cloudSyncNow({quiet:true});setInterval(()=>cloudSyncNow({quiet:true}),30000);}
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) { navigator.serviceWorker.register('./sw.js').catch(() => {}); }
})();
