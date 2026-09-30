import {spawnSync} from 'node:child_process';
// Apply additive migrations to the existing database before publishing code that uses them.
for (const args of [['d1','migrations','apply','DB','--remote'],['deploy','--keep-vars']]) {
  const result=spawnSync('wrangler',args,{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
