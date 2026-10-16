#!/usr/bin/env node
/**
 * PreToolUse hook for Bash.
 * Blocks direct `eslint` / `vitest` invocations. Linting and tests must go through the
 * Angular CLI (`ng lint` / `ng test`, or the npm scripts), which wires up the project config,
 * path aliases, both library entry points and the TestBed environment.
 *
 * Exit codes:
 *   0 — allow
 *   2 — block (stderr is shown to the agent as the reason)
 */

const TOOLS = {
  eslint:
    'Direct `eslint` invocations are blocked. Use `npm run lint` or `npx ng lint <project>` so the Angular CLI loads the project ESLint config.',
  vitest:
    'Direct `vitest` invocations are blocked. Use `npx ng test <project> --include <path> --watch=false` (see .claude/rules/commands.md) so the Angular CLI builds the test environment.',
};

// Prose never runs: drop heredoc bodies and quoted strings before looking for commands, so a
// commit message like "chore(eslint): bump" or Markdown written through a heredoc is ignored.
const stripProse = (command) =>
  command
    .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2[ \t]*(?=\n|$)/g, '')
    .replace(/'[^']*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');

// One simple command per segment: split on `;`, `&&`, `||`, `|`, `&`, newlines and subshells.
const segments = (command) => command.split(/\|\||&&|[;|&\n()`]|\$\(/);

// Leading noise that still executes the tool: env assignments and wrapper commands.
const PREFIX = /^\s*(?:(?:\w+=\S*|time|command|exec|env|nohup)\s+)*/;
// Package runners that resolve a binary, with their flags (`npx -y`, `npm exec --`, `pnpm dlx`).
const RUNNER =
  /^(?:(?:npx|bunx)(?:\s+-\S+)*\s+|npm\s+(?:exec|x)(?:\s+-\S+)*\s+(?:--\s+)?|pnpm\s+(?:exec|dlx)\s+|yarn\s+(?:dlx\s+)?)?/;

const invokedTool = (segment) => {
  const rest = segment.replace(PREFIX, '').replace(RUNNER, '');
  const match = /^(?:\S*\/)?(eslint|vitest)(?:@\S*)?(?=\s|$)/.exec(rest);
  return match ? match[1] : null;
};

let raw = '';
process.stdin.on('data', (chunk) => {
  raw += chunk;
});
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    process.exit(0);
  }
  const command = payload?.tool_input?.command;
  if (typeof command !== 'string' || command.length === 0) {
    process.exit(0);
  }

  for (const segment of segments(stripProse(command))) {
    const tool = invokedTool(segment);
    if (tool) {
      process.stderr.write(`${TOOLS[tool]}\n`);
      process.exit(2);
    }
  }

  process.exit(0);
});
