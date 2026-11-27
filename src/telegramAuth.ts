import {t as trUi} from './i18n.mjs';
import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from './catalog';
type WebApp={initData?:string;ready?:()=>void;openTelegramLink?:(url:string)=>void};
type TelegramWindow=Window & {Telegram?:{WebApp?:WebApp}};
type Session={token:string;expires:number;name:string};
const webApp=()=> (window as TelegramWindow).Telegram?.WebApp;
let sdk:Promise<void>|null=null;
function loadSdk(){
 if(webApp())return Promise.resolve();
 if(!sdk)sdk=new Promise<void>((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://telegram.org/js/telegram-web-app.js?65';script.async=true;script.onload=()=>resolve();script.onerror=()=>{sdk=null;script.remove();reject(Error(trUi('Не удалось загрузить Telegram')))};document.head.appendChild(script);
 });
 return sdk;
}
const PENDING='anyminus:telegram-oidc-pending';
const CALLBACK='https://anyminus.github.io/app/';
type Pending={state:string;verifier:string;returnHash:string;expires:number};
function b64(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/g,'')}
function safeHash(value:unknown){return typeof value==='string'&&/^#\/(?:profile|track\/\d{1,20})$/.test(value)?value:'#/profile'}
function validSession(response:any):response is {accessToken:string;expiresIn:number;tokenType:'Bearer';name?:string}{
 return typeof response?.accessToken==='string'&&!!response.accessToken&&Number.isFinite(response.expiresIn)&&response.expiresIn>0&&response.expiresIn<=86400&&response.tokenType==='Bearer';
}
export function useTelegramAuth(){
 const [session,setSession]=useState<Session|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const ref=useRef<Session|null>(null),inflight=useRef<Promise<void>|null>(null),controller=useRef<AbortController|null>(null),generation=useRef(0);
 const callbackHandled=useRef(false);
 const getToken=useCallback(()=>ref.current&&ref.current.expires>Date.now()?ref.current.token:null,[]);
 const logout=useCallback(()=>{try{sessionStorage.removeItem(PENDING)}catch{}generation.current++;controller.current?.abort();ref.current=null;setSession(null);setBusy(false);setError('')},[]);
 const authenticate=useCallback(async(initData:string)=>{
  if(inflight.current)return inflight.current;
  const version=generation.current,c=new AbortController();controller.current=c;setBusy(true);setError('');
  const timer=window.setTimeout(()=>c.abort(),15000);
  const task=(async()=>{try{
   const response=await api.telegram(initData,c.signal);
   if(c.signal.aborted||generation.current!==version)return;
   if(!validSession(response))throw Error(trUi('Некорректный ответ авторизации'));
   // Display name is read only after the backend accepted the signed initData. It never grants permissions.
   let name='Telegram';let start='';
   try{const params=new URLSearchParams(initData),user=JSON.parse(params.get('user')||'{}');name=[user.first_name,user.last_name].filter(v=>typeof v==='string').join(' ').trim().slice(0,100)||'Telegram';start=params.get('start_param')||''}catch{}
   const next={token:response.accessToken,expires:Date.now()+response.expiresIn*1000,name};
   ref.current=next;setSession(next);
   if(!location.hash.startsWith('#/')&&/^track_\d{1,20}$/.test(start))location.hash='#/track/'+start.slice(6);
   else if(!location.hash.startsWith('#/')&&start==='profile')location.hash='#/profile';
  }catch(e){if(generation.current===version){ref.current=null;setSession(null);setError(e instanceof Error&&'status' in e&&e.status===401?trUi('Telegram не подтвердил вход. Откройте мини-приложение заново.'):trUi('Не удалось войти через Telegram. Попробуйте ещё раз.'))}}
  finally{clearTimeout(timer);if(generation.current===version)setBusy(false)}
  })();inflight.current=task;try{await task}finally{if(inflight.current===task)inflight.current=null}
 },[]);
 useEffect(()=>{
  const params=new URLSearchParams(location.search);
  if(params.has('code')||params.has('error')||params.has('state')){
   if(callbackHandled.current)return;
   callbackHandled.current=true;
   const code=params.get('code'),state=params.get('state');
   let pending:Pending|null=null;
   try{pending=JSON.parse(sessionStorage.getItem(PENDING)||'null');sessionStorage.removeItem(PENDING)}catch{}
   const clean=new URL(location.href);
   for(const key of ['code','state','error','error_description','iss','session_state'])clean.searchParams.delete(key);
   history.replaceState(history.state,'',clean.pathname+clean.search+clean.hash);
   if(!pending||!code||!state||state!==pending.state||typeof pending.verifier!=='string'||!Number.isFinite(pending.expires)||pending.expires<=Date.now()){
    setError(trUi('Не удалось подтвердить вход через Telegram. Попробуйте ещё раз.'));location.hash=safeHash(pending?.returnHash);return;
   }
   const version=generation.current,c=new AbortController();controller.current=c;setBusy(true);
   const timer=window.setTimeout(()=>c.abort(),18000);
   const returnHash=safeHash(pending.returnHash);
   void (async()=>{try{
    const response=await api.telegramExchange(code,state,pending!.verifier,c.signal);
    if(c.signal.aborted||version!==generation.current)return;
    if(!validSession(response))throw Error(trUi('Некорректный ответ авторизации'));
    const next={token:response.accessToken,expires:Date.now()+response.expiresIn*1000,name:typeof response.name==='string'?response.name.slice(0,100)||'Telegram':'Telegram'};
    ref.current=next;setSession(next);
   }catch{if(version===generation.current)setError(trUi('Не удалось подтвердить вход через Telegram. Попробуйте ещё раз.'))}
   finally{clearTimeout(timer);if(version===generation.current){setBusy(false);location.hash=returnHash}}})();
   return;
  }
  if(callbackHandled.current)return;
  let cancelled=false;
  void loadSdk().then(()=>{if(cancelled)return;webApp()?.ready?.();const data=webApp()?.initData;if(data)void authenticate(data)}).catch(()=>{});
  return()=>{cancelled=true};
 },[authenticate]);
 useEffect(()=>{if(!session)return;const t=window.setTimeout(()=>{if(ref.current===session){ref.current=null;setSession(null);setError(trUi('Сессия истекла. Войдите через Telegram снова.'))}},Math.max(0,session.expires-Date.now()));return()=>clearTimeout(t)},[session]);
 async function login(trackId?:string){
  if(busy)return;
  setError('');
  const data=webApp()?.initData;
  if(data){await authenticate(data);return}
  setBusy(true);const c=new AbortController();controller.current=c;const version=generation.current;
  const timer=window.setTimeout(()=>c.abort(),15000);
  try{
   const verifier=b64(crypto.getRandomValues(new Uint8Array(32)));
   const challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
   const result=await api.telegramStart(challenge,c.signal);
   if(c.signal.aborted||version!==generation.current)return;
   const url=new URL(result.url);
   if(url.origin!=='https://oauth.telegram.org'||url.pathname!=='/auth'||url.username||url.password||url.hash||typeof result.state!=='string'||!result.state||url.searchParams.get('state')!==result.state||url.searchParams.get('code_challenge')!==challenge||url.searchParams.get('code_challenge_method')!=='S256'||url.searchParams.get('redirect_uri')!==CALLBACK||!Number.isFinite(result.expiresIn)||result.expiresIn<=0||result.expiresIn>600)throw Error(trUi('Некорректный ответ Telegram'));
   const pending:Pending={state:result.state,verifier,returnHash:trackId&&/^\d{1,20}$/.test(trackId)?'#/track/'+trackId:'#/profile',expires:Date.now()+result.expiresIn*1000};
   sessionStorage.setItem(PENDING,JSON.stringify(pending));location.assign(url.href);
  }catch(e){if(version===generation.current)setError(e instanceof Error&&'status' in e&&e.status===503?trUi('Вход через Telegram пока не настроен.'):trUi('Не удалось открыть вход через Telegram. Попробуйте ещё раз.'))}
  finally{clearTimeout(timer);if(version===generation.current)setBusy(false)}
 }
 return {session,busy,error,login,logout,getToken};
}
