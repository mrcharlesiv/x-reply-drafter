#!/usr/bin/env node
/**
 * Local Draft Receiver
 * 
 * Tiny HTTP server that receives draft data from the Chrome extension
 * and saves it to data/drafts.json for the engagement tracker to match.
 * 
 * Runs on localhost:9847 (not exposed externally).
 * 
 * Usage: node draft-receiver.mjs [--port 9847]
 */

import http from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const DATA_DIR = join(homedir(), '.openclaw', 'workspace', 'x-reply-drafter', 'data');
const DRAFTS_FILE = join(DATA_DIR, 'drafts.json');

const portIdx = process.argv.indexOf('--port');
const PORT = portIdx >= 0 ? parseInt(process.argv[portIdx + 1]) || 9847 : 9847;

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadDrafts() {
  if (!existsSync(DRAFTS_FILE)) return [];
  try { return JSON.parse(readFileSync(DRAFTS_FILE, 'utf8')); }
  catch { return []; }
}

function saveDrafts(drafts) {
  ensureDir();
  writeFileSync(DRAFTS_FILE, JSON.stringify(drafts, null, 2));
}

const server = http.createServer((req, res) => {
  // CORS headers for Chrome extension
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/draft') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const draft = {
          id: randomUUID(),
          postId: data.postId || '',
          postAuthor: data.postAuthor || '',
          postText: data.postText || '',
          replyText: data.replyText || '',
          promptId: data.promptId || '',
          tone: data.tone || 'casual',
          model: data.model || 'unknown',
          timestamp: Date.now(),
        };
        
        const drafts = loadDrafts();
        drafts.unshift(draft);
        // Keep last 1000 drafts
        if (drafts.length > 1000) drafts.length = 1000;
        saveDrafts(drafts);
        
        console.log(`[${new Date().toISOString()}] Saved draft → @${draft.postAuthor}: "${draft.replyText.slice(0, 60)}..."`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id: draft.id }));
      } catch (err) {
        console.error('Error saving draft:', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/drafts') {
    const drafts = loadDrafts();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(drafts.slice(0, 100)));
    return;
  }

  if (req.method === 'GET' && req.url === '/analytics') {
    const analyticsFile = join(DATA_DIR, 'analytics.json');
    if (existsSync(analyticsFile)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(readFileSync(analyticsFile, 'utf8'));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ totalTracked: 0 }));
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', drafts: loadDrafts().length }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Draft receiver listening on http://127.0.0.1:${PORT}`);
  console.log(`  POST /draft    — Save a new draft`);
  console.log(`  GET  /drafts   — List recent drafts`);
  console.log(`  GET  /analytics — Get performance analytics`);
  console.log(`  GET  /health   — Health check`);
});
