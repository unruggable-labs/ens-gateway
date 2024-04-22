import {parseEnv} from 'node:util';
import {readFileSync} from 'node:fs';
export const ENV = Object.assign(parseEnv(readFileSync(new URL('../.env', import.meta.url), {encoding: 'utf8'})), process.env);

