declare module '*.worker?worker' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

declare module '*.worker?worker&url' {
  const src: string;
  export default src;
}
