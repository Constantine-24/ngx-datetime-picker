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

// Matches the tool only in command position: at the start of the command or after a
// separator (`;`, `&&`, `||`, `|`, `(`, `$(`, newline), optionally behind `npx`. Plain prose
// such as Markdown inside a heredoc (`block raw \`eslint\``) must not trigger it.
const commandPosition = (tool) =>
  new RegExp(String.raw`(?:^|[;&|(\n]|\$\()\s*(?:npx\s+)?${tool}(?=\s|$|[;&|)])`);

const BLOCKED = [
  {
    pattern: commandPosition('eslint'),
    message:
      'Direct `eslint` invocations are blocked. Use `npm run lint` or `npx ng lint <project>` so the Angular CLI loads the project ESLint config.',
  },
  {
    pattern: commandPosition('vitest'),
    message:
      'Direct `vitest` invocations are blocked. Use `npx ng test <project> --include <path> --watch=false` (see .claude/rules/commands.md) so the Angular CLI builds the test environment.',
  },
];

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

  // Package-management commands may mention the tools by name (e.g. `npm install eslint`).
  if (/\bnpm\s+(install|i|uninstall|remove|update|outdated|ls|view|explain)\b/.test(command)) {
    process.exit(0);
  }

  for (const { pattern, message } of BLOCKED) {
    if (pattern.test(command)) {
      process.stderr.write(`${message}\n`);
      process.exit(2);
    }
  }

  process.exit(0);
});
