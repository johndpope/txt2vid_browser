import { InferenceSession, Tensor, env, Env } from 'onnxruntime-web';

console.log('Worker script started');
console.log('Initial env configuration:', JSON.stringify(env, null, 2));

env.webgl.pack = true;
env.webgl.async = true;

console.log('Updated env configuration:', JSON.stringify(env, null, 2));

const worker = (self as unknown) as {
  addEventListener: (
    type: 'message',
    listener: (e: MessageEvent) => void
  ) => void;
  postMessage: (data: unknown, transfer?: Transferable[]) => void;
};

let modelProm: Promise<InferenceSession> | null = null;

type WorkerTensor = { data: Tensor['data']; dims: number[] };

worker.addEventListener('message', async (evt) => {
  console.log('Worker received message:', evt.data);

  if (!modelProm) {
    console.log('Initializing model');
    const [type, buf, wasmPaths] = evt.data as [string, ArrayBuffer, Env.WebAssemblyFlags['wasmPaths']];
    console.log('Execution provider:', type);
    console.log('WASM paths:', JSON.stringify(wasmPaths, null, 2));
    
    env.wasm.wasmPaths = wasmPaths;
    modelProm = InferenceSession.create(buf, {
      executionProviders: [type]
    });
    console.log('Model creation promise initiated');
  } else {
    console.log('Processing inference request');
    const { id, data } = evt.data as {
      id: number;
      data: Record<string, WorkerTensor>;
      env: Partial<Env>;
    };
    console.log('Request ID:', id);
    console.log('Input data keys:', Object.keys(data));

    const model = await modelProm;
    console.log('Model loaded successfully');

    const inputs: Record<string, Tensor> = {};
    for (const rawIn in data) {
      const dat = data[rawIn];
      console.log(`Creating tensor for ${rawIn}. Dims:`, dat.dims);
      // inputs[rawIn] = new Tensor(dat.data, dat.dims);
      if (rawIn === 'mel' && dat.dims.length === 3) {
        // Add batch dimension for mel input if it's missing
        inputs[rawIn] = new Tensor(dat.data, [1, ...dat.dims]);
        console.log(`🌻 adding dimension`);
      } else {
        inputs[rawIn] = new Tensor(dat.data, dat.dims);
      }
    }

    console.log('Running model with inputs inputs:',inputs);
    const outputs = await model.run(inputs);
    console.log('Model execution completed');
    console.log('Output keys:', Object.keys(outputs));

    for (const key in outputs) {
      console.log(`Output ${key} shape:`, outputs[key].dims);
    }

    console.log('Posting message back to main script');
    worker.postMessage(
      { id, data: outputs },
      Object.values(outputs).map((o) => (o.data as ArrayBufferView).buffer)
    );
    console.log('Message posted successfully');
  }
});

console.log('Worker event listener setup complete');