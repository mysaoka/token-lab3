import {copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const stage=process.argv[2];
if (!['1','2','3'].includes(stage)) throw Error('Use: node scripts/set-stage.mjs 1|2|3');
const root=new URL('../',import.meta.url);
for (const [src,dst] of [['Token.sol.txt','contracts/Token.sol'],['Token.ts.txt','test/Token.ts']]) {
  copyFileSync(new URL(`stages/${stage}/${src}`,root),new URL(`token-contract/${dst}`,root));
}
console.log(`Stage ${stage} selected. Contract and tests replaced with the prepared stage.`);
