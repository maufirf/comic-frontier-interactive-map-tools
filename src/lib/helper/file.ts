import * as fs from 'fs';
import path from 'path';

export const parseJSONFile = (absolutePath:string) => JSON.parse(
    fs.readFileSync(absolutePath,'utf-8')
);