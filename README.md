# ChatClient

A modern, beautiful web-based chat interface designed to connect with any OpenAI-API compatible backend (e.g., LocalAI, vLLM, or custom Rust servers).

## Features

- **Modern UI**: Clean, responsive design with Light/Dark mode support.
- **Code Highlighting**: Full Markdown support with syntax highlighting for code blocks.
- **Chain of Thought**: Renders `<think>` tags with collapsible animations.
- **Context Caching**: Option to send `session_id` to the backend to enable stateful context caching.
- **File Uploads**: Upload source code or text files to provide context to the LLM.
- **Chat Management**: Persistent chat history, auto-titling (optional), and session management.
- **Configurable**: Adjust sampling parameters (Temperature, Top-P, Top-K) and System Prompts.
- **Universal Backend**: Connects to any server supporting the OpenAI Chat Completions API.

## Prerequisites

- **Node.js** (v16 or higher)
- **npm** (included with Node.js)
- A running backend server that provides an OpenAI-compatible API.

## Installation

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

## Running Locally

To start the development server:

```bash
npm run dev
```

This will start the UI at `http://localhost:5173`.

## Building for Production

To create a production-ready build (static HTML/JS/CSS):

```bash
npm run build
```

The output files will be in the `dist/` directory.

## Configuration

### Connecting to a Local Server

1. Click the **Settings** (Gear icon) in the sidebar.
2. In the **Backend Settings** section, enter your server URL (Default: `http://localhost:8000/v1/`).
3. **Context Caching**: Enable this to send the `session_id` with every request, allowing backends like vLLM to cache the session context.
4. **Auto-Generate Titles**: Enable this if you want the bot to summarize the conversation title after the first message.

### CORS Configuration

If you are running a local backend, you must enable **CORS** to allow the browser to communicate with your API.

**For Rust (Axum):**
```rust
let cors = CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any);
let app = Router::new().route("/v1/chat/completions", post(chat_completion)).layer(cors);
```

**For vLLM:**
Run with: `--cors-allow-origins '*'`

## License

MIT