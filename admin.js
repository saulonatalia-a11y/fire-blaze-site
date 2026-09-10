
const cfg=FIRE_BLAZE_CONFIG;
const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);
const panel=document.getElementById('panel');

async function token(){const {data}=await sb.auth.getSession();return data.session?.access_token||''}
async function api(name,opt={}){
  const t=await token(), sep=cfg.apiUrl.includes('?')?'&':'?';
  const r=await fetch(cfg.apiUrl+sep+'api='+name,{...opt,headers:{'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{}),...(opt.headers||{})}});
  return r.json();
}
function h(v){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

document.getElementById('login').onclick=async()=>{
  const msg=document.getElementById('msg');
  msg.textContent='Entrando...';
  const {error}=await sb.auth.signInWithPassword({email:document.getElementById('email').value.trim(),password:document.getElementById('password').value});
  if(error){msg.textContent='Email ou senha inválidos.';return}
  const d=await api('admin_dashboard');
  if(!d.ok){msg.textContent=d.error||'Sua conta não é administradora.';return}
  document.getElementById('login-box').hidden=true;
  document.getElementById('admin-app').hidden=false;
  load('dash');
};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>load(b.dataset.tab));

async function load(tab){
  panel.innerHTML='<p>Carregando...</p>';
  if(tab==='dash'){
    const d=await api('admin_dashboard'); if(!d.ok){panel.innerHTML='<p>'+h(d.error)+'</p>';return}
    panel.innerHTML=`<h2>Dashboard</h2><div class="stats"><div class="stat"><b>${d.metrics.users}</b><br>Clientes</div><div class="stat"><b>${d.metrics.active_subscriptions}</b><br>Assinaturas ativas</div><div class="stat"><b>${d.metrics.plans}</b><br>Planos</div><div class="stat"><b>${d.metrics.active_promotions}</b><br>Promoções</div></div>`;
  }
  if(tab==='clientes'){
    const d=await api('admin_users');
    panel.innerHTML='<h2>Clientes</h2><table><tr><th>Nome</th><th>Email</th><th>WhatsApp</th><th>Perfil</th></tr>'+((d.users||[]).map(x=>`<tr><td>${h(x.name)}</td><td>${h(x.email)}</td><td>${h(x.whatsapp)}</td><td>${h(x.role)}</td></tr>`).join('')||'<tr><td colspan="4">Nenhum cliente ainda.</td></tr>')+'</table>';
  }
  if(tab==='planos'){
    const d=await api('admin_plans');
    panel.innerHTML='<h2>Planos</h2>'+((d.plans||[]).map(x=>`<div class="stat" style="margin:8px 0"><b>${h(x.name)}</b> — ${(x.price_cents/100).toLocaleString('pt-BR',{style:'currency',currency:x.currency})} <button class="btn btn-ghost" onclick="editPlan('${x.id}',${x.price_cents})">Alterar preço</button></div>`).join(''))+'<h3>Novo plano</h3><div class="hero-actions"><input id="pn" placeholder="Nome"><input id="pp" placeholder="Preço ex: 39,90"><button class="btn btn-fire" onclick="newPlan()">Criar</button></div>';
  }
  if(tab==='promos'){
    const d=await api('admin_promos');
    panel.innerHTML='<h2>Promoções</h2>'+((d.promotions||[]).map(x=>`<div class="stat" style="margin:8px 0"><b>${h(x.name)}</b> • ${h(x.code||'sem cupom')} • ${x.discount_value}%</div>`).join('')||'<p>Nenhuma promoção ainda.</p>')+'<h3>Nova promoção</h3><div class="hero-actions"><input id="prn" placeholder="Nome"><input id="prc" placeholder="Cupom"><input id="prd" placeholder="Desconto %"><button class="btn btn-fire" onclick="newPromo()">Criar</button></div>';
  }
  if(tab==='dominio'){
    const d=await api('admin_settings'),x=d.settings||{};
    panel.innerHTML=`<h2>Domínio e URLs</h2><label>Site público<input id="su" value="${h(x.public_site_url||'')}" placeholder="https://fireblazemult.com.br"></label><label>API<input id="au" value="${h(x.api_base_url||'')}"></label><label>Área do cliente<input id="cu" value="${h(x.customer_area_url||'')}"></label><label>WhatsApp suporte<input id="swp" value="${h(x.support_whatsapp||'')}"></label><button class="btn btn-fire" onclick="saveSettings()">Salvar</button>`;
  }
}
window.editPlan=async(id,old)=>{const v=prompt('Novo preço em reais:',(old/100).toFixed(2).replace('.',','));if(!v)return;await api('admin_plan_update',{method:'POST',body:JSON.stringify({id,price_cents:Math.round(Number(v.replace(',','.'))*100)})});load('planos')}
window.newPlan=async()=>{await api('admin_plan_create',{method:'POST',body:JSON.stringify({name:document.getElementById('pn').value.trim(),price_cents:Math.round(Number(document.getElementById('pp').value.replace(',','.'))*100)})});load('planos')}
window.newPromo=async()=>{await api('admin_promo_create',{method:'POST',body:JSON.stringify({name:document.getElementById('prn').value.trim(),code:document.getElementById('prc').value.trim(),discount_value:Number(document.getElementById('prd').value||0)})});load('promos')}
window.saveSettings=async()=>{await api('admin_settings_save',{method:'POST',body:JSON.stringify({public_site_url:document.getElementById('su').value,api_base_url:document.getElementById('au').value,customer_area_url:document.getElementById('cu').value,support_whatsapp:document.getElementById('swp').value})});alert('Salvo.')}
