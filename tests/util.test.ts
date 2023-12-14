/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test } from 'node:test';
import assert from 'node:assert';

import { promises as fs } from 'node:fs';
import * as os from 'os';
import * as path from 'path';

import { forceRemove, toPosixPath, toWin32Path } from '@google-github-actions/actions-utils';

import { absoluteRootAndComputedGlob, expandGlob, parseBucketNameAndPrefix } from '../src/util';

test('#absoluteRootAndComputedGlob', { concurrency: true }, async (suite) => {
  let tmpdir: string;

  suite.beforeEach(async () => {
    // Make a temporary directory for each test.
    tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'gha-'));
    process.env.GITHUB_WORKSPACE = tmpdir;
  });

  suite.afterEach(async () => {
    delete process.env.GITHUB_WORKSPACE;
    await forceRemove(tmpdir);
  });

  await suite.test('throws an error when GITHUB_WORKSPACE is unset', async () => {
    delete process.env.GITHUB_WORKSPACE;

    await assert.rejects(async () => {
      await absoluteRootAndComputedGlob('/not/a/real/path', '');
    }, /GITHUB_WORKSPACE is not set/);
  });

  await suite.test('throws an error if input path does not exist', async () => {
    await assert.rejects(async () => {
      await absoluteRootAndComputedGlob('/not/a/real/path', '');
    }, 'ENOENT');
  });

  await suite.test('throws an error if the input is a file and glob is defined', async () => {
    const file = path.join(tmpdir, 'my-file');
    await fs.writeFile(file, 'test');

    await assert.rejects(async () => {
      await absoluteRootAndComputedGlob(file, '*.md');
    }, 'root "path" points to a file');
  });

  await suite.test('modifies the directory and glob when given a relative file', async () => {
    const file = path.join(tmpdir, 'my-file');
    await fs.writeFile(file, 'test');

    const result = await absoluteRootAndComputedGlob(path.basename(file), '');
    assert.deepStrictEqual(result, [path.dirname(file), 'my-file', false]);
  });

  await suite.test(
    'modifies the directory and glob when given a relative file in a subpath',
    async () => {
      const subdir = await fs.mkdtemp(path.join(tmpdir, 'sub-'));
      const file = path.join(subdir, 'my-file');
      await fs.writeFile(file, 'test');

      const name = path.join(path.basename(subdir), path.basename(file));
      const result = await absoluteRootAndComputedGlob(name, '');
      assert.deepStrictEqual(result, [path.dirname(file), 'my-file', false]);
    },
  );

  await suite.test('modifies the directory and glob when given an absolute file', async () => {
    const file = path.join(tmpdir, 'my-file');
    await fs.writeFile(file, 'test');

    const result = await absoluteRootAndComputedGlob(file, '');
    assert.deepStrictEqual(result, [path.dirname(file), 'my-file', false]);
  });

  await suite.test('resolves a relative directory', async () => {
    const subdir = await fs.mkdtemp(path.join(tmpdir, 'sub-'));
    const rel = path.basename(subdir);

    const result = await absoluteRootAndComputedGlob(rel, '*.md');
    assert.deepStrictEqual(result, [subdir, '*.md', true]);
  });

  await suite.test('does not resolve an absolute directory', async () => {
    const subdir = await fs.mkdtemp(path.join(tmpdir, 'sub-'));

    const result = await absoluteRootAndComputedGlob(subdir, '*.md');
    assert.deepStrictEqual(result, [subdir, '*.md', true]);
  });

  await suite.test('always returns a posix glob', async () => {
    const result = await absoluteRootAndComputedGlob(tmpdir, 'foo\\bar\\*.txt');
    assert.deepStrictEqual(result, [tmpdir, 'foo/bar/*.txt', true]);
  });

  await suite.test('resolves a win32-style absolute root', async () => {
    const file = path.join(tmpdir, 'my-file');
    await fs.writeFile(file, 'test');

    const result = await absoluteRootAndComputedGlob(toWin32Path(file), '');
    assert.deepStrictEqual(result, [path.dirname(file), 'my-file', false]);
  });

  await suite.test('resolves a win32-style relative root', async () => {
    const file = path.join(tmpdir, 'my-file');
    await fs.writeFile(file, 'test');

    const result = await absoluteRootAndComputedGlob(toWin32Path(path.basename(file)), '');
    assert.deepStrictEqual(result, [path.dirname(file), 'my-file', false]);
  });

  await suite.test('resolves a posix-style absolute root', async () => {
    const file = path.join(tmpdir, 'my-file');
    await fs.writeFile(file, 'test');

    const result = await absoluteRootAndComputedGlob(toPosixPath(file), '');
    assert.deepStrictEqual(result, [path.dirname(file), 'my-file', false]);
  });

  await suite.test('resolves a posix-style relative root', async () => {
    const file = path.join(tmpdir, 'my-file');
    await fs.writeFile(file, 'test');

    const result = await absoluteRootAndComputedGlob(toPosixPath(path.basename(file)), '');
    assert.deepStrictEqual(result, [path.dirname(file), 'my-file', false]);
  });
});

