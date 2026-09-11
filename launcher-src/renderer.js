const $=id=>document.getElementById(id);let current=null;
function fmtDate(v){if(!v)return '—';const d=new Date(v);return isNaN(d)?'—':d.toLocaleDateString('pt-BR')}
function compare(a,b){const A=String(a||'0').replace(/^v/i,'').split('.').map(Number),B=String(b||'0').replace(/^v/i,'').split('.').map(Number);for(let i=0;i<Math.max(A.length,B.length);i++){const d=(A[i]||0)-(B[i]||0);if(d)return d}return 0}
function showLogin(){ $('login-card').hidden=false;$('panel').hidden=true }
function showPanel(){ $('login-card').hidden=true;$('panel').hidden=false }
function msg(t){$('panel-msg').textContent=t||''}
function renderAccount(a,installedVersion,launcherUpdate){
  current=a;if(!a?.logged){showLogin();return}showPanel();
  const modal=$('mandatory-update-modal'),mb=$('mandatory-update-btn'),mt=$('mandatory-update-title');
  if(launcherUpdate?.available){
    if(modal)modal.style.display='grid';
    if(mt)mt.textContent='Atualizar Launcher para v'+launcherUpdate.latest;
    const launchBtn=$('launch'); if(launchBtn)launchBtn.disabled=true;
  }else{
    if(modal)modal.style.display='none';
  }
  $('hello').textContent='Olá, '+(a.profile?.name||'Cliente');$('email-line').textContent=a.profile?.email||'';
  $('installed-version').textContent=installedVersion?'Instalada: v'+installedVersion:'Multi ainda não instalado';
  const st=$('status'),warn=$('warn'),renew=$('renew-box'),launch=$('launch');
  if(a.active){
    const days=Number(a.days_remaining??0);
    st.textContent='● ATIVA';
    st.className='status '+(a.warning?'warning':'active');
    $('days').textContent=days+' dias';
    $('expires').textContent='Vence em '+fmtDate(a.subscription?.current_period_end);
    renew.style.display=(days<=3?'flex':'none');
    launch.disabled=!!launcherUpdate?.available;
    if(a.warning){
      warn.hidden=false;
      warn.textContent='⚠ Sua assinatura termina em '+days+' dia'+(days===1?'':'s')+'. Renove para não interromper o acesso.';
    }else warn.hidden=true;
  }else{
    st.textContent='● EXPIRADA / INATIVA';
    st.className='status expired';
    $('days').textContent='0 dias';
    $('expires').textContent='Renove para voltar a usar o Multi.';
    warn.hidden=false;
    warn.textContent='🔴 O acesso ao FIRE BLAZE Mult está bloqueado até a renovação.';
    renew.style.display='flex';
    launch.disabled=true;
  }
  const latest=a.latest_version;const update=$('update'),us=$('update-state'),cl=$('changelog');update.hidden=true;cl.textContent='';
  if(latest){
    if(!installedVersion)us.textContent='Disponível: v'+latest.version;
    else if(compare(latest.version,installedVersion)>0)us.textContent=(latest.is_mandatory?'ATUALIZAÇÃO OBRIGATÓRIA: ':'Atualização disponível: ')+'v'+latest.version;
    else us.textContent='Você está na versão atual.';
    cl.textContent=(latest.title||'')+(latest.changelog?'\n'+latest.changelog:'');
  }else us.textContent='Nenhuma versão publicada.';
}
async function load(){try{
  const s=await fireBlaze.state();
  $('device').textContent=s.device_name||'';
  // Atualização do Launcher vem antes de qualquer tela: bloqueia tudo até atualizar.
  if(s.launcher_update?.available){
    renderAccount(s.account,s.installed_version,s.launcher_update);
    return;
  }
  // Se já existe sessão salva, entra direto no painel sem pedir login novamente.
  renderAccount(s.account,s.installed_version,s.launcher_update);
}catch(e){$('login-msg').textContent=e.message||'Erro ao carregar.'}}
$('login').onclick=async()=>{const b=$('login');b.disabled=true;$('login-msg').textContent='Entrando...';try{await fireBlaze.login($('email').value.trim(),$('password').value);$('password').value='';$('login-msg').textContent='';const s=await fireBlaze.state();renderAccount(s.account,s.installed_version)}catch(e){$('login-msg').textContent=e.message||'Não foi possível entrar.'}finally{b.disabled=false}};
$('logout').onclick=async()=>{await fireBlaze.logout();showLogin()};
$('launch').onclick=async()=>{const b=$('launch');b.disabled=true;msg('Validando licença e preparando o Multi...');try{await fireBlaze.launch();msg('FIRE BLAZE Mult aberto.')}catch(e){msg(e.message||'Não foi possível abrir.')}finally{setTimeout(()=>{if(current?.active)b.disabled=false},900)}};
document.querySelectorAll('[data-renew]').forEach(b=>b.onclick=async()=>{msg('Abrindo checkout seguro...');try{await fireBlaze.renew(b.dataset.renew);msg('Após pagar, volte aqui. O status será atualizado automaticamente.')}catch(e){msg(e.message||'Erro ao abrir pagamento.')}});
fireBlaze.onInstallProgress(p=>{ if(p.stage==='download')msg('Baixando FIRE BLAZE Mult... '+(p.progress||0)+'%'); else if(p.stage==='install')msg('Instalando FIRE BLAZE Mult...'); else if(p.stage==='done')msg('Instalação concluída. Abrindo...'); });
setInterval(async()=>{try{const a=await fireBlaze.refresh();const s=await fireBlaze.state();renderAccount({logged:true,...a},s.installed_version,s.launcher_update)}catch{}},30000);
load();
fireBlaze.onLauncherUpdateProgress?.(p=>{
  let t='';
  if(p?.stage==='install')t='Instalando atualização...';
  else if(p?.stage==='error')t='Erro ao atualizar: '+(p?.error||'falha desconhecida');
  else t='Baixando atualização... '+(p?.progress||0)+'%';
  msg(t);
  const out=$('mandatory-update-msg'); if(out)out.textContent=t;
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
