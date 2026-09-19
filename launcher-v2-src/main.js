const {app,BrowserWindow,ipcMain,safeStorage}=require('electron');
const path=require('path'),fs=require('fs');
const SUPABASE_URL='https://fqwoshdohwcbdgbdvmqc.supabase.co';
const SUPABASE_KEY='sb_publishable_XMv1L9yIinwd1KuMMa-lUQ_Yj2HZ4qc';
let win=null,auth=null;
const authFile=()=>path.join(app.getPath('userData'),'auth.bin');
function saveAuth(v){auth=v||null;try{if(!auth){fs.rmSync(authFile(),{force:true});return}if(!safeStorage.isEncryptionAvailable())throw Error('Criptografia do Windows indisponível.');fs.mkdirSync(path.dirname(authFile()),{recursive:true});fs.writeFileSync(authFile(),safeStorage.encryptString(JSON.stringify(auth)))}catch(e){throw e}}
function loadAuth(){try{if(!fs.existsSync(authFile())||!safeStorage.isEncryptionAvailable())return null;auth=JSON.parse(safeStorage.decryptString(fs.readFileSync(authFile())));return auth}catch{return null}}
async function sbToken(grant,body){const r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type='+grant,{method:'POST',headers:{apikey:SUPABASE_KEY,'content-type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok||!d.access_token)throw Error(d?.error_description||d?.msg||'Falha na autenticação.');d.saved_at=Date.now();saveAuth(d);return d}
async function refresh(){if(!auth?.refresh_token)return null;try{return await sbToken('refresh_token',{refresh_token:auth.refresh_token})}catch{saveAuth(null);return null}}
async function session(){if(!auth)loadAuth();if(!auth)return {logged:false};const expires=(auth.saved_at||0)+Number(auth.expires_in||3600)*1000-60000;if(Date.now()>expires && !await refresh())return {logged:false};return {logged:true,email:auth?.user?.email||''}}
ipcMain.handle('v2:startup',async()=>session());
ipcMain.handle('v2:login',async(_e,email,password)=>{await sbToken('password',{email:String(email||'').trim(),password:String(password||'')});return session()});
ipcMain.handle('v2:logout',async()=>{saveAuth(null);return {ok:true}});
function create(){win=new BrowserWindow({width:1000,height:680,minWidth:850,minHeight:580,backgroundColor:'#07090d',title:'FIRE BLAZE Launcher V2',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});win.loadFile('index.html')}
if(!app.requestSingleInstanceLock())app.quit();else{app.on('second-instance',()=>{if(win){win.show();win.focus()}});app.whenReady().then(()=>{loadAuth();create()});app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()})}
