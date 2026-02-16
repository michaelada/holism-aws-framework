---
name: commit-message
description: Generates clear conventional commit messages from git diffs.
---

# Generating Commit Messages

## Diff selection

1. If there are staged changes, run:
   git diff --staged
2. Else if there are unstaged changes, run:
   git diff
3. Else:
   Respond: "No changes detected."

If both staged and unstaged changes exist, prefer staged changes.
Do not mix staged and unstaged diffs in a single commit message.

## Instructions

Generate a Conventional Commit message based on the selected diff.

## Output format

Return only the commit message text.

1. Simple change:
   type(scope): short summary

2. Complex change:
   type(scope): short summary

   - Key change 1
   - Key change 2
   - Key change 3

Do not:
- Wrap the message in Markdown code fences
- Add explanations or prefixes (e.g. "Suggested commit message:")
- Include surrounding quotes

## Allowed types

feat, fix, refactor, perf, docs, test, chore, ci, build

## Scope inference

- Derive scope from the main module, package, or top-level directory
- Omit scope if multiple areas are touched
- Use lower-case kebab-case for scopes (e.g. user-profile, portal-ui)
- Avoid full package names or file paths

## Type selection priority

feat > fix > perf > refactor > docs > test > chore > ci > build

## Summary guidelines

- Be specific and concise
- Describe the observable change, not implementation details
- Avoid vague terms like "update", "improve", or "fix stuff"
- Prefer: "add OAuth2 login flow" over "update authentication"

## Granularity

If the diff contains multiple unrelated logical changes:
- Choose the dominant change for the summary
- Use bullet points to describe secondary changes

## Refactor vs feat/fix

- Use `refactor` for behaviour-preserving structural changes
- Use `feat` or `fix` only if observable behaviour changes

## Docs classification

- Use `docs` only when documentation content changes
- Use `chore` for tooling, formatting, or maintenance changes with no runtime impact

## When to include a body

Include bullet points if:
- Multiple logical changes are present
- Behaviour or API changes
- Non-obvious rationale
- Large cross-module refactors

## Breaking changes

If public interfaces or APIs change:
- Use `type!`
- Add:
  BREAKING CHANGE: <description>

## Audience

Assume the reader is a future developer unfamiliar with the context.
The message should be understandable without opening the diff.

## Best practices

- Use present tense
- Explain what and why, not how
- Keep summary under 72 characters