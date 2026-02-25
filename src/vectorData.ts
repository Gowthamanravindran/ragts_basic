export interface VectorItem {
  content: string;
  embedding: number[];
}

export class VectorStore {
  private items: VectorItem[] = [];

  add(item: VectorItem) {
    this.items.push(item);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, val, i) => sum + val * (b[i] ?? 0), 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (normA * normB);
  }

  search(queryEmbedding: number[], topK: number = 2): VectorItem[] {
    const scored = this.items.map(item => ({
      item,
      score: this.cosineSimilarity(queryEmbedding, item.embedding)
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map(s => s.item);
  }
}