# Frontend Design Skill

This skill defines the design language and technical standards for the 'yujian-presence' project.

## Tech Stack
- React (TSX)
- Tailwind CSS
- Lucide React (Icons)
- Framer Motion (Animations)

## Design Principles
1. **Glassmorphism**: Use `backdrop-blur-md` and semi-transparent backgrounds (`bg-surface/80`).
2. **Interactive**: Every clickable element MUST have `cursor-pointer` and a hover state.
3. **Responsive**: Use a mobile-first approach with grid and flexbox.
4. **Consistency**: Use the defined color palette in `constants.ts`.

## Componentization Rules
1. **Atomicity**: Break complex views into small, reusable components in `src/components/`.
2. **Separation of Concerns**: Keep business logic in `App.tsx` or custom hooks, and presentation in components.
3. **TypeScript**: Always use strict typing for props and state.

## UI Elements Reference
- **Primary Color**: `#00ff99` (Emerald)
- **Background**: `#0a0a0b`
- **Surface**: `#161618`
- **Text**: `#e1e1e6`
