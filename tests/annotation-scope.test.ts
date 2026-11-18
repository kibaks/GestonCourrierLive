import test from 'node:test';
import assert from 'node:assert/strict';
import {annotationsForContext} from '../src/utils/annotationScope.ts';
const rows=[
 {id:'a',courrierId:'letter-a',fichierId:'principal',contenu:'Instruction DG pour A'},
 {id:'b',courrierId:'letter-b',fichierId:'principal',contenu:'Instruction DG pour B'},
 {id:'c',courrierId:'letter-b',fichierId:'annexe',contenu:'Annotation de l’annexe'},
 {id:'d',courrierId:'letter-b',contenu:'Note générale de B'},
];
test('navigating to another courrier excludes a late response or saved session from the previous courrier',()=>{
 assert.deepEqual(annotationsForContext(rows,'letter-b').map(a=>a.id),['b','c','d']);
 assert.deepEqual(annotationsForContext(rows,'letter-without-annotations'),[]);
});
test('documents sharing a generic file identifier cannot share annotations across courriers',()=>{
 assert.deepEqual(annotationsForContext(rows,'letter-b','principal').map(a=>a.id),['b']);
 assert.deepEqual(annotationsForContext(rows,'letter-a','principal').map(a=>a.id),['a']);
});
test('document annotations and general notes retain their own scope without deleting data',()=>{
 assert.deepEqual(annotationsForContext(rows,'letter-b','annexe').map(a=>a.id),['c']);
 assert.equal(rows.length,4);
});
