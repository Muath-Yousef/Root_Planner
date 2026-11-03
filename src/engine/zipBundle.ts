import type { GeneratedFile } from './generators';
/** Thin wrapper over jszip (loaded on demand so it is not in the first paint). Paths are written exactly as planned. */
export async function zipBundle(files: GeneratedFile[]): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const f of files) zip.file(f.path, f.content);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
