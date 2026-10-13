type Pdfjs = typeof import('pdfjs-dist');

let loading: Promise<Pdfjs> | null = null;
const bytesCache = new Map<string, Promise<Uint8Array>>();

export function pdfAssetBase(): string {
  return new URL('pdfjs/', document.baseURI).href;
}

export function loadPdfjs(): Promise<Pdfjs> {
  if (!loading) {
    loading = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', pdfAssetBase()).href;
      return pdfjs;
    });
  }
  return loading;
}

export function loadPdfBytes(src: string): Promise<Uint8Array> {
  let pending = bytesCache.get(src);
  if (!pending) {
    pending = fetch(src)
      .then(async (res) => {
        if (!res.ok) throw new Error('pdf');
        return new Uint8Array(await res.arrayBuffer());
      })
      .catch((err: unknown) => {
        bytesCache.delete(src);
        throw err;
      });
    bytesCache.set(src, pending);
  }
  return pending;
}
