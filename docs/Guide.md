# ts-rag: A Local RAG Application Guide

This document walks through every step, concept, and decision in this project.

---

## Table of Contents

1. [What is RAG?](#1-what-is-rag)
2. [Core Concepts](#2-core-concepts)
3. [Project Architecture](#3-project-architecture)
4. [Setup & Configuration](#4-setup--configuration)
5. [Step-by-Step Flow](#5-step-by-step-flow)
6. [Implementation Details](#6-implementation-details)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. What is RAG?

**RAG (Retrieval Augmented Generation)** is a pattern that combines:

1. **Retrieval** – Find relevant documents from your data based on the user's question
2. **Augmentation** – Inject those documents as context into a prompt
3. **Generation** – Use an LLM to generate an answer grounded in that context

Instead of asking an LLM to answer from its training data alone, you give it *your* documents. This reduces hallucinations and keeps answers factual and up-to-date.

```
User Question → Find similar docs → Build prompt with context → LLM generates answer
```

---

## 2. Core Concepts

### Embeddings

An **embedding** is a numeric vector (array of numbers) that represents the *meaning* of text. Similar texts have similar embeddings.

- **Example**: "How do I log in?" and "What's the authentication flow?" have similar embeddings
- **Dimensions**: Typically 256–1536 numbers depending on the model (e.g., nomic-embed-text uses 768)
- **Use**: We compare embeddings to find semantically similar content, not just keyword matches

### Vector Similarity (Cosine Similarity)

To find "similar" documents, we compare their embedding vectors. **Cosine similarity** measures the angle between two vectors:

- **1.0** = identical direction (most similar)
- **0.0** = orthogonal (unrelated)
- **-1.0** = opposite direction

Formula: `cos(θ) = (A · B) / (||A|| × ||B||)`  
Where `·` is dot product and `||...||` is the vector length (norm).

### Vector Store

A **vector store** holds documents and their embeddings. When you query, it:

1. Embeds your question
2. Compares it to all stored embeddings
3. Returns the top-K most similar documents

This project uses a simple in-memory store that we persist to JSON. Production systems often use specialized databases (Pinecone, Chroma, pgvector, etc.).

---

## 3. Project Architecture

```
ts-rag/
├── data/                 # Source documents (plain text)
│   └── doc1.txt
├── src/
│   ├── embed.ts          # Calls Ollama to get embeddings
│   ├── vectorStore.ts   # Stores items, computes similarity, searches
│   ├── indexDocs.ts     # Indexes data/ → vectorStore.json
│   └── query.ts         # Interactive Q&A using RAG
├── vectorStore.json      # Persisted index (created by indexDocs)
├── package.json
├── tsconfig.json
└── docs/
    └── GUIDE.md         # This file
```

### Component Roles

| File | Purpose |
|------|---------|
| `embed.ts` | Sends text to Ollama's embedding API, returns `number[]` |
| `vectorStore.ts` | `VectorStore` class: add items, cosine similarity, top-K search |
| `indexDocs.ts` | Reads `data/`, embeds each file, saves to `vectorStore.json` |
| `query.ts` | Loads store, embeds question, retrieves context, calls LLM, prints answer |

---

## 4. Setup & Configuration

### Dependencies

- **axios** – HTTP client for Ollama API
- **typescript** – Type checking and compilation
- **ts-node** – Run `.ts` files directly
- **@types/node** – TypeScript types for Node.js built-ins (`fs`, `path`, `process`, etc.)

### TypeScript Configuration

Key `tsconfig.json` settings:

| Option | Value | Why |
|--------|-------|-----|
| `module` | `commonjs` | Outputs CommonJS so `ts-node` works without extra flags |
| `verbatimModuleSyntax` | `false` | Allows ESM-style `import`/`export` with CommonJS output |
| `types` | `["node"]` | Enables types for `fs`, `path`, `process`, `readline` |
| `strict` | `true` | Strict type checking |
| `noUncheckedIndexedAccess` | `true` | Array access returns `T \| undefined` |

**Why CommonJS?**  
With `module: "commonjs"`, you can run `npx ts-node src/query.ts` directly. ESM (`"type": "module"`) would require `ts-node --esm` or `tsx`, adding complexity.

### Ollama

This project uses [Ollama](https://ollama.com) as a local API for:

1. **Embeddings** – `nomic-embed-text` model
2. **Generation** – `llama3:8b` model (or any model you configure)

Ollama runs on `http://127.0.0.1:11434`. We use `127.0.0.1` instead of `localhost` because Node.js may resolve `localhost` to IPv6 (`::1`), while Ollama often listens only on IPv4 (`127.0.0.1`), causing `ECONNREFUSED`.

---

## 5. Step-by-Step Flow

### Phase 1: Indexing (`indexDocs.ts`)

```
1. Create empty VectorStore
2. For each file in data/:
   a. Read file content
   b. Call getEmbedding(content) → Ollama returns number[]
   c. store.add({ content, embedding })
3. Write store to vectorStore.json
```

### Phase 2: Querying (`query.ts`)

```
1. Load vectorStore.json
2. Rebuild VectorStore in memory from parsed JSON
3. Prompt user: "Ask a question:"
4. When user types:
   a. queryEmbedding = getEmbedding(question)
   b. results = store.search(queryEmbedding, 2)  // top 2 docs
   c. context = join results' content
   d. Build prompt: "Answer using ONLY this context: ..."
   e. POST to Ollama /api/generate
   f. Print response.data.response
```

### Data Flow Diagram

```
[data/*.txt] ──► [getEmbedding] ──► [VectorStore] ──► [vectorStore.json]
                                                           │
[User question] ──► [getEmbedding] ──► [store.search] ◄────┘
                            │
                            ▼
              [Top-K docs as context] ──► [LLM prompt] ──► [Answer]
```

---

## 6. Implementation Details

### Embedding API (Ollama)

```http
POST http://127.0.0.1:11434/api/embeddings
Content-Type: application/json

{
  "model": "nomic-embed-text",
  "prompt": "Your text here"
}

Response: { "embedding": [0.1, -0.2, ...] }
```

### Cosine Similarity

```typescript
cosineSimilarity(a, b) = dot(a, b) / (norm(a) * norm(b))
```

- **Dot product**: `Σ(a[i] * b[i])`
- **Norm**: `√(Σ(a[i]²))`

Higher score = more similar.

### Generation API (Ollama)

```http
POST http://127.0.0.1:11434/api/generate
Content-Type: application/json

{
  "model": "llama3:8b",
  "prompt": "Answer the question using ONLY the context below.\n\nContext:\n...\n\nQuestion:\n...",
  "stream": false
}

Response: { "response": "The answer text..." }
```

### File Paths

Both scripts use `path.join(__dirname, "../vectorStore.json")` so the store path is relative to the project root regardless of where you run the command from.

---

## 7. Troubleshooting

### `ECONNREFUSED ::1:11434`

**Cause**: Node resolved `localhost` to IPv6 (`::1`), but Ollama listens on IPv4 (`127.0.0.1`).

**Fix**: Use `http://127.0.0.1:11434` in `embed.ts` and `query.ts` (already applied).

### `ENOENT: vectorStore.json`

**Cause**: `query.ts` runs before indexing, or indexing failed (e.g., Ollama not running).

**Fix**:
1. Ensure Ollama is running
2. `ollama pull nomic-embed-text`
3. `npx ts-node src/indexDocs.ts`
4. Then `npx ts-node src/query.ts`

### `address already in use` when running `ollama serve`

**Meaning**: Ollama is already running. You don't need to start it again.

### `ESM syntax not allowed in CommonJS` (historical)

**Cause**: `verbatimModuleSyntax: true` with `module: "commonjs"` – TypeScript preserves ESM syntax but outputs CommonJS, which conflicts.

**Fix**: Set `verbatimModuleSyntax: false` (or switch to ESM and `"type": "module"`).

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `ollama pull nomic-embed-text` | Download embedding model |
| `ollama pull llama3:8b` | Download LLM (if not present) |
| `npx ts-node src/indexDocs.ts` | Index documents → vectorStore.json |
| `npx ts-node src/query.ts` | Interactive RAG Q&A |

---

## Further Reading

- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [RAG overview](https://www.pinecone.io/learn/retrieval-augmented-generation/)
- [Embeddings explained](https://www.pinecone.io/learn/vector-embeddings/)
