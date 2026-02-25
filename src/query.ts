import fs from "fs";
import path from "path";
import axios from "axios";
import readline from "readline";
import { getEmbedding } from "./embed"
import { VectorStore, VectorItem } from "./vectorData";

async function main() {
  const storePath = path.join(__dirname, "../vectorStore.json");
  if (!fs.existsSync(storePath)) {
    console.error(
      "Error: vectorStore.json not found. Run 'npx ts-node src/indexDocs.ts' first (requires Ollama running with nomic-embed-text)."
    );
    process.exit(1);
  }
  const raw = fs.readFileSync(storePath, "utf-8");
  const parsed = JSON.parse(raw);

  const store = new VectorStore();
  parsed.items.forEach((item: any) => store.add(item));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question("Ask a question: ", async (question: string) => {
    const queryEmbedding = await getEmbedding(question);

    const results = store.search(queryEmbedding, 2);

    const context = results.map((r: VectorItem) => r.content).join("\n\n");

    const prompt = `
Answer the question using ONLY the context below.

Context:
${context}

Question:
${question}
`;

    const response = await axios.post(
      "http://127.0.0.1:11434/api/generate",
      {
        model: "llama3:8b",
        prompt,
        stream: false
      }
    );

    console.log("\nAnswer:\n");
    console.log(response.data.response);

    rl.close();
  });
}

main();