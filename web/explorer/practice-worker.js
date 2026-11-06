import {planPracticePath} from './practice-path.js';
self.onmessage=({data})=>{try{self.postMessage({moves:planPracticePath(data.source,data.target)});}catch(error){self.postMessage({error:error.message});}};
