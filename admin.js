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

function setTitle(tab){const map={dash:'Dashboard',clientes:'Clientes',assinaturas:'Assinaturas',comercial:'Assinatura e Teste',promos:'Promoções',pagamentos:'Pagamentos',versoes:'Atualizações',mensagens:'Mensagens para clientes',dominio:'Domínio e configurações'};title.textContent=map[tab]||'FIRE BLAZE Admin'}
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
    const now=Date.now();
    const rows=(d.users||[]).map(x=>{
      const s=x.subscription;
      const end=s?.current_period_end?new Date(s.current_period_end).getTime():0;
      const active=!x.is_blocked && s?.status==='active' && (!end||end>now);
      let status='<span class="badge off">AGUARDANDO PAGAMENTO</span>';
      if(x.is_blocked) status='<span class="badge off">DESATIVADA</span>';
      else if(active && s?.access_kind==='trial') status='<span class="badge admin">TESTE GRÁTIS</span>';
      else if(active) status='<span class="badge ok">ATIVA</span>';
      else if(s?.status==='expired'||(end&&end<=now)) status='<span class="badge off">EXPIRADA</span>';
      else if(s?.status==='pending'||s?.status==='past_due') status='<span class="badge off">AGUARDANDO PAGAMENTO</span>';
      const vence=s?.current_period_end?new Date(s.current_period_end).toLocaleString('pt-BR'):'—';
      const remainingDays=s?.current_period_end?Math.max(0,Math.round((new Date(s.current_period_end).getTime()-now)/86400000)):0;
      const controls=x.role==='admin'
        ? '<span class="muted">Conta administrativa</span>'
        : '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+
          '<input id="dur-'+x.id+'" type="number" min="0" value="'+remainingDays+'" style="width:72px;background:#0c1118;color:#fff;border:1px solid #2a3542;border-radius:8px;padding:8px">'+
          '<select id="unit-'+x.id+'" style="background:#0c1118;color:#fff;border:1px solid #2a3542;border-radius:8px;padding:8px">'+
          '<option value="hours">Horas</option><option value="days" selected>Dias</option><option value="months">Meses</option><option value="years">Anos</option></select>'+
          '<button class="btn btn-fire" onclick="saveAccess(\''+x.id+'\')">Salvar acesso</button>'+ '<button class="btn btn-ghost" onclick="trialUser(\''+x.id+'\')">+ Teste</button>'+ (s?.access_kind==='trial'?'<button class="btn btn-ghost" onclick="endTrial(\''+x.id+'\')">Encerrar teste</button>':'')+
          '<button class="btn btn-ghost" onclick="deactivateUser(\''+x.id+'\')">Desativar</button>'+
          '<button class="btn btn-ghost" onclick="resetDevice(\''+x.id+'\',\''+h(x.email)+'\')">Liberar novo PC</button>'+
          '<button class="btn btn-ghost" style="border-color:#6b2525;color:#ff8585" onclick="deleteUser(\''+x.id+'\',\''+h(x.email)+'\')">Excluir</button>'+
          '</div>';
      return '<tr><td><b>'+h(x.name||'Sem nome')+'</b><div class="muted">'+status+'</div></td>'+
        '<td>'+h(x.email)+'</td><td>'+h(x.whatsapp||'—')+'</td>'+
        '<td>'+h(vence)+'</td><td>'+controls+'</td></tr>';
    }).join('');
    content.innerHTML='<div class="toolbar"><div><h2>Clientes</h2><div class="muted">Contas aguardando pagamento, ativas, desativadas e controle manual de acesso.</div></div></div>'+
      '<div class="admin-table-wrap"><table class="admin-table" style="min-width:1050px"><thead><tr><th>Cliente / Status</th><th>Email</th><th>WhatsApp</th><th>Acesso até</th><th>Ações administrativas</th></tr></thead><tbody>'+
      (rows||'<tr><td colspan="5"><div class="empty">Nenhum cliente cadastrado.</div></td></tr>')+'</tbody></table></div>';
  }
  if(tab==='assinaturas'){
    const d=await api('admin_users');
    const now=Date.now();
    const rows=(d.users||[]).filter(x=>x.role!=='admin').map(x=>{
      const s=x.subscription,end=s?.current_period_end?new Date(s.current_period_end).getTime():0;
      let label='AGUARDANDO PAGAMENTO',cls='off';
      if(x.is_blocked||s?.status==='blocked'){label='DESATIVADA';cls='off'}
      else if(s?.status==='active'&&(!end||end>now)&&s?.access_kind==='trial'){label='TESTE GRÁTIS';cls='admin'}
      else if(s?.status==='active'&&(!end||end>now)){label='ATIVA';cls='ok'}
      else if(s?.status==='expired'||(end&&end<=now)){label='EXPIRADA';cls='off'}
      return '<tr><td><b>'+h(x.name||'Sem nome')+'</b></td><td>'+h(x.email)+'</td><td><span class="badge '+cls+'">'+label+'</span></td><td>'+(s?.current_period_end?new Date(s.current_period_end).toLocaleString('pt-BR'):'—')+'</td></tr>';
    }).join('');
    content.innerHTML='<div class="toolbar"><div><h2>Assinaturas</h2><div class="muted">Visão rápida de quem está aguardando pagamento, ativo, expirado ou desativado.</div></div></div>'+
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Cliente</th><th>Email</th><th>Status</th><th>Acesso até</th></tr></thead><tbody>'+
      (rows||'<tr><td colspan="4"><div class="empty">Nenhum cliente cadastrado.</div></td></tr>')+'</tbody></table></div>';
  }
  if(tab==='comercial'){
    const [sd,pd]=await Promise.all([api('admin_settings'),api('admin_plans')]), x=sd.settings||{}, p=(pd.plans||[]).find(z=>z.is_active&&z.is_featured)||(pd.plans||[]).find(z=>z.is_active)||{};
    content.innerHTML='<div class="toolbar"><div><h2>Assinatura mensal e Teste Grátis</h2><div class="muted">Um único valor mensal para novos pagamentos e próximas renovações. Configure também o teste concedido aos novos cadastros.</div></div></div>'+
    '<div class="panel-grid"><section class="panel-card"><h3>💳 Valor mensal</h3><div class="admin-form"><label class="fullrow">Valor atual (R$)<input id="monthly-price" value="'+((Number(p.price_cents||0)/100).toFixed(2).replace('.',','))+'"></label><div class="fullrow muted">Ao alterar, o site e novos checkouts usam o novo valor. Assinaturas recorrentes do Asaas são atualizadas para as próximas cobranças; o período já pago não muda.</div><div class="fullrow"><button class="btn btn-fire" onclick="saveMonthlyPrice()">Salvar valor mensal</button></div></div></section>'+
    '<section class="panel-card"><h3>🎁 Teste grátis</h3><div class="admin-form"><label class="fullrow">Status<select id="trial-enabled"><option value="true" '+(x.trial_enabled?'selected':'')+'>ATIVADO</option><option value="false" '+(!x.trial_enabled?'selected':'')+'>DESATIVADO</option></select></label><label>Duração<input id="trial-value" type="number" min="1" value="'+h(x.trial_duration_value||24)+'"></label><label>Unidade<select id="trial-unit"><option value="hours" '+(x.trial_duration_unit==='hours'?'selected':'')+'>Horas</option><option value="days" '+(x.trial_duration_unit==='days'?'selected':'')+'>Dias</option></select></label><div class="fullrow muted">A configuração vale somente para novos cadastros. Quem já recebeu um teste mantém o vencimento individual que recebeu.</div><div class="fullrow"><button class="btn btn-fire" onclick="saveTrialSettings()">Salvar teste grátis</button></div></div></section></div>';
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
    const d=await api('admin_versions');
    const rows=(d.versions||[]).map(x=>{
      const pub=x.is_published?'<span class="badge ok">PUBLICADA</span>':'<span class="badge off">RASCUNHO</span>';
      const req=x.is_mandatory?'<span class="badge admin">OBRIGATÓRIA</span>':'<span class="muted">Opcional</span>';
      const when=x.published_at?new Date(x.published_at).toLocaleString('pt-BR'):'—';
      return '<tr><td><b>'+h(x.version||'—')+'</b><div class="muted">'+h(x.title||'Sem título')+'</div></td><td>'+pub+'</td><td>'+req+'</td><td>'+when+'</td><td><div style="display:flex;gap:6px;flex-wrap:wrap">'+
        (x.download_url?'<a class="btn btn-ghost" href="'+h(x.download_url)+'" target="_blank" rel="noopener">Baixar</a>':'')+
        '<button class="btn btn-ghost" onclick="toggleVersion(\''+x.id+'\','+(!x.is_published)+')">'+(x.is_published?'Despublicar':'Publicar')+'</button>'+
        '<button class="btn btn-ghost" style="border-color:#6b2525;color:#ff8585" onclick="deleteVersion(\''+x.id+'\',\''+h(x.version||'')+'\')">Excluir</button></div></td></tr>';
    }).join('');
    content.innerHTML='<div class="toolbar"><div><h2>Atualizações do FIRE BLAZE</h2><div class="muted">Publique a versão que o launcher deverá oferecer aos clientes.</div></div></div>'+
      '<section class="panel-card" style="margin-bottom:16px"><h3>1. Subir o ZIP no GitHub</h3><div class="activity">'+
      '<div>📦 Clique no botão abaixo, crie uma nova Release e anexe o ZIP da atualização em <b>Attach binaries</b>.</div>'+
      '<div>⚠️ Use uma tag no formato <b>mult-v1.6.1</b>. Depois volte para esta tela e publique usando exatamente o mesmo nome do arquivo ZIP.</div></div>'+
      '<div style="margin-top:14px"><a class="btn btn-fire" target="_blank" rel="noopener" href="https://github.com/saulonatalia-a11y/fire-blaze-site/releases/new">Abrir GitHub Releases para subir o ZIP</a></div></section>'+
      '<section class="panel-card"><h3>2. Publicar nova atualização</h3><div class="admin-form">'+
      '<label>Versão<input id="ver-version" placeholder="Ex.: 1.6.1"></label>'+
      '<label>Título<input id="ver-title" placeholder="Ex.: Correções e melhorias"></label>'+
      '<label class="fullrow">Nome exato do ZIP no GitHub<input id="ver-file" placeholder="Ex.: FIRE-BLAZE-Mult-v1.6.1.zip"></label>'+
      '<label class="fullrow">SHA-256 (opcional)<input id="ver-sha" placeholder="Hash do arquivo para validar o download"></label>'+
      '<label class="fullrow">Changelog<textarea id="ver-log" rows="7" placeholder="Liste o que mudou nesta versão..." style="width:100%;resize:vertical;background:#0c1118;color:#fff;border:1px solid #2a3542;border-radius:10px;padding:12px;font:inherit"></textarea></label>'+
      '<label class="fullrow" style="display:flex;grid-template-columns:auto 1fr;align-items:center;gap:10px"><input id="ver-mandatory" type="checkbox" style="width:auto"> <span>Atualização obrigatória</span></label>'+
      '<div class="fullrow"><button class="btn btn-fire" onclick="publishVersion()">Publicar atualização</button></div></div></section>'+
      '<div class="toolbar" style="margin-top:20px"><div><h2 style="font-size:18px">Histórico de versões</h2><div class="muted">A versão publicada mais recente do canal stable será entregue ao launcher.</div></div></div>'+
      '<div class="admin-table-wrap"><table class="admin-table" style="min-width:900px"><thead><tr><th>Versão</th><th>Status</th><th>Tipo</th><th>Publicada em</th><th>Ações</th></tr></thead><tbody>'+
      (rows||'<tr><td colspan="5"><div class="empty">Nenhuma atualização cadastrada.</div></td></tr>')+'</tbody></table></div>';
  }
  if(tab==='mensagens'){
    const d=await api('admin_messages');
    const rows=(d.messages||[]).map(x=>{
      const status=x.is_active?'<span class="badge ok">ATIVA</span>':'<span class="badge off">ENCERRADA</span>';
      const when=x.published_at?new Date(x.published_at).toLocaleString('pt-BR'):'—';
      const until=x.expires_at?new Date(x.expires_at).toLocaleString('pt-BR'):'—';
      const secs=Number(x.duration_seconds||0);
      const duration=secs>=86400?(secs/86400)+' dia(s)':secs>=3600?(secs/3600)+' hora(s)':secs>=60?(secs/60)+' min':secs+' s';
      return '<tr><td><b>'+h(x.title||'Recado FIRE BLAZE')+'</b><div class="muted" style="max-width:650px;white-space:pre-wrap">'+h(x.message||'')+'</div></td><td>'+status+'</td><td>'+when+'<div class="muted">Duração: '+h(duration)+'<br>Expira: '+h(until)+'</div></td><td><div style="display:flex;gap:6px;flex-wrap:wrap">'+
        '<button class="btn btn-ghost" onclick="toggleMessage(\''+x.id+'\','+(!x.is_active)+')">'+(x.is_active?'Encerrar':'Reenviar')+'</button>'+
        '<button class="btn btn-ghost" style="border-color:#6b2525;color:#ff8585" onclick="deleteMessage(\''+x.id+'\')">Excluir</button></div></td></tr>';
    }).join('');
    content.innerHTML='<div class="toolbar"><div><h2>Mensagens para todos</h2><div class="muted">Envie um recado que aparecerá dentro do FIRE BLAZE Mult. O cliente pode fechar pelo X.</div></div></div>'+
      '<section class="panel-card" style="margin-bottom:18px"><h3>Enviar novo recado</h3><div class="admin-form">'+
      '<label class="fullrow">Título<input id="msg-title" placeholder="Ex.: Aviso importante"></label>'+
      '<label class="fullrow">Mensagem<textarea id="msg-body" rows="7" placeholder="Digite o recado que todos os clientes verão..." style="width:100%;resize:vertical;background:#0c1118;color:#fff;border:1px solid #2a3542;border-radius:10px;padding:12px;font:inherit"></textarea></label>'+
      '<label>Tempo que ficará aparecendo<input id="msg-duration" type="number" min="1" value="3"></label>'+
      '<label>Unidade<select id="msg-duration-unit"><option value="minutes" selected>Minutos</option><option value="hours">Horas</option><option value="days">Dias</option></select></label>'+
      '<div class="fullrow"><div class="muted">Exemplo: 3 minutos = se o cliente não fechar pelo X, a mensagem some sozinha após 3 minutos.</div></div>'+
      '<div class="fullrow"><button class="btn btn-fire" onclick="publishMessage()">Enviar mensagem para todos</button></div></div></section>'+
      '<div class="toolbar"><div><h2 style="font-size:18px">Histórico de mensagens</h2><div class="muted">Mensagens ativas continuam disponíveis no servidor, mas cada cliente pode dispensar pelo X.</div></div></div>'+
      '<div class="admin-table-wrap"><table class="admin-table" style="min-width:850px"><thead><tr><th>Mensagem</th><th>Status</th><th>Enviada em</th><th>Ações</th></tr></thead><tbody>'+
      (rows||'<tr><td colspan="4"><div class="empty">Nenhuma mensagem enviada.</div></td></tr>')+'</tbody></table></div>';
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

window.publishMessage=async()=>{
  const title=document.getElementById('msg-title')?.value.trim();
  const message=document.getElementById('msg-body')?.value.trim();
  const duration_value=Number(document.getElementById('msg-duration')?.value||0);
  const duration_unit=document.getElementById('msg-duration-unit')?.value||'minutes';
  if(!message){toast('Digite a mensagem.');return}
  if(!Number.isFinite(duration_value)||duration_value<=0){toast('Escolha por quanto tempo a mensagem ficará aparecendo.');return}
  const unitLabel={minutes:'minuto(s)',hours:'hora(s)',days:'dia(s)'}[duration_unit]||duration_unit;
  if(!confirm('Enviar este recado para todos?\n\nEle ficará disponível por '+duration_value+' '+unitLabel+' ou até o cliente fechar pelo X.'))return;
  const d=await api('admin_message_publish',{method:'POST',body:JSON.stringify({title,message,duration_value,duration_unit})});
  if(d.ok){toast('Mensagem enviada para todos.');load('mensagens')}else toast(d.error||'Erro ao enviar mensagem');
};
window.toggleMessage=async(id,is_active)=>{
  const d=await api('admin_message_toggle',{method:'POST',body:JSON.stringify({id,is_active})});
  if(d.ok){toast(is_active?'Mensagem reenviada.':'Mensagem encerrada.');load('mensagens')}else toast(d.error||'Erro ao alterar mensagem');
};
window.deleteMessage=async(id)=>{
  if(!confirm('Excluir esta mensagem do histórico?'))return;
  const d=await api('admin_message_delete',{method:'POST',body:JSON.stringify({id})});
  if(d.ok){toast('Mensagem excluída.');load('mensagens')}else toast(d.error||'Erro ao excluir mensagem');
};

window.publishVersion=async()=>{
  const version=document.getElementById('ver-version')?.value.trim();
  const title=document.getElementById('ver-title')?.value.trim();
  const fileName=document.getElementById('ver-file')?.value.trim();
  const sha256=document.getElementById('ver-sha')?.value.trim();
  const changelog=document.getElementById('ver-log')?.value.trim();
  const is_mandatory=!!document.getElementById('ver-mandatory')?.checked;
  if(!version||!fileName){toast('Preencha a versão e o nome exato do ZIP.');return}
  if(!fileName.toLowerCase().endsWith('.zip')){toast('O arquivo da atualização precisa ser .zip');return}
  const tag='mult-v'+version.replace(/^v/i,'');
  const download_url='https://github.com/saulonatalia-a11y/fire-blaze-site/releases/download/'+encodeURIComponent(tag)+'/'+encodeURIComponent(fileName);
  if(!confirm('Publicar a versão '+version+' usando o arquivo '+fileName+'?'))return;
  const d=await api('admin_version_publish',{method:'POST',body:JSON.stringify({version,title,download_url,sha256,changelog,is_mandatory})});
  if(d.ok){toast('Atualização '+version+' publicada.');load('versoes')}else toast(d.error||'Erro ao publicar atualização');
};
window.toggleVersion=async(id,is_published)=>{
  const d=await api('admin_version_toggle',{method:'POST',body:JSON.stringify({id,is_published})});
  if(d.ok){toast(is_published?'Versão publicada.':'Versão despublicada.');load('versoes')}else toast(d.error||'Erro ao alterar versão');
};
window.deleteVersion=async(id,version)=>{
  if(!confirm('Excluir a versão '+version+' do histórico?'))return;
  const d=await api('admin_version_delete',{method:'POST',body:JSON.stringify({id})});
  if(d.ok){toast('Versão excluída.');load('versoes')}else toast(d.error||'Erro ao excluir versão');
};

(async()=>{
  const {data:{session}}=await sb.auth.getSession();
  if(!session)return;
  const adm=await verifyAdmin();
  if(adm){showShell(session.user.email);load('dash')} else {await sb.auth.signOut()}
})();
window.saveAccess=async(id)=>{
  const value=Number(document.getElementById('dur-'+id)?.value);
  const unit=document.getElementById('unit-'+id)?.value||'days';
  if(!Number.isFinite(value)||value<0){toast('Informe um tempo válido (0 ou mais).');return}
  const d=await api('admin_user_activate',{method:'POST',body:JSON.stringify({user_id:id,duration_value:value,duration_unit:unit})});
  if(d.ok){
    toast(value===0?'Acesso salvo como expirado/bloqueado.':'Tempo de acesso salvo.');
    load('clientes');
  }else toast(d.error||'Erro ao salvar');
};
window.activateUser=window.saveAccess;
window.deactivateUser=async(id)=>{
  if(!confirm('Desativar esta conta? O acesso ao FIRE BLAZE será bloqueado, mas os dados serão preservados.'))return;
  const d=await api('admin_user_deactivate',{method:'POST',body:JSON.stringify({user_id:id})});
  if(d.ok){toast('Conta desativada.');load('clientes')}else toast(d.error||'Erro ao desativar');
};
window.deleteUser=async(id,email)=>{
  if(!confirm('EXCLUIR DEFINITIVAMENTE o cadastro '+email+'?\n\nIsso remove conta, assinatura, pagamentos vinculados, dispositivos e login. Esta ação não pode ser desfeita.'))return;
  const d=await api('admin_user_delete',{method:'POST',body:JSON.stringify({user_id:id})});
  if(d.ok){toast('Cadastro excluído.');load('clientes')}else toast(d.error||'Erro ao excluir');
};

window.resetDevice=async(id,email)=>{
  if(!confirm('Liberar a conta '+email+' para vincular em um novo PC?\n\nO PC antigo será revogado. Na próxima abertura do Launcher, o novo computador será vinculado automaticamente.'))return;
  const d=await api('admin_user_reset_device',{method:'POST',body:JSON.stringify({user_id:id})});
  if(d.ok){toast('Novo PC liberado para esta conta.');load('clientes')}else toast(d.error||'Erro ao liberar novo PC');
};

window.saveMonthlyPrice=async()=>{const raw=document.getElementById('monthly-price').value.replace(',','.');const price_cents=Math.round(Number(raw)*100);if(!Number.isFinite(price_cents)||price_cents<100){toast('Valor mensal inválido.');return}if(!confirm('Alterar o valor mensal para '+(price_cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+'? O novo valor valerá para novas compras e próximas renovações.'))return;const d=await api('admin_monthly_update',{method:'POST',body:JSON.stringify({price_cents})});if(d.ok){toast('Valor mensal atualizado.');load('comercial')}else toast(d.error||'Erro ao atualizar valor')};
window.saveTrialSettings=async()=>{const old=await api('admin_settings'),x=old.settings||{};const trial_enabled=document.getElementById('trial-enabled').value==='true',trial_duration_value=Number(document.getElementById('trial-value').value||0),trial_duration_unit=document.getElementById('trial-unit').value;if(trial_duration_value<1){toast('Informe a duração do teste.');return}const d=await api('admin_settings_save',{method:'POST',body:JSON.stringify({public_site_url:x.public_site_url||'',api_base_url:x.api_base_url||'',customer_area_url:x.customer_area_url||'',support_whatsapp:x.support_whatsapp||'',trial_enabled,trial_duration_value,trial_duration_unit})});if(d.ok){toast(trial_enabled?'Teste grátis ativado.':'Teste grátis desativado.');load('comercial')}else toast(d.error||'Erro ao salvar teste')};
window.trialUser=async(id)=>{const raw=prompt('Quanto tempo deseja ADICIONAR ao teste deste usuário? Ex.: 24');if(raw===null)return;const duration_value=Number(raw);if(!Number.isFinite(duration_value)||duration_value<=0){toast('Tempo inválido.');return}const unit=confirm('OK = DIAS\nCancelar = HORAS')?'days':'hours';const d=await api('admin_trial_user',{method:'POST',body:JSON.stringify({user_id:id,action:'grant',duration_value,duration_unit:unit})});if(d.ok){toast('Tempo de teste adicionado.');load('clientes')}else toast(d.error||'Erro ao alterar teste')};
window.endTrial=async(id)=>{if(!confirm('Encerrar o teste grátis deste usuário agora? O Mult será bloqueado quando o Launcher validar a licença.'))return;const d=await api('admin_trial_user',{method:'POST',body:JSON.stringify({user_id:id,action:'end'})});if(d.ok){toast('Teste encerrado.');load('clientes')}else toast(d.error||'Erro ao encerrar teste')};
