declare module 'write-file-atomic' {
  type Options = { encoding?: BufferEncoding | null; fsync?: boolean };
  function writeFileAtomic(filename: string, data: string | Buffer, options?: Options): Promise<void>;
  export default writeFileAtomic;
}
