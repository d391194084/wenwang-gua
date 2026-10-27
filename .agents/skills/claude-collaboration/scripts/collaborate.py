"""Project-local verification and real Claude handoff. No automatic publish."""
import argparse
import contextlib
import datetime
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parents[4]
SUITES = ['monitor-followup', 'question-intent', 'question-context', 'fortune-logic',
          'analysis-views', 'yongshen-corpus-runner', 'autopick-state',
          'yongshen-corpus', 'narrative-context', 'fortune-exhaustive']


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')


def snapshot(root):
    files = set()
    for pattern in ['*.html', '*.js', '*.css', 'lib/**/*', 'tests/**/*',
                    'output/blind/**/*', '.agents/skills/claude-collaboration/**/*']:
        files.update(p for p in root.glob(pattern) if p.is_file()
                     and '__pycache__' not in p.parts and p.suffix != '.pyc')
    return {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(files)}


def result_ok(code, data):
    if code != 0 or not isinstance(data, dict) or data.get('failures') != 0:
        return False
    if 'clear' in data:
        clear = data['clear']
        return (clear.get('tested', 0) > 0 and clear.get('correct') == clear['tested']
                and data.get('newFailures') == [])
    count = data.get('tested', data.get('counts', {}).get('analyses', 0))
    return isinstance(count, int) and count > 0


def check(root, out, suites=None):
    out.mkdir(parents=True, exist_ok=False)
    before = snapshot(root)
    save(out / 'before.json', before)
    rows = []
    for name in SUITES if suites is None else suites:
        test = root / f'tests/{name}.test.cjs'
        row = {'name': name, 'passed': False}
        if not test.is_file():
            row['error'] = 'Missing required test'
        else:
            try:
                run = subprocess.run(['node', str(test)], cwd=root, capture_output=True,
                                     text=True, encoding='utf-8', timeout=300)
                (out / f'{name}.stdout.json').write_text(run.stdout, encoding='utf-8')
                (out / f'{name}.stderr.txt').write_text(run.stderr, encoding='utf-8')
                data = json.loads(run.stdout)
                row.update(exitCode=run.returncode, passed=result_ok(run.returncode, data),
                           tested=data.get('tested', data.get('clear', {}).get('tested',
                                  data.get('counts', {}).get('analyses'))),
                           failures=data.get('failures'), sourceHash=data.get('sourceHash'))
                if row['sourceHash'] and row['sourceHash'] != before.get('3-2.html'):
                    row.update(passed=False, error='Test ran on a different source')
            except (OSError, ValueError, subprocess.TimeoutExpired) as error:
                row['error'] = str(error)
        rows.append(row)
        print(json.dumps(row, ensure_ascii=True), flush=True)
    # A custom suite list is used by isolated tests, never by the CLI acceptance gate.
    if suites is None:
        test = root / 'tests/claude-collaboration.test.py'
        try:
            run = subprocess.run([sys.executable, str(test)], cwd=root, capture_output=True,
                                 text=True, encoding='utf-8', timeout=30)
            (out / 'workflow-tests.txt').write_text(run.stdout + run.stderr, encoding='utf-8')
            rows.append({'name': 'workflow', 'passed': run.returncode == 0,
                         'exitCode': run.returncode})
        except (OSError, subprocess.TimeoutExpired) as error:
            rows.append({'name': 'workflow', 'passed': False, 'error': str(error)})
    after = snapshot(root)
    save(out / 'after.json', after)
    result = {'passed': bool(rows) and all(r['passed'] for r in rows) and before == after,
              'stable': before == after, 'sourceHash': before.get('3-2.html'),
              'tests': rows, 'meaning': 'Mechanical checks only; independent Codex review required'}
    save(out / 'summary.json', result)
    return result


def receipt_ok(code, data):
    return (code == 0 and isinstance(data, dict) and data.get('type') == 'result'
            and data.get('subtype') == 'success' and data.get('is_error') is False
            and bool(data.get('session_id')))


