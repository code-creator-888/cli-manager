# CLI Manager

A desktop application for managing Claude CLI and Copilot CLI tools.

## Features

- **Terminal Integration**: Interactive terminal sessions for both Claude CLI and Copilot CLI
- **Status Monitoring**: Real-time monitoring of CLI status, version, and resource usage
- **Configuration Management**: Easy configuration editing and environment variable management
- **History Tracking**: SQLite-based command history with search and favorites

## Tech Stack

- Electron 28+
- React 18 + TypeScript
- Vite 5
- xterm.js + node-pty
- TailwindCSS
- Zustand
- better-sqlite3

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Package for distribution
npm run package
```

## Project Structure

```
cli-manager/
├── electron/           # Electron main process
│   ├── main.ts        # Main process entry
│   ├── preload.ts     # Preload script (IPC bridge)
│   └── services/      # Backend services
├── src/               # React frontend
│   ├── components/    # UI components
│   ├── hooks/         # Custom hooks
│   ├── stores/        # Zustand stores
│   ├── types/         # TypeScript types
│   └── utils/         # Utility functions
└── assets/            # Static assets
```

## License

MIT
