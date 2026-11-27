// Runs server/install.sh in a throw-away copy of the repo with fake systemctl and
// caddy, so nothing real is installed or restarted. Needs Linux, bash and setsid.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import path from 'node:path';

if (process.platform !== 'linux' || spawnSync('setsid', ['--version']).status !== 0) {
  console.log('install.test.ts: skipped (needs Linux and setsid)');
  process.exit(0);
}

const repo = path.resolve(import.meta.dirname, '../..');

// A copy of what install.sh needs: server/ files and a game.ts that marks the repo root.
function sandbox() {
  const root = mkdtempSync(path.join(tmpdir(), 'rosadots-install-'));
  mkdirSync(path.join(root, 'server/src'), { recursive: true });
  writeFileSync(path.join(root, 'game.ts'), '');
  writeFileSync(path.join(root, 'server/src/index.ts'), '');
  for (const f of ['install.sh', 'package.json', 'rosadots-server.service', '.env.example']) {
    cpSync(path.join(repo, 'server', f), path.join(root, 'server', f));
  }
  const bin = path.join(root, 'bin');
  mkdirSync(bin);
  const stub = (name: string, body: string) => {
    writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}\n`);
    chmodSync(path.join(bin, name), 0o755);
  };
  stub('systemctl', `echo "$@" >> "${root}/systemctl.log"; exit 0`);
  stub('caddy', `[ "$1" = validate ] && exit "\${FAKE_CADDY_VALIDATE:-0}"; echo "v2.8.4 h1:fake"`);
  return {
    root,
    bin,
    caddyfile: path.join(root, 'Caddyfile'),
    unit: path.join(root, 'unit.service'),
    log: () => (existsSync(path.join(root, 'systemctl.log')) ? readFileSync(path.join(root, 'systemctl.log'), 'utf8') : ''),
  };
}

function run(sb: ReturnType<typeof sandbox>, env: Record<string, string> = {}) {
  const r = spawnSync('setsid', ['-w', 'bash', path.join(sb.root, 'server/install.sh')], {
    encoding: 'utf8',
    env: {
      PATH: `${sb.bin}:${process.env.PATH}`,
      HOME: sb.root,
      ROSADOTS_DOMAIN: 'rosadots.example.com',
      ROSADOTS_SKIP_NPM: '1',
      ROSADOTS_SKIP_CHECK: '1',
      ROSADOTS_SKIP_FIREWALL: '1',
      ROSADOTS_NO_SUDO: '1',
      ROSADOTS_UNIT_PATH: sb.unit,
      ROSADOTS_CADDYFILE: sb.caddyfile,
      ...env,
    },
  });
  return { status: r.status, out: (r.stdout + r.stderr).replace(/\x1b\[[0-9;]*m/g, '') };
}

const read = (f: string) => readFileSync(f, 'utf8');
const count = (text: string, part: string) => text.split(part).length - 1;

// Fresh install.
{
  const sb = sandbox();
  const r = run(sb);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Kurulum tamam/);

  assert.ok(existsSync(path.join(sb.root, 'server/.env')), '.env is created');

  const caddy = read(sb.caddyfile);
  assert.match(caddy, /rosadots\.example\.com \{\n\treverse_proxy 127\.0\.0\.1:8787\n\}/);

  const unit = read(sb.unit);
  assert.match(unit, new RegExp(`^User=${userInfo().username}$`, 'm'));
  assert.match(unit, new RegExp(`^WorkingDirectory=${sb.root}/server$`, 'm'));
  assert.match(unit, new RegExp(`^EnvironmentFile=-${sb.root}/server/.env$`, 'm'));
  assert.match(unit, /^ExecStart=\S*node --import tsx src\/index\.ts$/m);
  assert.ok(!unit.includes('/opt/rosadots'), 'template paths are replaced');

  const log = sb.log();
  for (const want of ['daemon-reload', 'enable rosadots-server', 'restart rosadots-server', 'reload caddy']) {
    assert.ok(log.includes(want), `systemctl ${want}\n${log}`);
  }
}

// Running again keeps other sites and the .env, and never duplicates our block.
{
  const sb = sandbox();
  writeFileSync(sb.caddyfile, 'other.example.com {\n\trespond "hi"\n}\n');
  assert.equal(run(sb).status, 0);
  writeFileSync(path.join(sb.root, 'server/.env'), 'PORT=9001\n');
  const again = run(sb);
  assert.equal(again.status, 0, again.out);

  const caddy = read(sb.caddyfile);
  assert.equal(count(caddy, '# BEGIN rosadots'), 1);
  assert.equal(count(caddy, 'rosadots.example.com {'), 1);
  assert.match(caddy, /other\.example\.com \{\n\trespond "hi"\n\}/);
  assert.match(caddy, /reverse_proxy 127\.0\.0\.1:9001/, 'follows the port from .env');
  assert.equal(read(path.join(sb.root, 'server/.env')), 'PORT=9001\n', '.env is kept');
}

// A Caddy config that does not validate is rolled back and the script stops.
{
  const sb = sandbox();
  const before = 'other.example.com {\n\trespond "hi"\n}\n';
  writeFileSync(sb.caddyfile, before);
  const r = run(sb, { FAKE_CADDY_VALIDATE: '1' });
  assert.notEqual(r.status, 0);
  assert.match(r.out, /Caddy ayarı geçersiz/);
  assert.equal(read(sb.caddyfile), before, 'the old Caddyfile is restored');
}

// Nonsense domains are refused before anything is written.
{
  const sb = sandbox();
  const r = run(sb, { ROSADOTS_DOMAIN: 'bad domain; rm -rf /' });
  assert.notEqual(r.status, 0);
  assert.match(r.out, /Geçersiz alan adı/);
  assert.ok(!existsSync(sb.caddyfile));
}

// Without systemd or Caddy the script only prepares the files.
{
  const sb = sandbox();
  const r = run(sb, { ROSADOTS_NO_SYSTEMD: '1', ROSADOTS_SKIP_CADDY: '1' });
  assert.equal(r.status, 0, r.out);
  assert.ok(!existsSync(sb.unit) && !existsSync(sb.caddyfile));
  assert.equal(sb.log(), '');
}

console.log('install.test.ts: all tests passed');
