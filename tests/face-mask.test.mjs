import test from 'node:test';
import assert from 'node:assert/strict';
import {smoothEyes,eyeGeometry} from '../src/faceMaskGeometry.mjs';
test('eye tracking accepts normalized coordinates, rejects invalid or missing results',()=>{
 assert.deepEqual(smoothEyes(null,[.3,.4,.7,.4]),[.3,.4,.7,.4]);
 assert.equal(smoothEyes(null,null),null);
 assert.equal(smoothEyes(null,[0,1,2,NaN]),null);
 assert.deepEqual(smoothEyes([0,0,0,0],[1,1,1,1],.5),[.5,.5,.5,.5]);
});
test('canvas geometry preserves eye position, tilt and distance',()=>{
 const g=eyeGeometry([.25,.25,.75,.5],400,200);
 assert.deepEqual([g.x1,g.y1,g.x2,g.y2],[100,50,300,100]);
 assert.equal(g.angle,Math.atan2(50,200));
 assert.equal(eyeGeometry([.5,.5,.5,.5],400,200),null);
});
