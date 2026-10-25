import assert from 'node:assert/strict';
import {test} from 'node:test';
import worker,{verifyGoogle} from '../server/worker.mjs';
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test'};
const fetcher=async()=>Response.json({keys:[jwk]});
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
async function jwt(overrides={}){let h=enc({alg:'RS256',kid:'test'}),p=enc({iss:'https://accounts.google.com',aud:'client',sub:'user-1',nonce:'nonce',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),email_verified:true,...overrides});let s=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(h+'.'+p));return h+'.'+p+'.'+Buffer.from(s).toString('base64url')}
test('valid signed Google identity',async()=>assert.equal((await verifyGoogle(await jwt(),'client','nonce',fetcher)).sub,'user-1'));
for(const [name,claims] of Object.entries({audience:{aud:'other'},nonce:{nonce:'wrong'},issuer:{iss:'https://attacker.example'},expired:{exp:1},unverified:{email_verified:false},future:{iat:Date.now()/1000+3600}}))test('reject '+name,async()=>assert.rejects(verifyGoogle(await jwt(claims),'client','nonce',fetcher)));
test('reject modified signature',async()=>{let t=await jwt();let p=t.split('.');p[1]=enc({sub:'attacker'});await assert.rejects(verifyGoogle(p.join('.'),'client','nonce',fetcher))});
test('unconfigured deployment fails closed',async()=>assert.equal((await worker.fetch(new Request('https://app.example/api/state'),{})).status,503));
test('anonymous state request rejected',async()=>assert.equal((await worker.fetch(new Request('https://app.example/api/state'),{APP_ORIGIN:'https://app.example',DB:{}})).status,401));
test('oauth callback without state rejected',async()=>assert.equal((await worker.fetch(new Request('https://app.example/auth/callback'),{APP_ORIGIN:'https://app.example',DB:{}})).status,400));
