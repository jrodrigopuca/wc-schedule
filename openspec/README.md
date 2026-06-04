# openspec/

Spec-Driven Development (SDD) artifact store for **wc-schedule**.

## Layout

```
openspec/
├── config.yaml         # SDD configuration (mode, paths, stack)
├── conventions.md      # Architectural & coding conventions (read first)
├── README.md           # This file
├── changes/            # In-flight changes (one folder per change-name)
│   └── <change-name>/
│       ├── proposal.md
│       ├── specs/
│       ├── design.md
│       └── tasks.md
└── specs/              # Durable, archived capability specs
    └── <capability>.md
```

## Workflow

```
proposal → specs ──→ tasks → apply → verify → archive
              ↕
           design
```

- `specs` and `design` may be authored in parallel.
- `tasks` requires BOTH `specs` and `design`.
- `verify` is recommended before `archive`.

## Commands (orchestrator)

| Command                       | Purpose                                       |
| ----------------------------- | --------------------------------------------- |
| `/sdd-new <change-name>`      | Start a new change (creates the proposal)     |
| `/sdd-continue [change-name]` | Create the next artifact in the chain         |
| `/sdd-ff [change-name]`       | Fast-forward all planning artifacts at once   |
| `/sdd-apply [change-name]`    | Implement the tasks                           |
| `/sdd-verify [change-name]`   | Validate the implementation                   |
| `/sdd-archive [change-name]`  | Move durable specs into `openspec/specs/` and close the change |

## Status

- Project bootstrapped: yes
- First change proposed: not yet (run `/sdd-new <change-name>`)
