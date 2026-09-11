const cfg=FIRE_BLAZE_CONFIG;
const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);
const loginScreen=document.getElementById('login-screen');
const shell=document.getElementById('admin-shell');
const content=document.getElementById('admin-content');
const title=document.getElementById('page-title');
const toastEl=document.getElementById('toast');
let currentTab='dash';

function toast(msg){toastEl.textContent=msg;toastEl.classList.add('on');setTimeout(()=>toastEl.classList.remove('on'),2500)}
function h(v){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
async function token(){const {data}=await sb.auth.getSession();return data.session?.access_token||''}
async function api(name,opt={}){
  const t=await token(),sep=cfg.apiUrl.includes('?')?'&':'?';
  const r=await fetch(cfg.apiUrl+sep+'api='+encodeURIComponent(name),{...opt,headers:{'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{}),...(opt.headers||{})}});
  return r.json();
}
function showShell(email){
  loginScreen.hidden=true;
  loginScreen.style.display='none';
  shell.hidden=false;
  shell.style.display='grid';
  document.getElementById('admin-user-email').textContent=email||'admin';
}
function showLogin(msg=''){
  shell.hidden=true;
  shell.style.display='none';
  loginScreen.hidden=false;
  loginScreen.style.display='grid';
  document.getElementById('admin-msg').textContent=msg;
}
async function verifyAdmin(){
  try{
    const d=await api('admin_dashboard');
    return d&&d.ok?d:null;
  }catch(e){
    return null;
  }
}
document.getElementById('admin-login').onclick=async()=>{
  const msg=document.getElementById('admin-msg');
  const email=document.getElementById('admin-email').value.trim();
  const password=document.getElementById('admin-password').value;
  if(!email||!password){msg.textContent='Digite seu email e sua senha.';return}
  msg.textContent='Verificando acesso...';
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error){msg.textContent='Email ou senha inválidos.';return}
  const adm=await verifyAdmin();
  if(!adm){await sb.auth.signOut();msg.textContent='Esta conta não possui permissão de administrador.';return}
  msg.textContent='';
  showShell(data.user.email);
  try{
    await load('dash');
  }catch(e){
    content.innerHTML='<div class="empty">Erro ao carregar o Dashboard. Clique em Atualizar dados.</div>';
  }
};
document.getElementById('logout').onclick=async()=>{await sb.auth.signOut();showLogin('Sessão encerrada.')};
document.getElementById('refresh').onclick=()=>load(currentTab);
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('[data-tab]').forEach(x=>x.classList.remove('active'));b.classList.add('active');load(b.dataset.tab)
});

function setTitle(tab){const map={dash:'Dashboard',clientes:'Clientes',assinaturas:'Assinaturas',planos:'Planos',promos:'Promoções',pagamentos:'Pagamentos',versoes:'Atualizações',dominio:'Domínio e configurações'};title.textContent=map[tab]||'FIRE BLAZE Admin'}
function stat(label,value,foot){return '<div class="stat-card"><div class="stat-label">'+label+'</div><div class="stat-value">'+value+'</div><div class="stat-foot">'+foot+'</div></div>'}

async function load(tab){
  currentTab=tab;setTitle(tab);content.innerHTML='<div class="empty">Carregando dados...</div>';
  const gate=await verifyAdmin();if(!gate){await sb.auth.signOut();showLogin('Sua sessão expirou ou perdeu a permissão de administrador.');return}
  if(tab==='dash'){
    const m=gate.metrics;
    content.innerHTML='<div class="stats-grid">'+
      stat('Clientes',m.users,'Total de cadastros')+
      stat('Assinaturas ativas',m.active_subscriptions,'Licenças em uso')+
      stat('Planos',m.plans,'Planos cadastrados')+
      stat('Promoções ativas',m.active_promotions,'Campanhas em andamento')+
      '</div><div class="panel-grid"><section class="panel-card"><h3>Resumo comercial</h3><div class="activity"><div>💰 Receita mensal aparecerá aqui assim que conectarmos o gateway de pagamento.</div><div>🧾 Pagamentos aprovados e vencimentos serão atualizados automaticamente.</div><div>📈 Conversão do site será adicionada quando instalarmos a medição de vendas.</div></div></section><section class="panel-card"><h3>Próximas integrações</h3><div class="activity"><div>1. Checkout e webhook</div><div>2. Liberação automática de licença</div><div>3. Launcher e atualizações online</div></div></section></div>';
  }
  if(tab==='clientes'){
    const d=await api('admin_users');
    const rows=(d.users||[]).map(x=>'<tr><td><b>'+h(x.name||'Sem nome')+'</b></td><td>'+h(x.email)+'</td><td>'+h(x.whatsapp||'—')+'</td><td>'+(x.whatsapp_opt_in?'<span class="badge ok">Aceitou</span>':'<span class="badge off">Não</span>')+'</td><td><span class="badge '+(x.role==='admin'?'admin':'ok')+'">'+h(x.role)+'</span></td></tr>').join('');
    content.innerHTML='<div class="toolbar"><div><h2>Clientes</h2><div class="muted">Cadastros, WhatsApp e permissões.</div></div></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Nome</th><th>Email</th><th>WhatsApp</th><th>WhatsApp opt-in</th><th>Perfil</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5"><div class="empty">Nenhum cliente cadastrado.</div></td></tr>')+'</tbody></table></div>';
  }
  if(tab==='assinaturas'){
    content.innerHTML='<div class="toolbar"><div><h2>Assinaturas</h2><div class="muted">Ativas, vencidas, bloqueadas e renovações.</div></div></div><div class="panel-card"><div class="empty">A tela está preparada. Os dados aparecerão quando começarmos a ativar assinaturas pelo pagamento.</div></div>';
  }
  if(tab==='planos'){
    const d=await api('admin_plans');
    const items=(d.plans||[]).map(x=>'<div class="plan-row"><div><strong>'+h(x.name)+'</strong><div class="muted">'+h(x.description||'Plano FIRE BLAZE')+' • '+x.duration_days+' dias • '+x.max_devices+' PC</div></div><div><strong>'+(x.price_cents/100).toLocaleString('pt-BR',{style:'currency',currency:x.currency||'BRL'})+'</strong> <button class="btn btn-ghost" onclick="editPlan(\''+x.id+'\','+x.price_cents+')">Alterar</button></div></div>').join('');
    content.innerHTML='<div class="toolbar"><div><h2>Planos</h2><div class="muted">Você poderá alterar preços sem mexer no código.</div></div></div>'+(items||'<div class="empty">Nenhum plano.</div>')+'<section class="panel-card" style="margin-top:16px"><h3>Criar novo plano</h3><div class="admin-form"><label>Nome<input id="pn" placeholder="Ex.: FIRE BLAZE Trimestral"></label><label>Preço<input id="pp" placeholder="Ex.: 79,90"></label><div class="fullrow"><button class="btn btn-fire" onclick="newPlan()">Criar plano</button></div></div></section>';
  }
  if(tab==='promos'){
    const d=await api('admin_promos');
    const items=(d.promotions||[]).map(x=>'<div class="promo-row"><div><strong>'+h(x.name)+'</strong><div class="muted">Cupom: '+h(x.code||'Sem cupom')+'</div></div><span class="badge ok">'+x.discount_value+'% OFF</span></div>').join('');
    content.innerHTML='<div class="toolbar"><div><h2>Promoções</h2><div class="muted">Cupons e campanhas promocionais.</div></div></div>'+(items||'<div class="empty">Nenhuma promoção ativa.</div>')+'<section class="panel-card" style="margin-top:16px"><h3>Nova promoção</h3><div class="admin-form"><label>Nome<input id="prn" placeholder="Ex.: Lançamento"></label><label>Cupom<input id="prc" placeholder="Ex.: BLAZE20"></label><label>Desconto (%)<input id="prd" type="number" min="1" max="100" placeholder="20"></label><div class="fullrow"><button class="btn btn-fire" onclick="newPromo()">Criar promoção</button></div></div></section>';
  }
  if(tab==='pagamentos'){
    content.innerHTML='<div class="toolbar"><div><h2>Pagamentos</h2><div class="muted">Histórico do gateway e confirmações.</div></div></div><div class="panel-card"><div class="empty">Será preenchido automaticamente após integrarmos InfinitePay/Ton.</div></div>';
  }
  if(tab==='versoes'){
    content.innerHTML='<div class="toolbar"><div><h2>Atualizações do FIRE BLAZE</h2><div class="muted">Versão, changelog, download e atualização obrigatória.</div></div></div><div class="panel-card"><div class="empty">Essa área será ligada ao launcher quando iniciarmos a etapa de atualização online.</div></div>';
  }
  if(tab==='dominio'){
    const d=await api('admin_settings'),x=d.settings||{};
    content.innerHTML='<div class="toolbar"><div><h2>Domínio e configurações</h2><div class="muted">Troque as URLs no futuro sem alterar o aplicativo.</div></div></div><section class="panel-card"><div class="admin-form"><label>Site público<input id="su" value="'+h(x.public_site_url||'')+'" placeholder="https://fireblazemult.com.br"></label><label>API<input id="au" value="'+h(x.api_base_url||'')+'" placeholder="https://api.fireblazemult.com.br"></label><label>Área do cliente<input id="cu" value="'+h(x.customer_area_url||'')+'" placeholder="https://app.fireblazemult.com.br"></label><label>WhatsApp do suporte<input id="swp" value="'+h(x.support_whatsapp||'')+'" placeholder="55..."></label><div class="fullrow"><button class="btn btn-fire" onclick="saveSettings()">Salvar configurações</button></div></div></section>';
  }
}
window.editPlan=async(id,old)=>{const v=prompt('Novo preço em reais:',(old/100).toFixed(2).replace('.',','));if(!v)return;const cents=Math.round(Number(v.replace(',','.'))*100);if(!Number.isFinite(cents)){toast('Preço inválido.');return}const d=await api('admin_plan_update',{method:'POST',body:JSON.stringify({id,price_cents:cents})});if(d.ok){toast('Preço atualizado.');load('planos')}else toast(d.error||'Erro ao atualizar')}
window.newPlan=async()=>{const name=document.getElementById('pn').value.trim(),raw=document.getElementById('pp').value.replace(',','.');const cents=Math.round(Number(raw)*100);if(!name||!Number.isFinite(cents)){toast('Preencha nome e preço.');return}const d=await api('admin_plan_create',{method:'POST',body:JSON.stringify({name,price_cents:cents})});if(d.ok){toast('Plano criado.');load('planos')}else toast(d.error||'Erro ao criar plano')}
window.newPromo=async()=>{const name=document.getElementById('prn').value.trim(),code=document.getElementById('prc').value.trim(),discount_value=Number(document.getElementById('prd').value||0);if(!name||discount_value<=0){toast('Preencha a promoção.');return}const d=await api('admin_promo_create',{method:'POST',body:JSON.stringify({name,code,discount_value})});if(d.ok){toast('Promoção criada.');load('promos')}else toast(d.error||'Erro ao criar promoção')}
window.saveSettings=async()=>{const d=await api('admin_settings_save',{method:'POST',body:JSON.stringify({public_site_url:document.getElementById('su').value,api_base_url:document.getElementById('au').value,customer_area_url:document.getElementById('cu').value,support_whatsapp:document.getElementById('swp').value})});if(d.ok)toast('Configurações salvas.');else toast(d.error||'Erro ao salvar')}

(async()=>{
  const {data:{session}}=await sb.auth.getSession();
  if(!session)return;
  const adm=await verifyAdmin();
  if(adm){showShell(session.user.email);load('dash')} else {await sb.auth.signOut()}
})();