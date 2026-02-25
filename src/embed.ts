import axios from "axios";

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await axios.post(
    "http://127.0.0.1:11434/api/embeddings",
    {
      model: "nomic-embed-text",
      prompt: text
    }
  );

  return response.data.embedding;
}