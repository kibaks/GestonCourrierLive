import test from 'node:test';
import assert from 'node:assert/strict';
import {courrierStatusLabel,courrierCycleStatuses,matchesCourrierStatus,canInitiallyOrient} from '../src/utils/courrierStatus.ts';
test('five business stages are displayed in order',()=>{
 assert.deepEqual(courrierCycleStatuses.map(courrierStatusLabel),['En attente d’orientation','Orienté','En traitement','Traité','Archivé']);
});
test('historical orientation codes remain searchable in the oriented stage',()=>{
 for(const status of ['ASSIGNE','ORIENTE_DG','ORIENTE_DIRECTEUR']){assert.equal(courrierStatusLabel(status),'Orienté');assert.equal(matchesCourrierStatus(status,'ASSIGNE'),true);}
 assert.equal(matchesCourrierStatus('EN_ATTENTE_DG','ENREGISTRE'),true);
 assert.equal(matchesCourrierStatus('EN_TRAITEMENT','ASSIGNE'),false);
 assert.equal(matchesCourrierStatus('ARCHIVE','ALL'),true);
});

test('initial orientation is reserved for waiting courriers',()=>{
 assert.equal(canInitiallyOrient('ENREGISTRE'),true);assert.equal(canInitiallyOrient('EN_ATTENTE_DG'),true);
 for(const status of ['ASSIGNE','ORIENTE_DG','ORIENTE_DIRECTEUR','EN_TRAITEMENT','TRAITE','ARCHIVE'])assert.equal(canInitiallyOrient(status),false);
});

import {canOrientListedCourrier} from '../src/utils/courrierStatus.ts';
test('direction reception waits for DG validation, then allows one presentation to its director',()=>{
 assert.equal(canOrientListedCourrier({statut:'ENREGISTRE',orientationAwaitingPreviousStep:true}),false);
 assert.equal(canOrientListedCourrier({statut:'ASSIGNE',orientationPendingReception:true}),true);
 assert.equal(canOrientListedCourrier({statut:'ASSIGNE',orientationPendingReception:true,orientationAlreadyForwarded:true}),false);
 assert.equal(canOrientListedCourrier({statut:'ASSIGNE'}),false);
});
