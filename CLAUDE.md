# Project Structure

This repository contains two separate Next.js applications:

## Main App (`/`)
The production recipe viewer application deployed to users.
- **App directory**: `/app`
- **Components**: `/components`
- **Lib/utilities**: `/lib`
- **Types**: `/lib/types.ts`
- **Data**: `/data`

## Recipe Data Viewer (`/other-data/viewer`)
A separate development tool for viewing and regenerating recipe data. This is NOT the production app.
- **App directory**: `/other-data/viewer/src/app`
- **Components**: `/other-data/viewer/src/components`
- **Types**: `/other-data/viewer/src/types/recipe.ts`

## Key Differences
| Feature | Main App | other-data/viewer |
|---------|----------|-------------------|
| Purpose | Production user-facing | Development/data tooling |
| Instruction type | `step`, `text`, `timestamp_seconds` | Includes `measurements`, `notes` fields |
| Recipe regeneration | Not supported | Has AI regeneration API |

## When editing
- **User-facing features**: Edit files in `/app`, `/components`, `/lib`
- **Data processing tools**: Edit files in `/other-data/viewer`
- The `/other-data` folder is excluded from the main app's TypeScript build
