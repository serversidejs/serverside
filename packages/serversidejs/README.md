# serverside

A lightweight component-based framework for server-side rendering with Bun.

## Installation

```bash
bun add @serversidejs/serverside
```

## Quick Start

1. Create a new project:
```bash
mkdir my-app
cd my-app
bun init
```

2. Install the framework:
```bash
bun add @serversidejs/serverside
```

3. Create your first component (`src/routes/index.comp`):
```html
<script side="server">
  return {
    title: "Welcome",
    message: "Hello from serverside.js!"
  };
</script>

<div>
  <h1>{title}</h1>
  <p>{message}</p>
</div>
```

4. Create your server (`src/index.ts`):
```typescript
import { ServerSide } from 'serverside.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = new ServerSide({
  port: 3000,
  paths: {
    routes: 'routes',
    api: 'api',
    public: 'public'
  },
  baseDir: __dirname
});

await server.serve();
```

5. Run your app:
```bash
bun run src/index.ts
```

## Features

- 🚀 Server-side rendering
- 📦 Component-based architecture
- 🎨 Built-in CSS support
- 🔄 Layout system with inheritance
- 🔌 API routes support
- 📁 Static file serving
- 🔒 Middleware system

## Project Structure

```
my-app/
├── src/
│   ├── routes/           # Your components
│   │   ├── _layout.comp  # Main layout
│   │   └── index.comp    # Home page
│   ├── api/             # API routes
│   │   └── posts/
│   │       └── index.js
│   ├── public/          # Static files
│   │   └── styles.css
│   └── index.ts         # Server entry
└── package.json
```

## Component Syntax

Components use a simple `.comp` format:

```html
<script side="server">
  // Server-side code
  return {
    title: "My Page",
    data: await fetchData()
  };
</script>

<div>
  <h1>{title}</h1>
  <div>{data}</div>
</div>

<style>
  div {
    color: blue;
  }
</style>
```

## Layout System

Layouts can be inherited or reset:

- `_layout.comp` - Inherits from parent layout
- `_layout@.comp` - Resets layout chain

## API Routes

Create API endpoints in the `api` directory:

```javascript
export default class PostsAPI {
  getMiddlewares() {
    return {
      '*': [authBasic()],
      post: [authBasic()]
    };
  }

  async handleGET(data) {
    return {
      posts: [
        { id: 1, title: 'First Post' }
      ]
    };
  }
}
```

## License

MIT
