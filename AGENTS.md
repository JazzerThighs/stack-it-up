# Stack It Up project guide

Work in this repository unless the user requests otherwise. The current game and packing explorer define the rules. Keep refactors separate from gameplay changes.

- Start with [development workflow](docs/DEVELOPMENT.md) for the task-to-test table, owner modules, generators and compatibility rules. Read the relevant section before expanding an investigation.
- Use the [architecture map](docs/ARCHITECTURE.md) for cross-module changes and the [implementation plan](docs/IMPLEMENTATION_PLAN.md) for active milestones. [Maintenance notes](docs/MAINTENANCE_NOTES.md) preserve earlier constraints and candidate work.
- Edit authoritative schemas and sources. Regenerate derived files and build outputs using the repository commands. Preserve saved formats, coordinate conventions and physical-piece identities.
- Run the nearest regression check. Build before focused checks that read release artifacts. Use an actual browser for visual or GPU claims and identify physical-device checks that remain open.
