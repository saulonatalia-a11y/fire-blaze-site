const cfg=window.FIRE_BLAZE_CONFIG;
const sbClient=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);

const modal=document.getElementById('auth-modal');
const regView=document.getElementById('register-view');
const loginView=document.getElementById('login-view');

function showAuth(mode){
  modal.classList.add('open');
  const isLogin=mode==='login';
  regView.hidden=isLogin;
  loginView.hidden=!isLogin;
}
function closeAuth(){modal.classList.remove('open');}
function showEmailConfirmation(email){
  regView.hidden=false;
  loginView.hidden=true;
  regView.innerHTML=`
    <span class="kicker">CADASTRO CRIADO</span>
    <h2>Confirme seu email</h2>
    <p style="color:#aeb7c3;line-height:1.6;margin:0 0 18px">
      Enviamos um link de confirmação para:
    </p>
    <div style="background:#0b0f15;border:1px solid #2b3542;border-radius:11px;padding:13px 14px;margin-bottom:18px;color:#fff;font-weight:800;word-break:break-all">${email}</div>
    <p style="color:#aeb7c3;line-height:1.6">
      Entre no seu email e clique no link para confirmar o cadastro.
    </p>
    <div id="confirm-msg" class="form-msg"></div>
    <button class="btn btn-fire full" id="resend-confirm">REENVIAR EMAIL</button>
    <button class="btn btn-ghost full" style="margin-top:10px" id="confirm-close">FECHAR</button>
  `;
  document.getElementById('confirm-close').onclick=closeAuth;
  document.getElementById('resend-confirm').onclick=async()=>{
    const msg=document.getElementById('confirm-msg');
    msg.textContent='Reenviando...';
    const {error}=await sbClient.auth.resend({
      type:'signup',
      email,
      options:{emailRedirectTo:location.origin+'/cliente.html'}
    });
    msg.textContent=error?error.message:'Email reenviado. Verifique também Spam e Promoções.';
  };
}

document.querySelectorAll('[data-open-register]').forEach(b=>b.addEventListener('click',()=>showAuth('register')));
document.querySelectorAll('[data-open-login]').forEach(b=>b.addEventListener('click',()=>showAuth('login')));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeAuth));
document.getElementById('to-login').addEventListener('click',e=>{e.preventDefault();showAuth('login')});
document.getElementById('to-register').addEventListener('click',e=>{e.preventDefault();showAuth('register')});
modal.addEventListener('click',e=>{if(e.target===modal)closeAuth()});

async function api(name,options={}){
  const {data:{session}}=await sbClient.auth.getSession();
  const headers={'Content-Type':'application/json',...(options.headers||{})};
  if(session?.access_token) headers.Authorization='Bearer '+session.access_token;
  const sep=cfg.apiUrl.includes('?')?'&':'?';
  const r=await fetch(cfg.apiUrl+sep+'api='+encodeURIComponent(name),{...options,headers});
  return r.json();
}

(async()=>{
  try{
    const d=await api('public_settings');
    const p=d.plan;
    const s=d.settings||{};
    const badge=document.getElementById('trial-badge'),copy=document.getElementById('trial-copy');
    if(s.trial_enabled){const unit=s.trial_duration_unit==='days'?'dia(s)':'hora(s)';if(badge)badge.textContent='TESTE GRÁTIS ATIVO';if(copy)copy.textContent='Cadastre-se agora e receba '+s.trial_duration_value+' '+unit+' grátis.';}else{if(copy)copy.textContent='Teste grátis indisponível no momento.';}
    if(p){
      document.getElementById('plan-name').textContent=p.name;
      document.getElementById('plan-price').textContent=new Intl.NumberFormat('pt-BR',{style:'currency',currency:p.currency||'BRL'}).format((p.price_cents||0)/100);
    }
  }catch(e){}
})();

document.getElementById('register-btn').addEventListener('click',async()=>{
  const msg=document.getElementById('reg-msg');
  const email=document.getElementById('reg-email').value.trim();
  const password=document.getElementById('reg-password').value;
  const name=document.getElementById('reg-name').value.trim();
  const whatsapp=document.getElementById('reg-whatsapp').value.trim();
  const opt=document.getElementById('reg-optin').checked;
  if(!name||!whatsapp||!email||password.length<8){
    msg.textContent='Preencha nome, WhatsApp, email e uma senha com pelo menos 8 caracteres.';
    return;
  }
  msg.textContent='Criando sua conta...';
  try{
    const r=await fetch(cfg.supabaseUrl+'/functions/v1/fire-blaze-signup',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name,whatsapp,email,password,whatsapp_opt_in:opt})
    });
    const out=await r.json();
    if(!r.ok || !out.ok){msg.textContent=out.error||'Não foi possível criar a conta.';return;}
    const {error}=await sbClient.auth.signInWithPassword({email,password});
    if(error){msg.textContent='Conta criada, mas não foi possível entrar automaticamente.';return;}
    closeAuth();
    location.href='cliente.html';
  }catch(e){
    msg.textContent='Erro de conexão ao criar a conta.';
  }
});


document.getElementById('forgot-password')?.addEventListener('click',async e=>{
  e.preventDefault();
  const msg=document.getElementById('login-msg');
  const email=document.getElementById('login-email').value.trim();
  if(!email){
    msg.textContent='Digite seu email acima para redefinir a senha.';
    return;
  }
  msg.textContent='Enviando link para redefinir sua senha...';
  const {error}=await sbClient.auth.resetPasswordForEmail(email,{
    redirectTo:location.origin+'/reset.html'
  });
  msg.textContent=error
    ? 'Não foi possível enviar o email: '+error.message
    : 'Pronto. Enviamos o link de redefinição para seu email. Verifique também Spam e Promoções.';
});

document.getElementById('login-btn').addEventListener('click',async()=>{
  const msg=document.getElementById('login-msg');
  msg.textContent='Entrando...';
  const email=document.getElementById('login-email').value.trim();
  const password=document.getElementById('login-password').value;
  const {error}=await sbClient.auth.signInWithPassword({email,password});
  if(error){msg.textContent='Email ou senha inválidos ou email ainda não confirmado.';return;}
  await api('bootstrap',{method:'POST'});
  location.href='cliente.html';
});