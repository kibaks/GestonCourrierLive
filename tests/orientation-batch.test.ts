import test from 'node:test';
import assert from 'node:assert/strict';
import {executeOrientationBatch,orientationResultMessage,resolveOrientationSubmission} from '../src/services/orientationBatch.ts';
const options={requiresDgAnnotation:false,targets:[{id:'dg',nom:'DG',role:'DIRECTEUR_GENERAL'}],instructions:[]};
test('uses the active circuit target instead of a director inferred from the recipient text',()=>{
  assert.deepEqual(resolveOrientationSubmission(options),{assigneA:'dg'});
  assert.throws(()=>resolveOrientationSubmission(options,'director'),/étape autorisée/);
});
test('manual choice is honored only among authorized targets',()=>{
  const choices={...options,targets:[...options.targets,{id:'other',nom:'Responsable',role:'DIRECTEUR'}]};
  assert.equal(resolveOrientationSubmission(choices,'other').assigneA,'other');
  assert.throws(()=>resolveOrientationSubmission(choices),/Choisissez/);
});
test('does not send without the required DG instruction',()=>{
  const instruction={...options,requiresDgAnnotation:true,instructions:[{id:'note',contenu:'Instruction du DG'}]};
  assert.throws(()=>resolveOrientationSubmission(instruction),/instruction du DG/);
  assert.deepEqual(resolveOrientationSubmission(instruction,'dg','note'),{assigneA:'dg',dgAnnotationId:'note'});
});
test('an API rejection stays an error with its reason, not a zero-success alert',async()=>{
  const result=await executeOrientationBatch(['mail'],async()=>{throw new Error('Orientation non autorisée');});
  assert.equal(result.doneIds.length,0);assert.equal(result.errors.length,1);
  const message=orientationResultMessage(result,()=> 'INT-2026-0006');
  assert.equal(message.type,'error');assert.match(message.message,/INT-2026-0006 : Orientation non autorisée/);
});
test('mixed batches retain failed IDs and count only successful API responses',async()=>{
  const progress:number[]=[];const sent:string[]=[];
  const result=await executeOrientationBatch(['one','two','three'],async id=>{sent.push(id);if(id==='two')throw new Error('Étape précédente à terminer');},n=>progress.push(n));
  assert.deepEqual(sent,['one','two','three']);assert.deepEqual(result.doneIds,['one','three']);assert.deepEqual(result.errors.map(e=>e.id),['two']);
  assert.equal(orientationResultMessage(result,id=>id).type,'error');assert.deepEqual(progress,[33,67,100]);
});
test('a fully successful batch is the only success alert',async()=>{
  const result=await executeOrientationBatch(['one','two'],async()=>({id:'assignment'}));
  assert.equal(orientationResultMessage(result,id=>id).type,'success');assert.equal(result.doneIds.length,2);
  assert.equal(orientationResultMessage({doneIds:[],errors:[]},id=>id).type,'error');
});

test('empty targets show the actual workflow reason',()=>{
  assert.throws(()=>resolveOrientationSubmission({...options,targets:[],blockedReason:'Ce courrier est déjà traité.'}),/déjà traité/);
});