test('#expandGlob', { concurrency: true }, async (suite) => {
  let tmpdir: string;

  suite.beforeEach(async () => {
    // Make a temporary directory for each test.
    tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'gha-'));
  });

  suite.afterEach(async () => {
    await forceRemove(tmpdir);
  });

  await suite.test('returns an empty array when the directory does not exist', async () => {
    const result = await expandGlob(path.join('dir', 'does', 'not', 'exist'), '');
    assert.deepStrictEqual(result, []);
  });

  await suite.test('returns an empty array when the directory is empty', async () => {
    const result = await expandGlob(tmpdir, '');
    assert.deepStrictEqual(result, []);
  });

  await suite.test('returns one file in a directory', async () => {
    const a = path.join(tmpdir, 'a');
    await fs.writeFile(a, 'test');
    const result = await expandGlob(tmpdir, '');
    assert.deepStrictEqual(result, [toPosixPath('a')]);
  });

  await suite.test('returns multiple files in a directory', async () => {
    const a = path.join(tmpdir, 'a');
    await fs.writeFile(a, 'test');

    const b = path.join(tmpdir, 'b');
    await fs.writeFile(b, 'test');

    const result = await expandGlob(tmpdir, '');
    assert.deepStrictEqual(result, [toPosixPath('a'), toPosixPath('b')]);
  });

  await suite.test('returns files in subdirectories', async () => {
    const a = path.join(tmpdir, 'a');
    await fs.writeFile(a, 'test');

    const pth = path.join(tmpdir, 'sub', 'directory');
    await fs.mkdir(pth, { recursive: true });
    const b = path.join(pth, 'b');
    await fs.writeFile(b, 'test');

    const result = await expandGlob(tmpdir, '');
    assert.deepStrictEqual(result, [toPosixPath('a'), toPosixPath('sub/directory/b')]);
  });

  await suite.test('returns files beginning with a dot', async () => {
    const a = path.join(tmpdir, '.a');
    await fs.writeFile(a, 'test');

    const pth = path.join(tmpdir, 'sub', 'directory');
    await fs.mkdir(pth, { recursive: true });
    const b = path.join(pth, '.b');
    await fs.writeFile(b, 'test');

    const result = await expandGlob(tmpdir, '');
    assert.deepStrictEqual(result, [toPosixPath('.a'), toPosixPath('sub/directory/.b')]);
  });

  await suite.test(
    'returns files with unicode characters in the filename',
    { skip: process.platform === 'win32' },
    async () => {
      const a = path.join(tmpdir, '🚀');
      await fs.writeFile(a, 'test');

      const pth = path.join(tmpdir, 'sub', 'directory');
      await fs.mkdir(pth, { recursive: true });
      const b = path.join(pth, '.🚀');
      await fs.writeFile(b, 'test');

      const result = await expandGlob(tmpdir, '');
      assert.deepStrictEqual(result, [toPosixPath('sub/directory/.🚀'), toPosixPath('🚀')]);
    },
  );

  await suite.test('returns files when given a relative path', async () => {
    const a = path.join(tmpdir, 'a');
    await fs.writeFile(a, 'test');

    const pth = path.join(tmpdir, 'sub', 'directory');
    await fs.mkdir(pth, { recursive: true });
    const b = path.join(pth, 'b');
    await fs.writeFile(b, 'test');

    const rel = path.relative(process.cwd(), tmpdir);
    const result = await expandGlob(rel, '');
    assert.deepStrictEqual(result, [toPosixPath('a'), toPosixPath('sub/directory/b')]);
  });

  await suite.test('only returns files', async () => {
    const a = path.join(tmpdir, '.a');
    await fs.writeFile(a, 'test');

    const b = path.join(tmpdir, 'b');
    await fs.writeFile(b, 'test');

    const pth = path.join(tmpdir, 'sub', 'directory');
    await fs.mkdir(pth, { recursive: true });

    // "sub/directory" should not be included because it has no files.
    const result = await expandGlob(tmpdir, '');
    assert.deepStrictEqual(result, [toPosixPath('.a'), toPosixPath('b')]);
  });

  await suite.test('honors the glob pattern', async () => {
    const a = path.join(tmpdir, '.a');
    await fs.writeFile(a, 'test');

    const b = path.join(tmpdir, 'b');
    await fs.writeFile(b, 'test');

    // The list should only contain a, since the glob only includes files
    // starting with a ".".
    const result = await expandGlob(tmpdir, '.*');
    assert.deepStrictEqual(result, [toPosixPath('.a')]);
  });
});

test('#parseBucketNameAndPrefix', { concurrency: true }, async (suite) => {
  const cases = [
    {
      name: 'empty string',
      input: '',
      expected: ['', ''],
    },
    {
      name: 'spaces',
      input: '   ',
      expected: ['', ''],
    },
    {
      name: 'spaces slash',
      input: '   /   ',
      expected: ['', ''],
    },
    {
      name: 'only bucket name',
      input: 'foobar',
      expected: ['foobar', ''],
    },
    {
      name: 'bucket and prefix',
      input: 'foo/bar',
      expected: ['foo', 'bar'],
    },
    {
      name: 'bucket and long prefix',
      input: 'foo/bar/baz/zip/zap',
      expected: ['foo', 'bar/baz/zip/zap'],
    },
  ];

  for await (const tc of cases) {
    await suite.test(tc.name, async () => {
      const result = parseBucketNameAndPrefix(tc.input);
      assert.deepStrictEqual(result, tc.expected);
    });
  }
});
