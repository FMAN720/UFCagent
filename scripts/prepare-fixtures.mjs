import fs from 'node:fs';
import {load} from 'cheerio/slim';
fs.mkdirSync('tests/fixtures',{recursive:true});
const r=load(fs.readFileSync('data/raw/rankings.html','utf8'));fs.writeFileSync('tests/fixtures/rankings.html',r('table').map((_,e)=>r(e).prop('outerHTML')).get().join('\n'));
const b=load(fs.readFileSync('data/raw/brathlete.html','utf8'));fs.writeFileSync('tests/fixtures/brathlete.html',b('h1,.c-stat-compare__group').map((_,e)=>b(e).prop('outerHTML')).get().join('\n'));
for(const name of ['search2','athlete','eventsrange']){let raw=JSON.parse(fs.readFileSync('data/raw/'+name+'.json','utf8'));if(name==='athlete'){raw={athlete:raw.athlete,events:raw.events,eventsMap:raw.eventsMap};for(const e of Object.values(raw.eventsMap)){e.links=e.links?.filter(l=>l.href?.startsWith('https:'));if(e.opponent)delete e.opponent.links;}}if(name==='eventsrange'){raw={events:raw.events.map(e=>({...e,competitions:e.competitions.map(c=>{const {details,headlines,geoBroadcasts,...keep}=c;return keep;})}))};}fs.writeFileSync('tests/fixtures/'+name+'.json',JSON.stringify(raw));}
console.log('Saved sanitized parser fixtures.');
