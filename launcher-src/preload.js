const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('fireBlaze',{
  state:()=>ipcRenderer.invoke('fb:state'),
  login:(email,password)=>ipcRenderer.invoke('fb:login',email,password),
  logout:()=>ipcRenderer.invoke('fb:logout'),
  launch:()=>ipcRenderer.invoke('fb:launch'),
  renew:method=>ipcRenderer.invoke('fb:renew',method),
  refresh:()=>ipcRenderer.invoke('fb:refresh'),
  openUpdate:url=>ipcRenderer.invoke('fb:open-update',url),
  openCustomer:()=>ipcRenderer.invoke('fb:open-customer'),
  updateLauncher:()=>ipcRenderer.invoke('fb:launcher-update'),
  onLauncherUpdateProgress:cb=>ipcRenderer.on('fb:launcher-update-progress',(_e,p)=>cb(p)),
  onInstallProgress:fn=>ipcRenderer.on('fb:install-progress',(_e,data)=>fn(data))
});