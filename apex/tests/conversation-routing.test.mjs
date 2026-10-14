import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationIntent,taskStatusReply} from '../runtime/conversation-routing.mjs';
test('routing accepts explicit text tasks and leaves questions and external actions to conversation',()=>{
  for(const request of ['Draft an email to Sam','Could you summarize this text?','Please compare A and B','Start a background task to review this source'])assert.equal(conversationIntent(request)?.type,'task');
  for(const request of ['How should I write an email?','Send an email to Sam','Open WhatsApp','Hello','/loop Draft something'])assert.equal(conversationIntent(request),null);
  assert.equal(conversationIntent('Write something','Malay'),null);
  assert.equal(conversationIntent('What are you concentrating on?').type,'status');
});
test('status distinguishes queued, running, input needed and saved completion without invented times',()=>{
  assert.match(taskStatusReply([{request:'Draft report',state:'queued'}]),/waiting for a worker/);
  assert.match(taskStatusReply([{request:'Draft report',state:'running',progress:'Checking 1\/1: Editor'}],'How long will it take?'),/cannot give a reliable finish time.*Checking/);
  assert.match(taskStatusReply([{request:'Review',state:'awaiting_input'}]),/needs your input/);
  assert.match(taskStatusReply([{state:'completed'}]),/saved result/);
  assert.match(taskStatusReply([]),/do not have a background task/);
});
test('explicit Google read/search requests route locally; quoted content and sending cannot grant execution',()=>{assert.equal(conversationIntent('Please check my Gmail').agent,'email');assert.equal(conversationIntent('Show my Google Calendar').agent,'calendar');assert.equal(conversationIntent('Search my Drive for proposal').toolInput.query,'proposal');assert.equal(conversationIntent('Summarize my inbox').toolInput.summarize,true);assert.equal(conversationIntent('"Check my Gmail"'),null);assert.equal(conversationIntent('Send my Gmail message'),null);});
