#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.PERSONAL_TOKEN;
const USERNAME = process.env.GITHUB_ACTOR || process.env.GITHUB_USERNAME || 'Bunkheang-heng';
const YEAR = new Date().getFullYear();

async function fetchCommitCountThisYear(username) {
  if (!GITHUB_TOKEN) {
    throw new Error('Missing GITHUB_TOKEN. Provide a PAT via env GITHUB_TOKEN.');
  }

  const query = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          totalCommitContributions
        }
      }
    }
  `;

  const from = `${YEAR}-01-01T00:00:00Z`;
  const to = `${YEAR}-12-31T23:59:59Z`;

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'User-Agent': 'commit-badge-updater'
    },
    body: JSON.stringify({ query, variables: { login: username, from, to } })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub GraphQL error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const count = data?.data?.user?.contributionsCollection?.totalCommitContributions;
  if (typeof count !== 'number') {
    throw new Error('Unexpected response: ' + JSON.stringify(data));
  }
  return count;
}

function renderShield(count) {
  const label = encodeURIComponent('Commits (this year)');
  const message = encodeURIComponent(String(count));
  const color = '7D6BFE';
  return `https://img.shields.io/badge/${label}-${message}-${color}?style=for-the-badge`;
}

async function updateReadme(badgeUrl) {
  const readmePath = path.resolve(process.cwd(), 'README.md');
  let content = await fs.readFile(readmePath, 'utf8');
  const start = '<!-- COMMITS:START -->';
  const end = '<!-- COMMITS:END -->';

  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  const replacement = `${start}<img src="${badgeUrl}" />${end}`;

  if (!pattern.test(content)) {
    throw new Error('Markers not found in README.md');
  }
  content = content.replace(pattern, replacement);
  await fs.writeFile(readmePath, content, 'utf8');
}

async function main() {
  try {
    const count = await fetchCommitCountThisYear(USERNAME);
    const badgeUrl = renderShield(count);
    await updateReadme(badgeUrl);
    console.log(`Updated commits badge to ${count}`);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
}

main();


