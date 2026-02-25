import fs from "fs";
import path from "path";
import { getEmbedding } from "./embed";
import { VectorStore } from "./vectorData";

async function main() {
  const store = new VectorStore();
  const dataDir = path.join(__dirname, "../data");

  const files = fs.readdirSync(dataDir);

  for (const file of files) {
    const content = fs.readFileSync(path.join(dataDir, file), "utf-8");

    const embedding = await getEmbedding(content);

    store.add({
      content,
      embedding
    });

    console.log(`Indexed: ${file}`);
  }

  // Save to disk
  const storePath = path.join(__dirname, "../vectorStore.json");
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

main();