type DocumentEntry={id:string;nom:string;type:string;parentId?:string|null;extension?:string|null;chemin?:string|null;estAccuseReception?:boolean};
/** Automatic opening must never fall back to a receipt, even with legacy missing flags. */
export function selectCourrierDocument<T extends DocumentEntry>(entries:readonly T[]):T|undefined {
 const receiptFolders=new Set(entries.filter(item=>item.type==='dossier'&&item.nom.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes('accuse')).map(item=>item.id));
 let changed=true;
 while(changed){changed=false;for(const item of entries)if(item.type==='dossier'&&item.parentId&&receiptFolders.has(item.parentId)&&!receiptFolders.has(item.id)){receiptFolders.add(item.id);changed=true;}}
 const candidates=entries.filter(item=>item.type==='fichier'&&!item.estAccuseReception&&!/^AR_/i.test(item.nom)&&!(item.parentId&&receiptFolders.has(item.parentId))
  && (/^(pdf|jpe?g|png)$/i.test(item.extension||'')||/\.(pdf|jpe?g|png)(?:[?#].*)?$/i.test(item.nom)||/\.(pdf|jpe?g|png)(?:[?#].*)?$/i.test(item.chemin||'')));
 return candidates.find(item=>!/^(annoté_|traité_|final_)/i.test(item.nom))||candidates[0];
}
