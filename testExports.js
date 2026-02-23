import * as llama from 'node-llama-cpp';

console.log(Object.keys(llama).filter(k => k.toLowerCase().includes('grammar') || k.toLowerCase().includes('format')));
