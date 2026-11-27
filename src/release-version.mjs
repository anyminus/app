/** Only accept a published release manifest, never a branch or CI status. */
export function publishedUpgrade(current, manifest){
 if(manifest?.schemaVersion!==1||typeof manifest.version!=='string'||typeof current!=='string')return null;
 const pattern=/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/;
 if(!pattern.test(current)||!pattern.test(manifest.version))return null;
 const local=current.split('.').map(Number),remote=manifest.version.split('.').map(Number);
 for(let i=0;i<3;i++){if(remote[i]>local[i])return manifest.version;if(remote[i]<local[i])return null}
 return null;
}
