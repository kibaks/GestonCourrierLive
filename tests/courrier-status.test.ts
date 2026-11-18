import test from 'node:test';
import assert from 'node:assert/strict';
import {courrierStatusLabel,courrierCycleStatuses,matchesCourrierStatus} from '../src/utils/courrierStatus.ts';
test('five business stages are displayed in order',()=>{
 assert.deepEqual(courrierCycleStatuses.map(courrierStatusLabel),['En attente d’orientation','Orienté','En traitement','Traité','Archivé']);
});
test('historical orientation codes remain searchable in the oriented stage',()=>{
 for(const status of ['ASSIGNE','ORIENTE_DG','ORIENTE_DIRECTEUR']){assert.equal(courrierStatusLabel(status),'Orienté');assert.equal(matchesCourrierStatus(status,'ASSIGNE'),true);}
 assert.equal(matchesCourrierStatus('EN_ATTENTE_DG','ENREGISTRE'),true);
 assert.equal(matchesCourrierStatus('EN_TRAITEMENT','ASSIGNE'),false);
 assert.equal(matchesCourrierStatus('ARCHIVE','ALL'),true);
});
