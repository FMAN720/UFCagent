import { load } from 'cheerio/slim';
export const clean = v => String(v ?? '').replace(/\s+/g,' ').trim();
export const normalize = v => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const divisionNames = {'peso-mosca':'男子蝇量级','peso-galo':'男子雏量级','peso-pena':'男子羽量级','peso-leve':'男子轻量级','peso meio-médio':'男子次中量级','peso-médio':'男子中量级','peso meio-pesado':'男子轻重量级','peso-pesado':'男子重量级','peso-palha feminino':'女子草量级','peso-mosca feminino':'女子蝇量级','peso-galo feminino':'女子雏量级',"men's pound-for-pound":'男子 P4P','peso por peso feminino':'女子 P4P'};
export function safeUrl(v,base='https://www.ufc.com.br'){try{const u=new URL(v,base);return u.protocol==='https:'?u.href:null;}catch{return null;}}
export function parseRankings(html){
 const $=load(html);const divisions=[];
 $('table').each((_,el)=>{const t=$(el);const heading=t.find('caption h4').clone();heading.find('span').remove();const original=clean(heading.text());if(!original)return;
 const system=t.find('.views-field-meta-weight-class-rank').length?'meta':'media';const name=divisionNames[original.toLowerCase()]||original;
 const rows=[];t.find('tbody tr').each((_,tr)=>{const row=$(tr);const a=row.find('.views-field-title a').first();const rank=parseInt(row.find('.views-field-weight-class-rank,.views-field-meta-weight-class-rank').text());const name=clean(a.text());if(!name||!Number.isFinite(rank))return;
 const movement=row.find('.views-field-weight-class-rank-change,.views-field-meta-weight-class-rank-change');const n=Number(clean(movement.text()).match(/\d+/)?.[0]||0);const change=movement.find('.athlete-rankings--rank-increase').length?n:movement.find('.athlete-rankings--rank-decrease').length?-n:0;
 rows.push({rank,name,url:safeUrl(a.attr('href')),change});});
 const championLink=t.find('caption h5 a').first();const champion=name.includes('P4P')?null:{name:clean(championLink.text()),url:safeUrl(championLink.attr('href'))};
 if(rows.length)divisions.push({id:system+'-'+normalize(original),name,original,system,champion:champion?.name?champion:null,rows});
 });
 if(divisions.filter(d=>d.system==='media').length<10)throw new Error('官方排名页结构变化，未获得完整榜单');
 return divisions;
}
export function parseEvents(raw){
 if(!Array.isArray(raw.events))throw new Error('赛事数据格式异常');
 return raw.events.filter(e=>!e.name?.includes('Contender Series')).map(e=>({id:e.id,name:e.name,date:e.date,url:safeUrl(e.links?.find(l=>l.href?.startsWith('https:'))?.href,'https://www.espn.com'),status:e.status?.type?.state||e.competitions?.[0]?.status?.type?.state||'pre',venue:clean([e.competitions?.[0]?.venue?.fullName,e.competitions?.[0]?.venue?.address?.city].filter(Boolean).join(' · ')),bouts:(e.competitions||[]).map(c=>({id:c.id,division:c.type?.abbreviation||'',status:c.status?.type?.state||'pre',round:c.status?.period||null,method:c.status?.result?.displayName||'',fighters:(c.competitors||[]).map(f=>({id:f.id,name:f.athlete?.displayName||f.athlete?.fullName,record:f.records?.find(r=>r.name==='overall')?.summary||null,winner:!!f.winner}))}))}));
}
export function parseNews(raw){if(!Array.isArray(raw.articles))throw new Error('消息数据格式异常');return raw.articles.map(a=>({id:String(a.id),title:clean(a.headline),date:a.published,url:safeUrl(a.links?.web?.href,'https://www.espn.com'),category:a.type||'新闻'})).filter(a=>a.url&&a.title).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));}
export function parseSearch(raw){if(!Array.isArray(raw.results))throw new Error('搜索数据格式异常');return raw.results.flatMap(r=>r.contents||[]).filter(p=>p.sport==='mma').map(p=>({id:p.uid?.match(/~a:(\d+)/)?.[1],name:clean(p.displayName),url:safeUrl(p.link?.web,'https://www.espn.com')})).filter(p=>p.id);}
export function parseFighter(raw){
 const a=raw.athlete;if(!a?.id||!a.displayName)throw new Error('未找到该选手');
 const summary=a.statsSummary?.statistics||[];const record=summary.find(s=>s.name==='wins-losses-draws')?.displayValue||null;
 const history=(raw.events||[]).map(id=>raw.eventsMap?.[id]).filter(Boolean).map(e=>({id:e.uid,event:e.name,date:e.gameDate,result:e.gameResult,opponent:e.opponent?.displayName||'待定',opponentId:e.opponent?.id,method:e.status?.result?.displayName||'未公布',round:e.status?.period||null,time:e.status?.displayClock||null,url:safeUrl(e.links?.[0]?.href,'https://www.espn.com')})).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
 return {id:a.id,name:a.displayName,nickname:a.nickname||null,record,ko:summary.find(s=>s.name==='tkos-tkoLosses')?.displayValue||null,submissions:summary.find(s=>s.name==='submissions-submissionLosses')?.displayValue||null,age:a.age||null,gender:a.gender||null,division:a.weightClass?.text||null,weight:a.displayWeight||null,height:a.displayHeight||null,reach:a.displayReach||null,stance:a.stance?.text||null,country:a.citizenship||null,active:a.active,url:safeUrl(a.links?.[0]?.href,'https://www.espn.com'),history};
}
export function parseTechnical(html,expectedName){
 const $=load(html);const title=clean($('h1').first().text());const pageName=normalize(title);const words=clean(expectedName).split(' ').map(normalize).filter(Boolean);
 if(!pageName||!words.every(w=>pageName.includes(w)))throw new Error('技术统计页与选手身份不符');
 const values={};$('.c-stat-compare__group').each((_,e)=>{const group=$(e);const label=clean(group.find('.c-stat-compare__label').text()).toLowerCase();const text=clean(group.find('.c-stat-compare__number').text());const value=Number(text.replace('%','').trim());if(!text||!Number.isFinite(value))return;
 const key=label.includes('conectados')?'slpm':label.includes('absorvidos')?'sapm':label.includes('média de quedas')?'tdAvg':label.includes('média de finaliza')?'subAvg':label.includes('defesa de golpes')?'strikeDefense':label.includes('defesa de quedas')?'tdDefense':null;if(key)values[key]=value;});
 if(Object.keys(values).length<4)throw new Error('技术统计缺失');return values;
}
