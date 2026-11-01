import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const sync=fs.readFileSync(new URL('../public/ui.js',import.meta.url),'utf8').split('let cloudUser=null')[1];
function setup({state=null,revision=0,confirm=true}={}){
 const records=new Map(),status={},puts=[];let account='user-a',failure=null;
 const context=vm.createContext({structuredClone,console,confirm:()=>confirm,initial:()=>({quests:[]}),render:()=>{},toast:()=>{},$ :()=>status,
 db:{transaction(){const tx={};tx.objectStore=()=>({get(key){const r={};queueMicrotask(()=>{r.result=records.get(key);r.onsuccess()});return r},put(value,key){records.set(key,structuredClone(value));queueMicrotask(()=>tx.oncomplete?.())}});return tx}},
 fetch:async(path,options={})=>{if(path==='/api/me')return {ok:true,json:async()=>({userId:account})};if(!options.method)return {ok:true,json:async()=>({state,revision})};puts.push(JSON.parse(options.body));if(failure)return {ok:false,status:failure};return {ok:true,json:async()=>({revision:JSON.parse(options.body).revision+1})}}});
 vm.runInContext("let data={schemaVersion:1,tasks:[{id:'local',text:'memo',status:0}],rpg:{quests:[]}},queue=Promise.resolve();"+'let cloudUser=null'+sync,context);
 return {context,records,status,puts,setAccount:x=>account=x,fail:x=>failure=x,run:s=>vm.runInContext(s,context),connect:async()=>{vm.runInContext('connectCloud()',context);await vm.runInContext('queue',context)}};
}
test('loads existing cloud state and revision without writing over it',async()=>{const x=setup({state:{schemaVersion:1,tasks:[{id:'remote'}],rpg:{}},revision:4});await x.connect();assert.equal(x.run('data.tasks[0].id'),'remote');assert.equal(x.run('cloudRevision'),4);assert.equal(x.puts.length,0)});
test('imports local data only with confirmation',async()=>{const x=setup();await x.connect();assert.equal(x.puts[0].state.tasks[0].id,'local');assert.equal(x.records.get('cloud:user-a').dirty,false)});
test('declining import creates an empty cloud save',async()=>{const x=setup({confirm:false});await x.connect();assert.equal(x.puts[0].state.tasks.length,0)});
test('conflict retains local changes and blocks further upload',async()=>{const x=setup();x.fail(409);await x.connect();assert.equal(x.records.get('cloud:user-a').dirty,true);await x.run('saveCloud()');assert.equal(x.puts.length,1);assert.equal(x.run('cloudBlocked'),true)});
test('network failure retains unsynced data',async()=>{const x=setup();x.fail(503);await x.connect();assert.equal(x.records.get('cloud:user-a').state.tasks[0].id,'local');assert.equal(x.records.get('cloud:user-a').dirty,true)});
test('account change prevents saving prior account data',async()=>{const x=setup({state:{schemaVersion:1,tasks:[],rpg:{}},revision:2});await x.connect();x.setAccount('user-b');await x.run('saveCloud()');assert.equal(x.puts.length,0);assert.equal(x.run('cloudBlocked'),true)});
