import test from 'node:test';
import assert from 'node:assert/strict';
import {selectCourrierDocument} from '../src/utils/courrierDocument.ts';
const image={id:'image',type:'fichier',nom:'courrier.JPG',extension:'JPG'};
const receipt={id:'receipt',type:'fichier',nom:'AR_courrier.pdf',extension:'pdf'};
test('original image wins over a receipt arriving first with its flag missing',()=>{
 assert.equal(selectCourrierDocument([receipt,image])?.id,'image');
});
test('receipt folder and nested folders cannot supply the automatic document',()=>{
 const folder={id:'ar-folder',type:'dossier',nom:'Accusés de réception'};
 const nested={id:'nested',type:'dossier',nom:'2026',parentId:folder.id};
 assert.equal(selectCourrierDocument([folder,nested,{...receipt,nom:'reception.pdf',parentId:nested.id},image])?.id,'image');
});
test('receipt-only courrier never opens its receipt as the original',()=>{
 assert.equal(selectCourrierDocument([receipt]),undefined);
 assert.equal(selectCourrierDocument([{...receipt,nom:'reception.pdf',estAccuseReception:true}]),undefined);
});
test('original precedes an annotated export and original PDFs still open',()=>{
 const pdf={id:'pdf',type:'fichier',nom:'lettre.pdf',extension:'PDF'};
 assert.equal(selectCourrierDocument([{...pdf,id:'derived',nom:'annoté_lettre.pdf'},pdf])?.id,'pdf');
});
