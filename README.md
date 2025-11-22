
# RustLike Chat UI

A modern, beautiful web-based chat interface designed to connect with any OpenAI-API compatible backend (e.g., LocalAI, vLLM, or custom Rust servers).

## Features

- **Modern UI**: Clean, responsive design with Light/Dark mode support.
- **Code Highlighting**: Full Markdown support with syntax highlighting for code blocks.
- **File Uploads**: Upload source code or text files to provide context to the LLM.
- **Chat Management**: Persistent chat history, auto-titling, and session management.
- **Configurable**: Adjust sampling parameters (Temperature, Top-P, Top-K) and System Prompts.
- **Universal Backend**: Connects to any server supporting the OpenAI Chat Completions API.

## Prerequisites

- **Node.js** (v16 or higher)
- **npm** (included with Node.js)
- A running backend server (e.g., a Rust crate running vLLM or Axum) that provides an OpenAI-compatible API.

## Installation

1. Clone the repository or download the source files.
2. Open a terminal in the project directory.
3. Install dependencies:

```bash
npm install
```

## Running Locally

To start the development server:

```bash
npm run dev
```

This will start the UI at `http://localhost:5173`. Open this URL in your browser.

## Building for Production

To create a production-ready build (static HTML/JS/CSS):

```bash
npm run build
```

The output files will be in the `dist/` directory. You can serve these files using any static file server, or embed them directly into your Rust binary using libraries like `rust-embed`.

## Configuration

### Connecting to a Local Server

1. Click the **Settings** (Gear icon) in the bottom left of the sidebar.
2. In the **Backend Settings** section, enter your server URL.
   - **Default**: `http://localhost:8000/v1/`
   - **Note**: Ensure your server is running and accessible.
3. **API Key**: If your local server does not require a key, you can leave this blank.
4. **Model**: Select a model from the list or type the specific model name your backend expects.

### CORS Configuration (Important)

If you are running a local backend (e.g., in Rust or Python), you must enable **CORS (Cross-Origin Resource Sharing)** to allow the browser to communicate with your API.

**For a Rust (Axum) Backend:**

Ensure you apply the CORS layer to **all** routes:

```rust
let cors = CorsLayer::new()
    .allow_origin(Any)
    .allow_methods(Any)
    .allow_headers(Any);

let app = Router::new()
    .route("/v1/chat/completions", post(chat_completion))
    .layer(cors); // Apply layer at the end
```

**For vLLM:**

Run with the flag: `--cors-allow-origins '*'`

## Usage

1. **New Chat**: Click "New Chat" in the sidebar.
2. **Send Message**: Type in the input box and hit Enter.
3. **Upload Files**: Click the paperclip icon to attach text-based files (code, logs, etc.) to the conversation context.
4. **Redo**: If you aren't happy with the bot's response, hover over the message and click "Redo".
5. **Revise**: Click "Revise" on your own message to edit and resend.

## License

MIT
