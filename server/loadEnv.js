import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '.env') });

// Common runtime helpers for local media tooling.
if (!process.env.PYTHONPATH) {
  const home = process.env.HOME || '';
  const candidates = [
    `${home}/.local/lib/python3.10/site-packages`,
    `${home}/.local/lib/python3.12/site-packages`,
    `${home}/.local/lib/python3.11/site-packages`
  ];
  process.env.PYTHONPATH = candidates.filter(Boolean).join(':');
}

if (!process.env.PYTHONUNBUFFERED) process.env.PYTHONUNBUFFERED = '1';

export default process.env;
