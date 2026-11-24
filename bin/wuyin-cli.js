#!/usr/bin/env node
/**
 * CLI: 批量生成五音歌曲到磁盘
 * Usage:
 *   node bin/wuyin-cli.js --mode gong --count 5 --out out/
 *   npm run compose -- --mode yu --count 10 --key D --midi
 */

import { parseArgs, runCli } from '../src/cli.js';

const result = runCli(parseArgs(process.argv.slice(2)));
if (!result.ok) process.exit(result.code || 1);
