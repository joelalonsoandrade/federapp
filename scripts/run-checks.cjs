// Starts serve.cjs, runs every check (check.cjs + *-check.cjs) in order, stops the server; exits non-zero on the first failure.
const {spawn,spawnSync}=require('node:child_process');const fs=require('node:fs');const net=require('node:net');
const checks=['check.cjs',...fs.readdirSync(__dirname).filter(f=>f.endsWith('-check.cjs')).sort()];
const server=spawn(process.execPath,[`${__dirname}/serve.cjs`],{stdio:'inherit'});
const ready=()=>new Promise(r=>net.connect(4173,'127.0.0.1').on('connect',function(){this.end();r(true);}).on('error',()=>r(false)));
(async()=>{
  for(let i=0;!(await ready());i++){if(i>50||server.exitCode!==null)throw new Error('serve.cjs did not start on port 4173');await new Promise(r=>setTimeout(r,100));}
  for(const check of checks){console.log(`\n▶ ${check}`);const {status}=spawnSync(process.execPath,[`${__dirname}/${check}`],{stdio:'inherit'});if(status!==0)throw new Error(`${check} failed (exit ${status})`);}
  console.log(`\nAll ${checks.length} checks passed.`);
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>server.kill());
