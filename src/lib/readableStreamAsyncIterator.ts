// Safari / iOS WebKit does not implement async iteration of ReadableStream
// (`for await (const chunk of stream)`). pdf.js's `page.getTextContent()`
// relies on it, and even the legacy build doesn't polyfill it, so on iPad it
// throws "TypeError: undefined is not a function (near '...s of t...')".

type AsyncIterableStream<R> = ReadableStream<R> & {
  values?: (options?: { preventCancel?: boolean }) => AsyncIterableIterator<R>;
  [Symbol.asyncIterator]?: () => AsyncIterableIterator<R>;
};

function streamValues<R>(
  this: ReadableStream<R>,
  options?: { preventCancel?: boolean }
): AsyncIterableIterator<R> {
  const reader = this.getReader();
  const preventCancel = Boolean(options?.preventCancel);
  return {
    async next() {
      try {
        const result = await reader.read();
        if (result.done) reader.releaseLock();
        return result as IteratorResult<R>;
      } catch (err) {
        reader.releaseLock();
        throw err;
      }
    },
    async return(value?: unknown) {
      if (!preventCancel) {
        const cancelled = reader.cancel(value);
        reader.releaseLock();
        await cancelled;
      } else {
        reader.releaseLock();
      }
      return { done: true, value: value as R };
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

if (typeof ReadableStream !== "undefined") {
  const proto = ReadableStream.prototype as AsyncIterableStream<unknown>;
  if (typeof proto[Symbol.asyncIterator] !== "function") {
    Object.defineProperty(proto, "values", {
      value: streamValues,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(proto, Symbol.asyncIterator, {
      value: streamValues,
      writable: true,
      configurable: true,
    });
  }
}

export {};
