import { createHash } from 'node:crypto';

export const EMBED_MODEL =
  process.env.WAKABA_EMBED_MODEL ?? 'qwen3-embedding:4b';
export const EMBED_DIM = Number(process.env.WAKABA_EMBED_DIM ?? 2560);

export function createEncoder(): Encoder {
  return process.env.WAKABA_ENCODER === 'fake'
    ? new FakeEncoder()
    : new OllamaEncoder();
}

export interface Encoder {
  readonly model: string;
  encode(texts: string[]): Promise<number[][]>;
}

export class OllamaEncoder implements Encoder {
  readonly model = EMBED_MODEL;

  constructor(
    private baseUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434',
  ) {}

  async encode(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: texts }),
    });

    if (!res.ok) {
      throw new Error(
        `Ollama /api/embed: HTTP ${res.status}. Запущен ли Ollama (brew services start ollama)` +
          ` и скачана ли модель (ollama pull ${this.model})?`,
      );
    }

    const data = (await res.json()) as { embeddings: number[][] };
    const dim = data.embeddings[0]?.length ?? 0;

    if (dim !== EMBED_DIM) {
      throw new Error(
        `Модель вернула размерность ${dim}, ожидалось ${EMBED_DIM}.`,
      );
    }

    return data.embeddings;
  }
}

export class FakeEncoder implements Encoder {
  readonly model = 'fake-encoder-for-tests';

  encode(texts: string[]): Promise<number[][]> {
    return Promise.resolve(
      texts.map((t) => {
        const out: number[] = [];

        let seed = createHash('sha256').update(t).digest();

        while (out.length < EMBED_DIM) {
          for (const byte of seed) {
            if (out.length >= EMBED_DIM) {
              break;
            }

            out.push(byte / 255 - 0.5);
          }

          seed = createHash('sha256').update(seed).digest();
        }

        return out;
      }),
    );
  }
}
