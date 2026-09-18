const $=id=>document.getElementById(id);
let current=null;
let installedVersionCache='';
let launcherUpdateCache={available:false};
let launcherVersionCache='';

function fmtDate(v){if(!v)return '—';const d=new Date(v);return isNaN(d)?'—':d.toLocaleDateString('pt-BR')}
function compare(a,b){
  const A=String(a||'0').replace(/^v/i,'').split('.').map(Number);
  const B=String(b||'0').replace(/^v/i,'').split('.').map(Number);
  for(let i=0;i<Math.max(A.length,B.length);i++){const d=(A[i]||0)-(B[i]||0);if(d)return d}
  return 0;
}
function finishStartup(){const s=$('startup-screen');if(s)s.style.display='none'}
function showLogin(){finishStartup();$('login-card').hidden=false;$('panel').hidden=true}
function showPanel(){finishStartup();$('login-card').hidden=true;$('panel').hidden=false}
function msg(t){$('panel-msg').textContent=t||''}

function updateFooter(){
  const el=$('launcher-version');
  if(el)el.textContent='FIRE BLAZE Launcher v'+(launcherVersionCache||'—');
}

function renderAccount(a,installedVersion,launcherUpdate){
  current=a;
  if(!a?.logged){showLogin();return}
  showPanel();

  const launcherModal=$('mandatory-update-modal');
  const launcherTitle=$('mandatory-update-title');
  if(launcherUpdate?.available){
    if(launcherModal)launcherModal.style.display='grid';
    if(launcherTitle)launcherTitle.textContent='Atualizar Launcher para v'+launcherUpdate.latest;
  }else{
    if(launcherModal)launcherModal.style.display='none';
  }

  $('hello').textContent='Olá, '+(a.profile?.name||'Cliente');
  $('email-line').textContent=a.profile?.email||'';
  $('installed-version').textContent=installedVersion?'Instalada: v'+installedVersion:'Multi ainda não instalado';

  const st=$('status'),warn=$('warn'),renew=$('renew-box'),launch=$('launch');
  if(a.active){
    const days=Number(a.days_remaining??0);
    st.textContent=a.is_trial?'● TESTE GRÁTIS':'● ATIVA';
    st.className='status '+(a.warning?'warning':'active');
    $('days').textContent=days+' '+(days===1?'dia':'dias');
    $('expires').textContent=(a.is_trial?'Teste termina em ':'Vence em ')+fmtDate(a.subscription?.current_period_end);
    renew.style.display=(days<=3?'flex':'none');
    if(a.warning){
      warn.hidden=false;
      warn.textContent=a.is_trial?('🎁 Seu teste grátis termina em '+days+' dia'+(days===1?'':'s')+'. Assine para continuar usando depois do teste.'):('⚠ Sua assinatura termina em '+days+' dia'+(days===1?'':'s')+'. Renove para não interromper o acesso.');
    }else warn.hidden=true;
  }else{
    st.textContent='● EXPIRADA / INATIVA';
    st.className='status expired';
    $('days').textContent='0 dias';
    $('expires').textContent=current?.subscription?.access_kind==='trial'?'Teste grátis encerrado. Assine para liberar o Multi.':'Renove para voltar a usar o Multi.';
    warn.hidden=false;
    warn.textContent=current?.subscription?.access_kind==='trial'?'🔴 Seu teste grátis terminou. Sua conta continua conectada; assine para liberar o FIRE BLAZE Mult.':'🔴 O acesso ao FIRE BLAZE Mult está bloqueado até a renovação.';
    renew.style.display='flex';
  }

  const latest=a.latest_version;
  const update=$('update'),us=$('update-state'),cl=$('changelog');
  const multiModal=$('multi-update-modal');
  const multiTitle=$('multi-update-title');
  const multiText=$('multi-update-text');

  update.hidden=true;
  cl.textContent='';
  if(multiModal)multiModal.style.display='none';

  let multiNeedsUpdate=false;
  let mandatoryMulti=false;

  if(latest){
    multiNeedsUpdate=!installedVersion || compare(latest.version,installedVersion)>0;
    mandatoryMulti=multiNeedsUpdate && !!latest.is_mandatory;

    if(!installedVersion)us.textContent='Disponível: v'+latest.version;
    else if(multiNeedsUpdate)us.textContent=(latest.is_mandatory?'ATUALIZAÇÃO OBRIGATÓRIA: ':'Atualização disponível: ')+'v'+latest.version;
    else us.textContent='Você está na versão atual.';

    cl.textContent=(latest.title||'')+(latest.changelog?'\n'+latest.changelog:'');

    if(multiNeedsUpdate && latest.is_mandatory){
      if(multiModal)multiModal.style.display='grid';
      if(multiTitle)multiTitle.textContent='Atualização obrigatória v'+latest.version;
      if(multiText)multiText.textContent='Sua versão instalada é '+(installedVersion?'v'+installedVersion:'nenhuma')+'. Atualize para v'+latest.version+' antes de abrir o Multi.';
    }else if(multiNeedsUpdate){
      update.hidden=false;
      update.textContent='ATUALIZAR PARA v'+latest.version;
    }
  }else{
    us.textContent='Nenhuma versão publicada.';
  }

  launch.disabled=!a.active || !!launcherUpdate?.available || mandatoryMulti;
  launch.textContent=mandatoryMulti?'ATUALIZE O MULTI PARA CONTINUAR':(!a.active&&a.subscription?.access_kind==='trial'?'🔒 ASSINE PARA ABRIR O MULTI':'🔥 ABRIR MULTI');
  updateFooter();
}