def handoff(root, out, findings, session, model, ack):
    prompt = findings.read_text(encoding='utf-8')
    cli = shutil.which('claude') or str(Path.home() / '.local/bin/claude.exe')
    if not Path(cli).is_file():
        raise FileNotFoundError('Claude CLI not installed or not on PATH')
    out.mkdir(parents=True, exist_ok=False)
    before = snapshot(root)
    save(out / 'before.json', before)
    rules = ('Codex-Claude project collaboration. Read AGENTS.md. '
             'Do not commit, push, deploy, delete user files or change global settings. '
             'Do not change original corpus/oracles/blind datasets. '
             'Use natural Traditional Chinese explanations. '
             'Only claim tests actually run. Codex independently verifies your repair.\n')
    rules += ('Read-only receipt: read the supplied report and reply. No edits.\n' if ack else
              'Fix reproducible findings with general rules and permanent positive/negative tests. '
              'Edit only the app and relevant tests; leave cache/docs to Codex.\n')
    prompt = rules + prompt
    (out / 'prompt.txt').write_text(prompt, encoding='utf-8')
    args = [cli, '--print', '--output-format', 'stream-json', '--verbose', '--model', model,
            '--permission-mode', 'dontAsk' if ack else 'acceptEdits',
            '--tools', 'Read,Glob,Grep' if ack else 'Read,Edit,Write,Glob,Grep,Bash',
            '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}']
    if session:
        args += ['--resume', session]
    else:
        args += ['--session-id', str(uuid.uuid4()), '--name', 'Codex-Claude collaboration']
    if not ack:
        args += ['--allowedTools', 'Read,Edit,Write,Glob,Grep,Bash(node tests/*),Bash(git diff *)']
    meta = {'started': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'model': model, 'resume': session, 'ack': ack}
    save(out / 'invocation.json', meta)
    receipt = None
    with (out / 'stream.jsonl').open('w', encoding='utf-8') as log, \
         (out / 'stderr.txt').open('w', encoding='utf-8') as err:
        proc = subprocess.Popen(args, cwd=root, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                stderr=err, text=True, encoding='utf-8', errors='replace')
        proc.stdin.write(prompt)
        proc.stdin.close()
        for line in proc.stdout:
            log.write(line)
            log.flush()
            try:
                event = json.loads(line)
            except ValueError:
                continue
            if event.get('type') == 'result':
                receipt = event
            elif event.get('type') == 'assistant':
                for block in event.get('message', {}).get('content', []):
                    if block.get('type') == 'tool_use':
                        print(json.dumps({'tool': block.get('name')}), flush=True)
        code = proc.wait()
    save(out / 'receipt.json', receipt)
    after = snapshot(root)
    save(out / 'after.json', after)
    changed = [f for f in before.keys() | after.keys() if before.get(f) != after.get(f)]
    protected = [f for f in changed if f.startswith(('tests/yongshen-corpus/', 'output/blind/'))]
    result = {'delivered': receipt_ok(code, receipt), 'exitCode': code, 'changed': sorted(changed),
              'protectedChanged': protected, 'ackStable': not ack or before == after,
              'sessionId': receipt.get('session_id') if receipt else None,
              'meaning': 'Receipt only; repair still requires independent verification'}
    save(out / 'handoff.json', result)
    return result


@contextlib.contextmanager
def project_lock(root):
    lock = root / 'tmp/claude-collaboration.lock'
    lock.parent.mkdir(parents=True, exist_ok=True)
    with lock.open('x', encoding='utf-8') as handle:
        handle.write('Another collaboration command must not run concurrently.\n')
    try:
        yield
    finally:
        lock.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['check', 'handoff'])
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--findings', type=Path)
    parser.add_argument('--session')
    parser.add_argument('--model', default='claude-sonnet-5-5')
    parser.add_argument('--ack', action='store_true')
    args = parser.parse_args()
    if args.action == 'handoff' and not args.findings:
        parser.error('handoff requires --findings')
    with project_lock(ROOT):
        if args.action == 'check':
            result = check(ROOT, args.out.resolve())
            ok = result['passed']
        else:
            result = handoff(ROOT, args.out.resolve(), args.findings.resolve(),
                             args.session, args.model, args.ack)
            ok = result['delivered'] and not result['protectedChanged'] and result['ackStable']
    print(json.dumps(result, ensure_ascii=True), flush=True)
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
