const { app, BrowserWindow, ipcMain, shell, safeStorage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');

const SUPABASE_URL='https://fqwoshdohwcbdgbdvmqc.supabase.co';
const SUPABASE_KEY='sb_publishable_XMv1L9yIinwd1KuMMa-lUQ_Yj2HZ4qc';
const LICENSE_URL=SUPABASE_URL+'/functions/v1/fire-blaze-license';
const CHECKOUT_URL=SUPABASE_URL+'/functions/v1/fire-blaze-checkout';
const CUSTOMER_URL='https://fire-blaze-site.onrender.com/cliente.html';
const LAUNCHER_RELEASE_API='https://api.github.com/repos/saulonatalia-a11y/fire-blaze-site/releases?per_page=20';
const LAUNCHER_VERSION=app.getVersion();
let win=null;
let auth=null;

function authFile(){ return path.join(app.getPath('userData'),'auth.bin'); }
function installedRoot(){ return path.join(process.env.LOCALAPPDATA || app.getPath('userData'),'FIRE BLAZE','.runtime','Mult'); }
function hideInternalTree(){
  if(process.platform!=='win32')return;
  try{
    const base=path.join(process.env.LOCALAPPDATA || app.getPath('userData'),'FIRE BLAZE');
    if(fs.existsSync(base))execFileSync('attrib.exe',['+h',base],{windowsHide:true,timeout:5000});
    const runtime=path.join(base,'.runtime');
    if(fs.existsSync(runtime))execFileSync('attrib.exe',['+h',runtime],{windowsHide:true,timeout:5000});
  }catch{}
}
function findMultiExe(dir){
  try{
    if(!fs.existsSync(dir))return '';
    const direct=path.join(dir,'FIRE BLAZE Mult.exe');
    if(fs.existsSync(direct))return direct;
    for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
      if(ent.isDirectory()){
        const found=findMultiExe(path.join(dir,ent.name));
        if(found)return found;
      }
    }
  }catch{}
  return '';
}
function installedExe(version){ return findMultiExe(path.join(installedRoot(),version)); }
function iconPath(){ return path.join(__dirname,'fire.ico'); }
let updateCache={available:false,current:LAUNCHER_VERSION};
async function launcherUpdate(){ return updateCache; }
async function runLauncherUpdate(){ throw new Error('Atualização automática do Launcher desativada nesta versão.'); }
function versionParts(v){ return String(v||'0').replace(/^v/i,'').split('.').map(x=>Number(x)||0); }
function compareVersions(a,b){ const A=versionParts(a),B=versionParts(b); for(let i=0;i<Math.max(A.length,B.length);i++){const d=(A[i]||0)-(B[i]||0);if(d)return d;} return 0; }

function deviceHash(){
  let machine='';
  if(process.platform==='win32'){
    try{ machine=String(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','(Get-CimInstance Win32_ComputerSystemProduct).UUID'],{encoding:'utf8',windowsHide:true,timeout:5000})||'').trim(); }catch{}
  }
  return crypto.createHash('sha256').update([machine,os.hostname(),process.platform,process.arch].join('|')).digest('hex');
}
function deviceName(){ return os.hostname() || 'PC'; }

function saveAuth(data){
  auth=data||null;
  try{
    if(!auth){ fs.rmSync(authFile(),{force:true}); return; }
    fs.mkdirSync(path.dirname(authFile()),{recursive:true});
    const text=JSON.stringify(auth);
    if(safeStorage.isEncryptionAvailable()) fs.writeFileSync(authFile(),safeStorage.encryptString(text));
  }catch{}
}
function loadAuth(){
  try{
    if(!fs.existsSync(authFile())||!safeStorage.isEncryptionAvailable())return null;
    auth=JSON.parse(safeStorage.decryptString(fs.readFileSync(authFile())));
    return auth;
  }catch{return null;}
}
async function sbFetch(url,options={}){
  const headers={'apikey':SUPABASE_KEY,'content-type':'application/json',...(options.headers||{})};
  const r=await fetch(url,{...options,headers});
  const data=await r.json().catch(()=>({}));
  return {r,data};
}
async function login(email,password){
  const {r,data}=await sbFetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});
  if(!r.ok||!data.access_token)throw new Error(data?.error_description||data?.msg||'Email ou senha inválidos.');
  data.saved_at=Date.now(); saveAuth(data); return data;
}
async function refreshAuth(){
  if(!auth?.refresh_token)return null;
  try{
    const {r,data}=await sbFetch(SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:auth.refresh_token})});
    if(!r.ok||!data.access_token)throw new Error('Sessão expirada');
    data.saved_at=Date.now(); saveAuth(data); return data;
  }catch{saveAuth(null);return null;}
}
async function accessToken(){
  if(!auth)loadAuth();
  if(!auth)return '';
  const expiresAt=(auth.saved_at||0)+(Number(auth.expires_in||3600)*1000)-60000;
  if(Date.now()>expiresAt)await refreshAuth();
  return auth?.access_token||'';
}
async function api(url,body){
  let token=await accessToken();
  if(!token)throw new Error('Faça login novamente.');
  let r=await fetch(url,{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+token},body:JSON.stringify(body||{})});
  let data=await r.json().catch(()=>({}));
  if(r.status===401){ await refreshAuth(); token=auth?.access_token||''; if(token){ r=await fetch(url,{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+token},body:JSON.stringify(body||{})}); data=await r.json().catch(()=>({})); } }
  if(!r.ok||data?.ok===false)throw new Error(data?.error||'Erro no servidor.');
  return data;
}
async function account(){
  const token=await accessToken(); if(!token)return {logged:false};
  const r=await fetch(LICENSE_URL+'?action=account',{headers:{'authorization':'Bearer '+token}});
  const data=await r.json().catch(()=>({}));
  if(r.status===401){ if(await refreshAuth())return account(); saveAuth(null); return {logged:false}; }
  if(!r.ok)return {logged:true,ok:false,error:data?.error||'Erro ao consultar assinatura.'};
  return {logged:true,...data};
}

