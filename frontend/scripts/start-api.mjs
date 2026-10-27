import {resolve} from 'node:path';
import {root,runPython} from './python-runtime.mjs';
runPython([resolve(root,'backend/run.py')]);
