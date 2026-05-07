const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('index.html', 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notStrictEqual(start, -1, `${name} should be defined`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0, inStr = false, quote = '', escaped = false, inLineComment = false, inBlockComment = false;
  for (let i = bodyStart; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
    } else if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i++; }
    } else if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) inStr = false;
    } else if (ch === '/' && next === '/') {
      inLineComment = true; i++;
    } else if (ch === '/' && next === '*') {
      inBlockComment = true; i++;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inStr = true; quote = ch;
    } else {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

function runInContext(names, extra = '') {
  const code = names.map(extractFunction).join('\n') + '\n' + extra;
  const context = {
    assert,
    S: {
      assignments: [{
        id: 'a1',
        milestones: [
          { id: 'm1', title: 'first', dueDate: '2026-05-12', done: false },
          { id: 'm2', title: 'second', dueDate: '2026-05-10', done: false },
          { id: 'm3', title: 'third', dueDate: '2026-05-14', done: false },
        ],
      }],
    },
    persist() {},
    renderAssignments() {},
  };
  vm.runInNewContext(code, context);
  return context;
}

runInContext(['moveMilestone'], `
  moveMilestone('a1', 'm2', -1);
  assert.strictEqual(JSON.stringify(S.assignments[0].milestones.map(m => m.id)), '["m2","m1","m3"]');
  moveMilestone('a1', 'm2', -1);
  assert.strictEqual(JSON.stringify(S.assignments[0].milestones.map(m => m.id)), '["m2","m1","m3"]');
  moveMilestone('a1', 'm1', 1);
  assert.strictEqual(JSON.stringify(S.assignments[0].milestones.map(m => m.id)), '["m2","m3","m1"]');
`);

runInContext(['extractFirstJSONObject', 'parseClaudePlanResponse'], `
  const fenced = 'Here is the plan:\\n\`\`\`json\\n{"plan":{"2026-05-07":[{"title":"Read notes","course":"IR","duration":"1h","aiGenerated":true}]}}\\n\`\`\`';
  const parsed = parseClaudePlanResponse(fenced);
  assert.strictEqual(parsed.plan['2026-05-07'][0].title, 'Read notes');

  const recovered = parseClaudePlanResponse('{"plan":{"2026-05-07":[{"title":"A ] bracket","course":"IR"}],"2026-05-08":[{"title":"B"}]');
  assert.strictEqual(recovered.plan['2026-05-07'][0].title, 'A ] bracket');
`);

console.log('plan-milestones tests passed');