function readMultiVersion(exePath,fallback=''){
  // A versão real vem do conteúdo instalado; o nome da pasta é apenas último fallback.
  try{
    const dir=path.dirname(exePath||'');
    const versionFile=path.join(dir,'version');
    if(fs.existsSync(versionFile)){
      const v=String(fs.readFileSync(versionFile,'utf8')||'').trim().replace(/^v/i,'');
      if(v)return v;
    }
    const pkgFile=path.join(dir,'resources','app','package.json');
    if(fs.existsSync(pkgFile)){
      const pkg=JSON.parse(fs.readFileSync(pkgFile,'utf8'));
      const v=String(pkg?.version||'').trim().replace(/^v/i,'');
      if(v)return v;
    }
  }catch{}
  // Electron empacotado normalmente usa app.asar; lê a versão do próprio EXE pelo Windows antes do fallback.
  if(process.platform==='win32' && exePath){
    try{
      const escaped=String(exePath).replace(/'/g,"''");
      const out=String(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"(Get-Item -LiteralPath '"+escaped+"').VersionInfo.ProductVersion"],{encoding:'utf8',windowsHide:true,timeout:5000})||'').trim().replace(/^v/i,'');
      if(out)return out;
    }catch{}
  }
  return String(fallback||'').replace(/^v/i,'');
}
function installedCandidates(){
  try{
    const root=installedRoot();
    if(!fs.existsSync(root))return [];
    const rows=[];
    for(const x of fs.readdirSync(root,{withFileTypes:true})){
      if(!x.isDirectory())continue;
      const dir=path.join(root,x.name);
      if(!fs.existsSync(path.join(dir,'.fireblaze-installed')))continue;
      let exe='';
      try{
        const pathFile=path.join(dir,'.fireblaze-exe');
        if(fs.existsSync(pathFile))exe=String(fs.readFileSync(pathFile,'utf8')||'').trim();
      }catch{}
      if(!exe||!fs.existsSync(exe))exe=findMultiExe(dir);
      if(!exe||!fs.existsSync(exe))continue;
      rows.push({dir,exe,version:readMultiVersion(exe,x.name)});
    }
    rows.sort((a,b)=>compareVersions(b.version,a.version));
    return rows;
  }catch{return [];}
}
function installedVersionFromDisk(){
  return installedCandidates()[0]?.version||'';
}
function isMultiRunningAt(exePath){
  if(process.platform!=='win32'||!exePath)return false;
  try{
    const escaped=String(exePath).replace(/'/g,"''");
    const out=String(execFileSync('powershell.exe',[
      '-NoProfile','-NonInteractive','-Command',
      "$p=(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq '"+escaped+"' }); if($p){'1'}else{'0'}"
    ],{encoding:'utf8',windowsHide:true,timeout:6000})||'').trim();
    return out==='1';
  }catch{return false;}
}
function removeLegacyMultiDesktopShortcut(){
  if(process.platform!=='win32')return;
  try{
    const shortcut=path.join(app.getPath('desktop'),'FIRE BLAZE Mult.lnk');
    fs.rmSync(shortcut,{force:true});
  }catch{}
}
async function downloadFile(url,dest,onProgress){
  const r=await fetch(url,{redirect:'follow'});
  if(!r.ok)throw new Error('Falha ao baixar o FIRE BLAZE Mult ('+r.status+').');
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  const total=Number(r.headers.get('content-length')||0);
  const fh=fs.openSync(dest,'w');
  let done=0;
  try{
    const reader=r.body.getReader();
    while(true){
      const {done:ended,value}=await reader.read();
      if(ended)break;
      fs.writeSync(fh,Buffer.from(value));
      done+=value.length;
      if(onProgress)onProgress(total?Math.round(done*100/total):0);
    }
  }finally{fs.closeSync(fh);}
}
async function ensureInstalled(acc){
  const latest=acc?.latest_version;
  if(!latest?.version)throw new Error('Nenhuma versão do FIRE BLAZE Mult foi publicada.');
  const version=String(latest.version).replace(/^v/i,'');
  const existingBest=installedCandidates()[0]||null;
  if(existingBest && compareVersions(existingBest.version,version)>=0){
    return {installed:true,path:existingBest.exe,version:existingBest.version};
  }
  const target=path.join(installedRoot(),version);
  const marker=path.join(target,'.fireblaze-installed');
  const pathFile=path.join(target,'.fireblaze-exe');

  // Só considera a versão alvo instalada quando o conteúdo realmente declara a mesma versão.
  // Isso evita aceitar uma pasta 1.6.42 contendo, por engano, o executável 1.6.41.
  if(fs.existsSync(marker) && fs.existsSync(pathFile)){
    try{
      const remembered=String(fs.readFileSync(pathFile,'utf8')||'').trim();
      if(remembered && fs.existsSync(remembered) && compareVersions(readMultiVersion(remembered,''),version)>=0)
        return {installed:true,path:remembered,version:readMultiVersion(remembered,version)};
    }catch{}
  }

  const direct=installedExe(version);
  if(fs.existsSync(direct) && compareVersions(readMultiVersion(direct,''),version)>=0){
    fs.mkdirSync(target,{recursive:true});
    fs.writeFileSync(marker,new Date().toISOString());
    fs.writeFileSync(pathFile,direct);
    return {installed:true,path:direct,version:readMultiVersion(direct,version)};
  }

  // Se existe uma instalação incompleta/incorreta da versão alvo, apaga antes de baixar novamente.
  if(fs.existsSync(target))fs.rmSync(target,{recursive:true,force:true});

  if(!latest.download_url)throw new Error('O pacote do FIRE BLAZE Mult ainda não foi publicado no servidor.');

  const tempRoot=path.join(app.getPath('temp'),'FIRE-BLAZE-Install');
  const zip=path.join(tempRoot,'multi-'+version+'.zip');
  fs.rmSync(tempRoot,{recursive:true,force:true});
  fs.mkdirSync(tempRoot,{recursive:true});
  win?.webContents.send('fb:install-progress',{stage:'download',progress:0});
  await downloadFile(latest.download_url,zip,p=>win?.webContents.send('fb:install-progress',{stage:'download',progress:p}));

  if(latest.sha256){
    const digest=crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
    if(digest.toLowerCase()!==String(latest.sha256).toLowerCase())throw new Error('Falha de integridade no download. Tente novamente.');
  }

  fs.rmSync(target,{recursive:true,force:true});
  fs.mkdirSync(target,{recursive:true});
  win?.webContents.send('fb:install-progress',{stage:'install',progress:0});
  execFileSync('powershell.exe',[
    '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',
    "Expand-Archive -LiteralPath '"+zip.replace(/'/g,"''")+"' -DestinationPath '"+target.replace(/'/g,"''")+"' -Force"
  ],{windowsHide:true,timeout:180000});

  function findExe(dir){
    const entries=fs.readdirSync(dir,{withFileTypes:true});
    for(const e of entries){
      const full=path.join(dir,e.name);
      if(e.isFile() && e.name.toLowerCase()==='fire blaze mult.exe')return full;
    }
    for(const e of entries){
      if(e.isDirectory()){
        const found=findExe(path.join(dir,e.name));
        if(found)return found;
      }
    }
    return '';
  }

  const found=findExe(target);
  if(!found)throw new Error('O pacote foi baixado, mas o executável FIRE BLAZE Mult.exe não foi encontrado.');

  fs.writeFileSync(marker,new Date().toISOString());
  fs.writeFileSync(pathFile,found);
  fs.rmSync(zip,{force:true});
  try{
    execFileSync('attrib',['+H',installedRoot()],{windowsHide:true});
    execFileSync('attrib',['+H',target],{windowsHide:true});
  }catch{}
  win?.webContents.send('fb:install-progress',{stage:'done',progress:100});
  const realVersion=readMultiVersion(found,'');
  if(realVersion && compareVersions(realVersion,version)<0){
    fs.rmSync(target,{recursive:true,force:true});
    throw new Error('O pacote publicado como v'+version+' contém o Mult v'+realVersion+'. Corrija o pacote v'+version+' no Admin/GitHub.');
  }
  return {installed:true,path:found,version:realVersion||version};
}
async function issueTicket(){
  return api(LICENSE_URL+'?action=issue_ticket',{device_hash:deviceHash(),device_name:deviceName()});
}
async function launchMulti(){
  const acc=await account();
  if(!acc.logged)throw new Error('Faça login.');
  if(!acc.active)throw new Error('Sua assinatura está inativa. Renove para abrir o Multi.');
  const installed=await ensureInstalled(acc);
  const ticket=await issueTicket();

  if(win && !win.isDestroyed())win.hide();

  const child=spawn(installed.path,['--fire-blaze-ticket='+ticket.ticket],{
    cwd:path.dirname(installed.path),
    detached:false,
    stdio:'ignore',
    windowsHide:false
  });

  child.on('error',()=>{
    if(win && !win.isDestroyed()){win.show();win.focus();}
  });

  child.on('exit',()=>{
    // Quando o próprio Mult se atualiza, ele fecha e abre novamente.
    // Aguarda alguns segundos para não exibir o Launcher no meio desse processo.
    setTimeout(async()=>{
      if(!win || win.isDestroyed())return;
      try{
        const state={account:await account(),installed_version:installedVersionFromDisk(),device_name:deviceName(),launcher_version:LAUNCHER_VERSION,launcher_update:updateCache};
        win.webContents.send('fb:state-refresh',state);
      }catch{}
      if(isMultiRunningAt(installed.path))return;
      win.show();
      if(win.isMinimized())win.restore();
      win.focus();
    },4500);
  });

  return {ok:true,installed_version:installed.version};
}
async function installMultiOnly(){
  const acc=await account();
  if(!acc.logged)throw new Error('Faça login.');
  if(!acc.active)throw new Error('Sua assinatura está inativa. Renove para atualizar o Multi.');
  const installed=await ensureInstalled(acc);
  return {ok:true,installed_version:installed.version};
}
async function renew(method){
  const data=await api(CHECKOUT_URL,{method});
  if(!data.checkout_url)throw new Error('Checkout não retornado.');
  await shell.openExternal(data.checkout_url);
  return {ok:true};
}
function createWindow(){
  win=new BrowserWindow({width:1060,height:720,minWidth:900,minHeight:620,backgroundColor:'#07090d',title:'FIRE BLAZE Launcher V2',icon:iconPath(),autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.loadFile('index.html');
}
ipcMain.handle('fb:state',async()=>({account:await account(),installed_version:installedVersionFromDisk(),device_name:deviceName(),launcher_version:LAUNCHER_VERSION,launcher_update:updateCache}));
ipcMain.handle('fb:login',async(_e,email,password)=>{await login(String(email||'').trim(),String(password||''));removeLegacyMultiDesktopShortcut();return {ok:true,account:await account()};});
ipcMain.handle('fb:logout',async()=>{saveAuth(null);return {ok:true};});
ipcMain.handle('fb:launch',async()=>launchMulti());
ipcMain.handle('fb:install-multi',async()=>installMultiOnly());
ipcMain.handle('fb:renew',async(_e,method)=>renew(String(method||'')));
ipcMain.handle('fb:refresh',async()=>account());
ipcMain.handle('fb:open-update',async(_e,url)=>{if(/^https:\/\//i.test(String(url||'')))await shell.openExternal(String(url));return true;});
ipcMain.handle('fb:open-customer',async()=>{await shell.openExternal(CUSTOMER_URL);return true;});
ipcMain.handle('fb:launcher-update',async()=>runLauncherUpdate());

if(!app.requestSingleInstanceLock())app.quit();
else{
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
  app.whenReady().then(()=>{app.setAppUserModelId('FIREBLAZE.LauncherV2');loadAuth();hideInternalTree();removeLegacyMultiDesktopShortcut();createWindow();});
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
  app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
}