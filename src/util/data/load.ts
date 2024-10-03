import { EventEmitter } from '../sub';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import path from 'path';

interface LoaderEvents {
  progress: {
    loaded: number;
    total: number;
  };
}

export class DataLoader extends EventEmitter<LoaderEvents> implements PromiseLike<ArrayBuffer> {
  private req: Promise<ArrayBuffer>;

  constructor(src: string | URL, cache?: string) {
    super();
    this.req = this.load(src, cache);
  }

  private async load(src: string | URL, cache?: string): Promise<ArrayBuffer> {
    try {
      // If src is a URL, convert it to a file path
      const filePath = src instanceof URL ? fileURLToPath(src) : src;

      // Check if the path exists and is a file
      try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
          throw new Error(`EISDIR: illegal operation on a directory, read '${filePath}'`);
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          console.error(`File not found: ${filePath}`);
        }
        throw error;
      }

      // If we're here, the file exists and is not a directory
      if (!cache) return this.longLoad(filePath);

      const cacheSrc = await caches.open(cache);
      let res = await cacheSrc.match(filePath);
      if (res) return this.buffer(res);

      await Promise.all((await cacheSrc.keys()).map(k => cacheSrc.delete(k)));
      const result = await this.longLoad(filePath);
      await cacheSrc.put(filePath, new Response(result, {
        headers: {
          'Content-Length': result.byteLength.toString()
        }
      }));
      return result;
    } catch (error: any) {
      console.error('Error in DataLoader:', error);
      throw error;
    }
  } 
  private async longLoad(src: string | URL) {
    return fetch(src).then(async res => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const total = +(res.headers.get('Content-Length') || 0);
      if (total) {
        let loaded = 0;
        const reader = res.body!.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          this.emit('progress', { loaded, total });
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.length;
        }
        const buf = new Uint8Array(loaded);
        loaded = 0;
        for (const chunk of chunks) {
          buf.set(chunk, loaded);
          loaded += chunk.length;
        }
        return buf.buffer;
      } else return this.buffer(res);
    });
  }
  private async buffer(src: Response) {
    const len = +(src.headers.get('Content-Length') || Infinity);
    this.emit('progress', { loaded: 0, total: len });
    const result = await src.arrayBuffer();
    this.emit('progress', { loaded: result.byteLength, total: result.byteLength });
    return result;
  }
  then<F = ArrayBuffer, R = never>(onfulfilled?: ((value: ArrayBuffer) => F | PromiseLike<F>) | undefined | null, onrejected?: ((reason: any) => R | PromiseLike<R>) | undefined | null) {
    return this.req.then(onfulfilled, onrejected);
  }
}