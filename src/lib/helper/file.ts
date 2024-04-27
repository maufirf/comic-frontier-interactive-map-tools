import * as fs from 'fs';
import path from 'path';

export const parseJSONFile = (relativePath:string) => JSON.parse(
    fs.readFileSync(path.resolve(__dirname,relativePath),'utf-8')
);