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
  const script=document.createElement('script');script.src='https://telegram.org/js/telegram-web-app.js?65';script.async=true;script.onload=()=>resolve();script.onerror=()=>{sdk=null;script.remove();reject(Error('Не удалось загрузить Telegram'))};document.head.appendChild(script);
 });
 return sdk;
}
function miniAppLink(trackId?:string){
 const configured=import.meta.env.VITE_TELEGRAM_MINI_APP_URL;
 if(typeof configured!=='string'||!configured)return null;
 try{
  const u=new URL(configured);
  if(u.origin!=='https://t.me'||u.username||u.password||u.hash||!/^\/[A-Za-z0-9_]+(?:\/[A-Za-z0-9_]+)?\/?$/.test(u.pathname))return null;
  u.searchParams.set('startapp',trackId&&/^\d{1,20}$/.test(trackId)?'track_'+trackId:'profile');
  return u.href;
 }catch{return null}
}
export function useTelegramAuth(){
 const [session,setSession]=useState<Session|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const ref=useRef<Session|null>(null),inflight=useRef<Promise<void>|null>(null),controller=useRef<AbortController|null>(null),generation=useRef(0);
 const getToken=useCallback(()=>ref.current&&ref.current.expires>Date.now()?ref.current.token:null,[]);
 const logout=useCallback(()=>{generation.current++;controller.current?.abort();ref.current=null;setSession(null);setBusy(false);setError('')},[]);
 const authenticate=useCallback(async(initData:string)=>{
  if(inflight.current)return inflight.current;
  const version=generation.current,c=new AbortController();controller.current=c;setBusy(true);setError('');
  const timer=window.setTimeout(()=>c.abort(),15000);
  const task=(async()=>{try{
   const response=await api.telegram(initData,c.signal);
   if(c.signal.aborted||generation.current!==version)return;
   if(typeof response?.accessToken!=='string'||!response.accessToken||!Number.isFinite(response.expiresIn)||response.expiresIn<=0||response.tokenType!=='Bearer')throw Error('Некорректный ответ авторизации');
   // Display name is read only after the backend accepted the signed initData. It never grants permissions.
   let name='Telegram';let start='';
   try{const params=new URLSearchParams(initData),user=JSON.parse(params.get('user')||'{}');name=[user.first_name,user.last_name].filter(v=>typeof v==='string').join(' ').trim().slice(0,100)||'Telegram';start=params.get('start_param')||''}catch{}
   const next={token:response.accessToken,expires:Date.now()+response.expiresIn*1000,name};
   ref.current=next;setSession(next);
   if(!location.hash.startsWith('#/')&&/^track_\d{1,20}$/.test(start))location.hash='#/track/'+start.slice(6);
   else if(!location.hash.startsWith('#/')&&start==='profile')location.hash='#/profile';
  }catch(e){if(generation.current===version){ref.current=null;setSession(null);setError(e instanceof Error&&'status' in e&&e.status===401?'Telegram не подтвердил вход. Откройте мини-приложение заново.':'Не удалось войти через Telegram. Попробуйте ещё раз.')}}
  finally{clearTimeout(timer);if(generation.current===version)setBusy(false)}
  })();inflight.current=task;try{await task}finally{if(inflight.current===task)inflight.current=null}
 },[]);
 useEffect(()=>{
  let cancelled=false;
  // Ordinary visitors remain guests; only signed Mini App data can bootstrap a session.
  void loadSdk().then(()=>{if(cancelled)return;webApp()?.ready?.();const data=webApp()?.initData;if(data)void authenticate(data)}).catch(()=>{});
  return()=>{cancelled=true};
 },[authenticate]);
 useEffect(()=>{if(!session)return;const t=window.setTimeout(()=>{if(ref.current===session){ref.current=null;setSession(null);setError('Сессия истекла. Войдите через Telegram снова.')}},Math.max(0,session.expires-Date.now()));return()=>clearTimeout(t)},[session]);
 async function login(trackId?:string){
  setError('');
  const data=webApp()?.initData;
  if(data){await authenticate(data);return}
  const link=miniAppLink(trackId);
  if(link){location.assign(link);return}
  setError('Вход доступен в Telegram Mini App. Ссылка на бота пока не настроена.');
 }
 return {session,busy,error,login,logout,getToken};
}
