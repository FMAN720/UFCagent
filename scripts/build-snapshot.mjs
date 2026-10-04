import {readFile,stat,writeFile} from 'node:fs/promises';
import {parseRankings,parseEvents,parseNews,parseFighter,parseTechnical,normalize} from '../lib/ufc/parsers.mjs';
const snapshot={};
async function add(key,file,source,parser){const path='data/raw/'+file;const raw=await readFile(path,'utf8');snapshot[key]={data:parser(raw),source,fetchedAt:(await stat(path)).mtime.toISOString(),freshness:'snapshot',warning:'历史抓取快照'};}
await add('rankings','rankings.html','https://www.ufc.com.br/rankings',parseRankings);
await add('events','eventsrange.json','https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates=20260901-20261231&limit=1000',x=>parseEvents(JSON.parse(x)));
await add('news','espnnews.json','https://site.api.espn.com/apis/site/v2/sports/mma/ufc/news?limit=12',x=>parseNews(JSON.parse(x)));
await add('fighter:4350762','athlete.json','https://site.web.api.espn.com/apis/common/v3/sports/mma/ufc/athletes/4350762',x=>parseFighter(JSON.parse(x)));
await add('technical:4350762','brathlete.html','https://www.ufc.com.br/athlete/zhang-weili',x=>parseTechnical(x,'Zhang Weili'));
const more=[['2554705','valentina-shevchenko'],['3151289','yadong-song'],['3022345','justin-gaethje']];
for(const [id,slug] of more){try{const source='https://site.web.api.espn.com/apis/common/v3/sports/mma/ufc/athletes/'+id;const res=await fetch(source,{signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error(res.status);const data=parseFighter(await res.json());snapshot['fighter:'+id]={data,source,fetchedAt:new Date().toISOString(),freshness:'snapshot',warning:'历史抓取快照'};console.log('profile',data.name);
try{const source='https://www.ufc.com.br/athlete/'+slug;const res=await fetch(source,{signal:AbortSignal.timeout(12000)});if(!res.ok)throw Error(res.status);const data2=parseTechnical(await res.text(),data.name);snapshot['technical:'+id]={data:data2,source,fetchedAt:new Date().toISOString(),freshness:'snapshot',warning:'历史抓取快照'};console.log('technical',data.name);}catch(e){console.log('technical unavailable',id,e.message);}
}catch(e){console.log('profile unavailable',id,e.message);}}
const candidates=new Map();for(const e of snapshot.events.data)for(const b of e.bouts)for(const f of b.fighters)candidates.set(f.id,{id:f.id,name:f.name,url:'https://www.espn.com/mma/fighter/_/id/'+f.id});for(const [k,v] of Object.entries(snapshot))if(k.startsWith('fighter:'))candidates.set(v.data.id,{id:v.data.id,name:v.data.name,url:v.data.url});
snapshot.directory={data:[...candidates.values()],source:'https://www.espn.com/mma/',fetchedAt:snapshot.events.fetchedAt,freshness:'snapshot',warning:'已抓取赛事及选手名单索引'};
for(const f of candidates.values())snapshot['search:'+normalize(f.name)]={...snapshot.directory,data:[f]};
await writeFile('lib/ufc/snapshot.json',JSON.stringify(snapshot,null,2));console.log('Saved',Object.keys(snapshot).length,'entries');
