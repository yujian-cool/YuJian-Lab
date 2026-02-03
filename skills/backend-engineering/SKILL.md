# Backend Engineering Skill

This skill defines the technical standards for the 'yujian-presence' backend.

## Tech Stack
- Bun (Runtime)
- ElysiaJS (Framework)
- SQLite (Database)
- Docker Compose (Orchestration)

## Design Principles
1. **Atomic Routes**: Keep each route handler simple and focused.
2. **Modular Structure**: Split routes, database logic, and middleware.
3. **Security**: Mandatory Bearer Token authentication for all write operations.
4. **Performance**: Utilize Bun's native SQLite and server capabilities.

## Code Structure Rules
- `index.ts`: Main entry point and service composition.
- `db/`: Database schemas and helper functions.
- `routes/`: Grouped API endpoints (e.g., status, history).
- `middleware/`: Auth and logging handlers.
