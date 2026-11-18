import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationSender,registrationSections,internalRegistrationIssue} from '../src/utils/registrationParties';
import type {EntiteOrganisationnelle} from '../src/types';
import type {FormStructure} from '../src/services/formulaireCourrierService';
const entities=[{id:'dg',nom:'Direction Générale',type:'direction_generale',actif:true},{id:'daf',nom:'Direction Administrative et Financière',type:'direction',parentId:'dg',actif:true},{id:'bureau',nom:'Bureau administratif',type:'bureau',parentId:'daf',actif:true}] as EntiteOrganisationnelle[];
const levels=[{code:'direction_generale',libelleSingulier:'Direction générale'},{code:'direction',libelleSingulier:'Direction'},{code:'bureau',libelleSingulier:'Bureau'}];
test('sender is the actual assigned entity, including a bureau',()=>{
 const sender=registrationSender({nom:'Secrétariat DAF',entiteId:'bureau',direction:'Direction Administrative et Financière'},entities,levels);
 assert.equal(sender.name,'Bureau administratif');assert.equal(sender.entity?.id,'bureau');assert.deepEqual(sender.cascade,{bureau:'bureau',direction:'daf',direction_generale:'dg'});
});
test('DG secretary resolves its own entity; missing assignment never guesses another entity',()=>{
 const dg=registrationSender({nom:'Secrétariat DG',entiteId:'dg',direction:'Direction Générale'},entities,levels);assert.equal(dg.entity?.id,'dg');assert.equal(dg.name,'Direction Générale');
 assert.equal(registrationSender({nom:'Sans rattachement'},entities,levels).entity,undefined);assert.equal(registrationSender({nom:'Sans rattachement'},entities,levels).name,'');
});
test('all layouts remove editable sender and require a recipient without altering published config',()=>{
 const sections=[{id:'s',type:'section',label:'Informations',columns:[{id:'c',width:6,fields:[{id:'e',name:'expediteur',label:'Expéditeur',required:true},{id:'o',name:'objet',label:'Objet',required:true}]}]}] as FormStructure;
 const before=JSON.stringify(sections);const result=registrationSections(sections);
 assert.equal(JSON.stringify(sections),before);assert.deepEqual(result[0].columns[0].fields.map(f=>f.name),['destinataire','objet']);
 assert.equal(result[0].columns[0].fields[0].required,true);
});
test('existing recipient keeps its configured position, label and presentation',()=>{
 const sections=[{id:'s',type:'section',label:'Réception',columns:[{id:'c',width:12,fields:[{id:'d',name:'destinataire',label:'Unité destinataire',type:'text',required:false}]}]}] as FormStructure;
 const result=registrationSections(sections);assert.equal(result[0].columns[0].fields[0].label,'Unité destinataire');assert.equal(result[0].columns[0].fields[0].required,true);assert.equal(result[0].columns[0].fields.length,1);
 assert.deepEqual(registrationSections([]),[]);
});

test('custom sender and recipient aliases obey the same immutable sender rule',()=>{
 const sections=[{id:'s',type:'section',label:'Infos',columns:[{id:'c',width:12,fields:[{id:'e',name:'emetteurInterne',label:'Émetteur'},{id:'d',name:'recipientUnite',label:'Unité destinataire'}]}]}] as FormStructure;
 const fields=registrationSections(sections)[0].columns[0].fields;assert.equal(fields.length,1);assert.equal(fields[0].name,'destinataire');
});

test('recipient is never duplicated across configured sections or aliases',()=>{
 const sections=[{id:'s',type:'section',label:'Infos',columns:[{id:'c',width:12,fields:[{id:'d',name:'destinataire',label:'Destinataire'},{id:'d2',name:'recipientUnite',label:'Entité destinataire'}]}]}] as FormStructure;
 assert.equal(registrationSections(sections).flatMap(s=>s.columns.flatMap(c=>c.fields)).filter(f=>f.name==='destinataire').length,1);
});

test('internal invalid parties are explained before submitting, without a network error',()=>{
 assert.match(internalRegistrationIssue(entities[0],entities[0])||'',/déjà l’entité expéditrice/);
 assert.match(internalRegistrationIssue(entities[1],entities[2])||'',/uniquement entre la Direction Générale/);
 assert.equal(internalRegistrationIssue(entities[0],entities[1]),undefined);
 assert.equal(internalRegistrationIssue(entities[1],entities[0]),undefined);
});
