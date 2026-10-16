# TypeScript & Code Style

Formatting is Prettier (`.prettierrc`: 100 columns, single quotes, Angular HTML parser) and is applied automatically to edited files by the PostToolUse hook. Linting is angular-eslint + typescript-eslint (`eslint.config.js`, plus the library override in `projects/ngx-datetime-picker/eslint.config.js`).

<important if="you are writing or modifying TypeScript code">

- Strict typing. Prefer inference when the type is obvious.
- Never use `any` — use `unknown` and narrow. When a spec has to reach a `protected` member, cast to a small local interface describing exactly those members (see `DateTimeRangeInternals` in `ngx-dt-picker.spec.ts`), not `as any`.
- Where the single-generic picker has to bridge adapter types (calendar speaks `PlainDate`, panel speaks `PlainTime`, value is `PlainDateTime`), use a documented `as unknown as D` cast at that one seam — never `any`, never `$any()` in templates.
- Don't use `enum` — use union types or `as const` objects.
- Prefer `interface` for object shapes and `readonly` for data that should not change.
- Use descriptive names; no single-letter names outside tiny lambdas and loop indices.
- Comments and identifiers are in English.
- Use `T[]`, not `Array<T>` (lint-enforced).
- Follow the visibility convention of the file you're in: members bound only from the template are `protected`, internal members are `private`, and the public API is explicitly documented.
  </important>

<important if="you are adding or modifying properties on exported interfaces, types, inputs, or outputs">

- Search for every usage and keep backwards compatibility: new properties are optional and new inputs have defaults matching the old behaviour.
- A changed default or a narrowed type is a breaking change — see `.claude/rules/architecture.md` and `.claude/rules/release.md`.
  </important>

<important if="you are writing code comments, TSDoc, or documentation in source files">

- Every exported class, function, input, output, model and token has TSDoc. It ships in the `.d.ts` files and is what consumers see in their IDE, so describe behaviour, defaults and units, not implementation.
- Inline comments explain _why_ (a constraint, a pinned Material internal, a browser quirk), not _what_.
- Don't state counts ("all four inputs…") in comments; they go stale. Name the command that produces the count, or cite `file:line`.
  </important>
