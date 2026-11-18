import test from 'node:test';
import assert from 'node:assert/strict';
import {batchContextRow,batchRegistrationFailure} from '../src/utils/batchRegistration.ts';
import {apiValidationError} from '../src/utils/apiValidationError.ts';
test('visible internal context overrides a stale external draft without altering its content',()=>{
 const draft={id:'one',type:'EXTERNE',sens:'SORTANT',objet:'Dossier pour avis',destinataire:'Direction destinataire'};
 const payload=batchContextRow(draft,{type:'INTERNE',sens:'ENTRANT'});
 assert.equal(payload.type,'INTERNE');assert.equal(payload.sens,'ENTRANT');assert.equal(payload.objet,draft.objet);assert.equal(payload.destinataire,draft.destinataire);assert.equal(draft.type,'EXTERNE');
});
test('a validation reason is shown once even if repeated by Laravel',()=>{
 const message='Un courrier externe entrant doit être adressé à la Direction générale.';
 assert.equal(apiValidationError({message,errors:{destinataire:[message,message]}}),message);
 assert.equal(apiValidationError({message:'Erreur',errors:{objet:['Objet obligatoire'],destinataire:['Destinataire obligatoire']}}),'Objet obligatoire\nDestinataire obligatoire');
});

test('business validation is never misreported as a connection error',()=>{
 const reason='Une entité interne ne peut pas être à la fois expéditrice et destinataire du même courrier.';
 assert.equal(batchRegistrationFailure(new Error(reason)),reason);
 assert.match(batchRegistrationFailure(new TypeError('Failed to fetch')),/Connexion à l’API interrompue/);
 assert.doesNotMatch(batchRegistrationFailure(new Error('Destinataire obligatoire')),/connexion|Connexion/);
});