async function reloadFullState(){
  const s=await fireBlaze.state();
  installedVersionCache=s.installed_version||'';
  launcherUpdateCache=s.launcher_update||{available:false};
  launcherVersionCache=s.launcher_version||launcherUpdateCache.current||'';
  $('device').textContent=s.device_name||'';
  renderAccount(s.account,installedVersionCache,launcherUpdateCache);
  return s;
}

async function installLatestMulti(button,msgEl){
  if(button)button.disabled=true;
  if(msgEl)msgEl.textContent='Preparando atualização...';
  msg('Preparando atualização do FIRE BLAZE Mult...');
  try{
    const r=await fireBlaze.installMulti();
    if(r?.installed_version)installedVersionCache=r.installed_version;
    if(msgEl)msgEl.textContent='Atualização concluída.';
    msg('Atualização concluída.');
    await reloadFullState();
  }catch(e){
    const t=e.message||'Não foi possível atualizar o Multi.';
    if(msgEl)msgEl.textContent=t;
    msg(t);
  }finally{
    if(button)button.disabled=false;
  }
}

async function load(){
  try{await reloadFullState()}
  catch(e){finishStartup();showLogin();$('login-msg').textContent=e.message||'Erro ao carregar.'}
}

$('login').onclick=async()=>{
  const b=$('login');
  b.disabled=true;
  $('login-msg').textContent='Entrando...';
  try{
    await fireBlaze.login($('email').value.trim(),$('password').value);
    $('password').value='';
    $('login-msg').textContent='';
    await reloadFullState();
  }catch(e){
    $('login-msg').textContent=e.message||'Não foi possível entrar.';
  }finally{b.disabled=false}
};

$('logout').onclick=async()=>{await fireBlaze.logout();showLogin()};

$('launch').onclick=async()=>{
  const b=$('launch');
  b.disabled=true;
  msg('Validando licença e preparando o Multi...');
  try{
    const r=await fireBlaze.launch();
    if(r?.installed_version)installedVersionCache=r.installed_version;
    msg('FIRE BLAZE Mult aberto.');
    renderAccount(current,installedVersionCache,launcherUpdateCache);
  }catch(e){
    msg(e.message||'Não foi possível abrir.');
  }finally{
    setTimeout(()=>{if(current?.active)b.disabled=false},900);
  }
};

$('update').onclick=async()=>installLatestMulti($('update'),null);

$('multi-update-btn')?.addEventListener('click',async e=>{
  await installLatestMulti(e.currentTarget,$('multi-update-msg'));
});

document.querySelectorAll('[data-renew]').forEach(b=>b.onclick=async()=>{
  msg('Abrindo checkout seguro...');
  try{
    await fireBlaze.renew(b.dataset.renew);
    msg('Após pagar, volte aqui. O status será atualizado automaticamente.');
  }catch(e){msg(e.message||'Erro ao abrir pagamento.')}
});

fireBlaze.onInstallProgress(p=>{
  let t='';
  if(p.stage==='download')t='Baixando FIRE BLAZE Mult... '+(p.progress||0)+'%';
  else if(p.stage==='install')t='Instalando FIRE BLAZE Mult...';
  else if(p.stage==='done')t='Instalação concluída.';
  if(t){
    msg(t);
    const out=$('multi-update-msg');
    if(out)out.textContent=t;
  }
});

setInterval(async()=>{
  try{
    const a=await fireBlaze.refresh();
    renderAccount({logged:true,...a},installedVersionCache,launcherUpdateCache);
  }catch{}
},5000);

load();

fireBlaze.onStateRefresh?.(s=>{
  try{
    installedVersionCache=s?.installed_version||installedVersionCache;
    launcherUpdateCache=s?.launcher_update||launcherUpdateCache;
    launcherVersionCache=s?.launcher_version||launcherVersionCache;
    if(s?.device_name)$('device').textContent=s.device_name;
    if(s?.account)renderAccount(s.account,installedVersionCache,launcherUpdateCache);
  }catch{}
});

fireBlaze.onLauncherUpdateProgress?.(p=>{
  let t='';
  if(p?.stage==='install')t='Instalando atualização...';
  else if(p?.stage==='error')t='Erro ao atualizar: '+(p?.error||'falha desconhecida');
  else t='Baixando atualização... '+(p?.progress||0)+'%';
  msg(t);
  const out=$('mandatory-update-msg');
  if(out)out.textContent=t;
});

$('mandatory-update-btn')?.addEventListener('click',async e=>{
  const b=e.currentTarget;
  const out=$('mandatory-update-msg');
  b.disabled=true;
  if(out)out.textContent='Baixando atualização...';
  try{
    await fireBlaze.updateLauncher();
    if(out)out.textContent='Instalando atualização...';
  }catch(x){
    if(out)out.textContent=x.message||'Erro ao atualizar o Launcher.';
    b.disabled=false;
  }
});
