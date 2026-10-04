import {load} from 'cheerio/slim';
import fs from 'node:fs';
const $=load(fs.readFileSync('data/raw/news.html','utf8'));
console.log('NEWS', $('a[href*="/news/"]').slice(10,15).map((_,e)=>$(e).parent().prop('outerHTML')).get());
const a=JSON.parse(fs.readFileSync('data/raw/athlete.json'));
console.log('EVENTS',JSON.stringify(a.events).slice(0,5500));
console.log('SWITCHER',JSON.stringify(a.playerSwitcher).slice(0,600));
const r=load(fs.readFileSync('data/raw/rankings.html','utf8'));console.log('RANK TITLES',r('h1,h2,h3,h4,table').map((_,e)=>r(e).prop('outerHTML').slice(0,2500)).get().join('\n').slice(0,13000));console.log('SEARCH',fs.readFileSync('data/raw/search2.json','utf8'));
