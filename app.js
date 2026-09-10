
const cfg = window.FIRE_BLAZE_CONFIG;
const supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);

const modal = document.getElementById('auth-modal');
const regView = document.getElementById('register-view');
const loginView = document.getElementById('login-view');

function show(mode){
  modal.classList.add('open');
  const login = mode === 'login';
  regView.hidden = login;
  loginView.hidden = !login;
}
function close(){ modal.classList.remove('open'); }

document.querySelectorAll('[data-open-register]').forEach(b=>b.addEventListener('click',()=>show('register')));
document.querySelectorAll('[data-open-login]').forEach(b=>b.addEventListener('click',()=>show('login')));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',close));
document.getElementById('to-login').addEventListener('click',e=>{e.preventDefault();show('login')});
document.getElementById('to-register').addEventListener('click',e=>{e.preventDefault();show('register')});
modal.addEventListener('click',e=>{if(e.target===modal)close()});

async function api(name, options={}){
  const { data:{ session } } = await supabase.auth.getSession();
  const headers = {'Content-Type':'application/json', ...(options.headers||{})};
  if(session?.access_token) headers.Authorization = 'Bearer ' + session.access_token;
  const sep = cfg.apiUrl.includes('?') ? '&' : '?';
  const r = await fetch(cfg.apiUrl + sep + 'api=' + encodeURIComponent(name), {...options, headers});
  return r.json();
}

async function loadPlan(){
  try{
    const d = await api('plans');
    const p = d.plans?.[0];
    if(!p) return;
    document.getElementById('plan-name').textContent = p.name;
    document.getElementById('plan-price').textContent =
      new Intl.NumberFormat('pt-BR',{style:'currency',currency:p.currency||'BRL'}).format((p.price_cents||0)/100);
  }catch{}
}
loadPlan();

document.getElementById('register-btn').addEventListener('click', async ()=>{
  const msg = document.getElementById('reg-msg');
  msg.textContent = 'Criando sua conta...';
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const name = document.getElementById('reg-name').value.trim();
  const whatsapp = document.getElementById('reg-whatsapp').value.trim();
  const opt = document.getElementById('reg-optin').checked;
  if(!name || !whatsapp || !email || password.length < 8){
    msg.textContent = 'Preencha nome, WhatsApp, email e uma senha com pelo menos 8 caracteres.';
    return;
  }
  const {data,error} = await supabase.auth.signUp({
    email,password,
    options:{data:{name,whatsapp,whatsapp_opt_in:opt}}
  });
  if(error){ msg.textContent = error.message; return; }
  if(data.session) await api('bootstrap',{method:'POST'});
  msg.textContent = data.session
    ? 'Conta criada. Próxima etapa: escolher o plano e pagar.'
    : 'Conta criada. Confira seu email para confirmar o cadastro.';
});

document.getElementById('login-btn').addEventListener('click', async ()=>{
  const msg = document.getElementById('login-msg');
  msg.textContent = 'Entrando...';
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const {error} = await supabase.auth.signInWithPassword({email,password});
  if(error){ msg.textContent = 'Email ou senha inválidos.'; return; }
  await api('bootstrap',{method:'POST'});
  msg.textContent = 'Login realizado.';
  setTimeout(()=>location.href='cliente.html',500);
});
