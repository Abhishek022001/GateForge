import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, stopTestServer } from '../setup/testServer.js';

describe('Taxonomy API Endpoints', () => {
  let baseUrl;

  before(async () => {
    baseUrl = await startTestServer();
  });

  after(async () => {
    await stopTestServer();
  });

  it('GET /api/taxonomy should return complete GATE CS taxonomy', async () => {
    const res = await fetch(`${baseUrl}/api/taxonomy`);
    assert.equal(res.status, 200, 'HTTP status should be 200');

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data, 'data property should exist');

    const { subjects, questionTypes, difficultyLevels, reasoningTypes } = body.data;

    // Subjects
    assert.ok(Array.isArray(subjects), 'subjects should be an array');
    assert.ok(subjects.length >= 10, 'should contain at least 10 core GATE CS subjects');
    assert.ok(subjects.includes('Algorithms'));
    assert.ok(subjects.includes('Data Structures'));
    assert.ok(subjects.includes('Operating Systems'));
    assert.ok(subjects.includes('DBMS'));

    // Question Types
    assert.ok(Array.isArray(questionTypes));
    assert.ok(questionTypes.includes('MCQ'));
    assert.ok(questionTypes.includes('MSQ'));
    assert.ok(questionTypes.includes('NAT'));

    // Difficulty Levels
    assert.ok(Array.isArray(difficultyLevels));
    assert.ok(difficultyLevels.includes('Easy'));
    assert.ok(difficultyLevels.includes('Medium'));
    assert.ok(difficultyLevels.includes('Hard'));

    // Reasoning Types
    assert.ok(Array.isArray(reasoningTypes));
    assert.ok(reasoningTypes.length > 0);
  });
});
