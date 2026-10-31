import test from 'node:test';
import assert from 'node:assert/strict';
import { containsSecret } from '../scripts/verify-release.mjs';
test('credential detection catches representative key formats without printing them',()=>{
  assert.equal(containsSecret('sk-'+'a'.repeat(40)),true);
  assert.equal(containsSecret('ghp_'+'a'.repeat(40)),true);
  assert.equal(containsSecret('github_pat_'+'a'.repeat(40)),true);
  assert.equal(containsSecret('OPENAI_API_KEY=replace-with-your-key'),false);
  assert.equal(containsSecret('unit-test-placeholder'),false);
});
