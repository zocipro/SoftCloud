import {spawnSync} from 'node:child_process';
// Provision bindings first with collection disabled, then apply the additive schema.
for (const args of [['deploy','--keep-vars'],['d1','migrations','apply','DB','--remote']]) {
  const result=spawnSync('wrangler',args,{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
