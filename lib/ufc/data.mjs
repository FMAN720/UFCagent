import snapshot from './snapshot.json' with {type:'json'};
import {parseRankings,parseEvents,parseNews,parseFighter,parseSearch,parseTechnical,normalize} from './parsers.mjs';
import {searchName} from '../i18n/domain.mjs';
export const aliases={'张伟丽':'Zhang Weili','伟丽':'Zhang Weili','宋亚东':'Song Yadong','李景亮':'Li Jingliang','张名扬':'Zhang Mingyang','王聪':'Wang Cong','闫晓楠':'Yan Xiaonan','小鹰':'Khabib Nurmagomedov','康纳':'Conor McGregor','嘴炮':'Conor McGregor','马哈切夫':'Islam Makhachev','伊斯兰':'Islam Makhachev','佩雷拉':'Alex Pereira','阿德萨亚':'Israel Adesanya','沃尔卡诺夫斯基':'Alexander Volkanovski','托普里亚':'Ilia Topuria','舍甫琴科':'Valentina Shevchenko','盖奇':'Justin Gaethje','奥利维拉':'Charles Oliveira','潘托加':'Alexandre Pantoja','约书亚':'Joshua Van'};
export function translateName(q){return aliases[q]||searchName(q);}
export const cache=new Map();const inflight=new Map();
export async function requestData(url,kind='json'){
 const allowed=['www.ufc.com','www.ufc.com.br','site.api.espn.com','site.web.api.espn.com'];const u=new URL(url);if(!allowed.includes(u.hostname)||u.protocol!=='https:')throw new Error('不支持的数据地址');
 const res=await fetch(url,{headers:{Accept:kind==='json'?'application/json':'text/html'},signal:AbortSignal.timeout(10000)});if(!res.ok)throw new Error(`来源暂不可用（${res.status}）`);const text=await res.text();if(text.length>2500000)throw new Error('数据超出大小限制');return kind==='json'?JSON.parse(text):text;
}
export async function cached(key,ttl,loader){
 const prior=cache.get(key);if(prior&&Date.now()<prior.expires)return {...prior.value,freshness:prior.value.freshness==='live'?'cache':prior.value.freshness};
 if(inflight.has(key))return inflight.get(key);
 const job=(async()=>{let value;try{const loaded=await loader();value={data:loaded.data,source:loaded.source,fetchedAt:new Date().toISOString(),freshness:'live',warning:null};}catch{const fallback=prior?.value||snapshot[key];if(!fallback)throw new Error('数据源暂时无法访问，请稍后重试。没有可用缓存。');value={...fallback,freshness:'snapshot',warning:'实时抓取失败，正在显示已抓取的历史快照，请核对抓取时间。'};}
 cache.delete(key);cache.set(key,{value,expires:Date.now()+(value.freshness==='snapshot'?60000:ttl)});if(cache.size>128)cache.delete(cache.keys().next().value);return value;})();
 inflight.set(key,job);try{return await job;}finally{inflight.delete(key);}
}
export const getRankings=()=>cached('rankings',900000,async()=>{const source='https://www.ufc.com.br/rankings';return {data:parseRankings(await requestData(source,'text')),source};});
export function eventRange(now=new Date()){const from=new Date(now);from.setUTCDate(from.getUTCDate()-14);const to=new Date(now);to.setUTCDate(to.getUTCDate()+120);const fmt=d=>d.toISOString().slice(0,10).replaceAll('-','');return fmt(from)+'-'+fmt(to);}
export const getEvents=()=>cached('events',300000,async()=>{const source='https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates='+eventRange()+'&limit=1000';return {data:parseEvents(await requestData(source)),source};});
export const getNews=()=>cached('news',600000,async()=>{const source='https://site.api.espn.com/apis/site/v2/sports/mma/ufc/news?limit=12';return {data:parseNews(await requestData(source)),source};});
export const getFighter=id=>{if(!/^\d{1,10}$/.test(id))throw new Error('选手 ID 无效');return cached('fighter:'+id,3600000,async()=>{const source='https://site.web.api.espn.com/apis/common/v3/sports/mma/ufc/athletes/'+id;return {data:parseFighter(await requestData(source)),source};});};
export async function searchFighters(query){const q=translateName(query.trim());if(q.length<2||q.length>80)throw new Error('请输入 2–80 个字符的姓名');try{return await cached('search:'+normalize(q),3600000,async()=>{const source='https://site.web.api.espn.com/apis/search/v2?region=us&lang=en&query='+encodeURIComponent(q)+'&limit=50&type=player';return {data:parseSearch(await requestData(source)),source};});}catch(e){const local=snapshot.directory;if(!local)throw e;const terms=q.split(/\s+/).map(normalize);return {...local,data:local.data.filter(f=>terms.every(t=>normalize(f.name).includes(t))),freshness:'snapshot',warning:'在线搜索暂不可用，仅搜索已抓取名单；结果可能不完整。'};}}
export async function getTechnical(fighter){
 return cached('technical:'+fighter.id,3600000,async()=>{const rank=await getRankings();const entry=rank.data.flatMap(d=>[d.champion,...d.rows]).find(r=>r&&normalize(r.name)===normalize(fighter.name));const path=entry?.url?new URL(entry.url).pathname:'/athlete/'+fighter.name.toLowerCase().replace(/[^a-z0-9 ]/g,'').replaceAll(' ','-');const source='https://www.ufc.com.br'+path;return {data:parseTechnical(await requestData(source,'text'),fighter.name),source};});
}
