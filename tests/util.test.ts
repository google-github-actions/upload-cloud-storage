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

import 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';

import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { forceRemove, toPosixPath, toWin32Path } from '@google-github-actions/actions-utils';
import { Bucket, File, Storage, UploadOptions, UploadResponse } from '@google-cloud/storage';

import { absoluteRootAndComputedGlob, expandGlob, parseBucketNameAndPrefix } from '../src/util';

/**
 * stubUpload stubs out the storage.bucket.upload API calls.
 */
export const stubUpload = (): sinon.SinonStub<
  [string, UploadOptions?],
  Promise<UploadResponse>
> => {
  const stub = (
    sinon.stub<Bucket, 'upload'>(Bucket.prototype, 'upload') as unknown as sinon.SinonStub<
      [string, UploadOptions?],
      Promise<UploadResponse>
    >
  ).callsFake((p: string, opts?: UploadOptions): Promise<UploadResponse> => {
    const bucket = new Bucket(new Storage(), 'bucket');
    const file = new File(bucket, p);
    return Promise.resolve([file, opts]);
  });
  return stub;
};

/**
 * getFilesInBucket returns the names of the files in the bucket.
 */
export const getFilesInBucket = async (storage: Storage, bucketName: string): Promise<File[]> => {
  const [files] = await storage.bucket(bucketName).getFiles();
  return files;
};

/**
 * getFileNamesInBucket returns the names of the files in the bucket.
 */
export const getFileNamesInBucket = async (
  storage: Storage,
  bucketName: string,
): Promise<string[]> => {
  return (await getFilesInBucket(storage, bucketName)).map((file) => file.name);
};

describe('#absoluteRootAndComputedGlob', () => {
  beforeEach(async function () {
    // Make a temporary directory for each test.
    this.tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'gha-'));
    process.env.GITHUB_WORKSPACE = this.tmpdir;
  });

  afterEach(async function () {
    delete process.env.GITHUB_WORKSPACE;
    if (this.tmpdir) {
      await forceRemove(this.tmpdir);
    }
  });

  it('throws an error when GITHUB_WORKSPACE is unset', async function () {
    delete process.env.GITHUB_WORKSPACE;

    try {
      await absoluteRootAndComputedGlob('/not/a/real/path', '');
      throw new Error('expected error, got nothing');
    } catch (err: unknown) {
      expect(`${err}`).to.include('$GITHUB_WORKSPACE is not set');
    }
  });

  it('throws an error if input path does not exist', async function () {
    try {
      await absoluteRootAndComputedGlob('/not/a/real/path', '');
      throw new Error('expected error, got nothing');
    } catch (err: unknown) {
      expect(`${err}`).to.include('ENOENT');
    }
  });

  it('throws an error if the input is a file and glob is defined', async function () {
    const file = path.join(this.tmpdir, 'my-file');
    await fs.writeFile(file, 'test');

    try {
      await absoluteRootAndComputedGlob(file, '*.md');
      throw new Error('expected error, got nothing');
    } catch (err: unknown) {
      expect(`${err}`).to.include('root "path" points to a file');
    }
  });

  it('modifies the directory and glob when given a relative file', async function () {
    const file = path.join(this.tmpdir, 'my-file');
    await fs.writeFile(file, 'test');

    const result = await absoluteRootAndComputedGlob(path.basename(file), '');
    expect(result).to.eql([path.dirname(file), 'my-file', false]);
  });

  it('modifies the directory and glob when given a relative file in a subpath', async function () {
    const subdir = await fs.mkdtemp(path.join(this.tmpdir, 'sub-'));
    const file = path.join(subdir, 'my-file');
    await fs.writeFile(file, 'test');

    const name = path.join(path.basename(subdir), path.basename(file));
    const result = await absoluteRootAndComputedGlob(name, '');
    expect(result).to.eql([path.dirname(file), 'my-file', false]);
  });

  it('modifies the directory and glob when given an absolute file', async function () {
    const file = path.join(this.tmpdir, 'my-file');
    await fs.writeFile(file, 'test');

    const result = await absoluteRootAndComputedGlob(file, '');
    expect(result).to.eql([path.dirname(file), 'my-file', false]);
  });

  it('resolves a relative directory', async function () {
    const subdir = await fs.mkdtemp(path.join(this.tmpdir, 'sub-'));
    const rel = path.basename(subdir);

    const result = await absoluteRootAndComputedGlob(rel, '*.md');
    expect(result).to.eql([subdir, '*.md', true]);
  });

  it('does not resolve an absolute directory', async function () {
    const subdir = await fs.mkdtemp(path.join(this.tmpdir, 'sub-'));

    const result = await absoluteRootAndComputedGlob(subdir, '*.md');
    expect(result).to.eql([subdir, '*.md', true]);
  });

  it('always returns a posix glob', async function () {
    const result = await absoluteRootAndComputedGlob(this.tmpdir, 'foo\\bar\\*.txt');
    expect(result).to.eql([this.tmpdir, 'foo/bar/*.txt', true]);
  });

  it('resolves a win32-style absolute root', async function () {
    const file = path.join(this.tmpdir, 'my-file');
    await fs.writeFile(file, 'test');

    const result = await absoluteRootAndComputedGlob(toWin32Path(file), '');
    expect(result).to.eql([path.dirname(file), 'my-file', false]);
  });

  it('resolves a win32-style relative root', async function () {
    const file = path.join(this.tmpdir, 'my-file');
    await fs.writeFile(file, 'test');

    const result = await absoluteRootAndComputedGlob(toWin32Path(path.basename(file)), '');
    expect(result).to.eql([path.dirname(file), 'my-file', false]);
  });

  it('resolves a posix-style absolute root', async function () {
    const file = path.join(this.tmpdir, 'my-file');
    await fs.writeFile(file, 'test');

    const result = await absoluteRootAndComputedGlob(toPosixPath(file), '');
    expect(result).to.eql([path.dirname(file), 'my-file', false]);
  });

  it('resolves a posix-style relative root', async function () {
    const file = path.join(this.tmpdir, 'my-file');
    await fs.writeFile(file, 'test');

    const result = await absoluteRootAndComputedGlob(toPosixPath(path.basename(file)), '');
    expect(result).to.eql([path.dirname(file), 'my-file', false]);
  });
});

describe('#expandGlob', () => {
  beforeEach(async function () {
    // Make a temporary directory for each test.
    this.tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'gha-'));
  });

  afterEach(async function () {
    if (this.tmpdir) {
      await forceRemove(this.tmpdir);
    }
  });

  it('returns an empty array when the directory does not exist', async function () {
    const list = await expandGlob(path.join('dir', 'does', 'not', 'exist'), '');
    expect(list).to.eql([]);
  });

  it('returns an empty array when the directory is empty', async function () {
    const list = await expandGlob(this.tmpdir, '');
    expect(list).to.eql([]);
  });

  it('returns one file in a directory', async function () {
    const a = path.join(this.tmpdir, 'a');
    await fs.writeFile(a, 'test');
    const list = await expandGlob(this.tmpdir, '');
    expect(list).to.eql([toPosixPath('a')]);
  });

  it('returns multiple files in a directory', async function () {
    const a = path.join(this.tmpdir, 'a');
    await fs.writeFile(a, 'test');

    const b = path.join(this.tmpdir, 'b');
    await fs.writeFile(b, 'test');

    const list = await expandGlob(this.tmpdir, '');
    expect(list).to.eql([toPosixPath('a'), toPosixPath('b')]);
  });

  it('returns files in subdirectories', async function () {
    const a = path.join(this.tmpdir, 'a');
    await fs.writeFile(a, 'test');

    const pth = path.join(this.tmpdir, 'sub', 'directory');
    await fs.mkdir(pth, { recursive: true });
    const b = path.join(pth, 'b');
    await fs.writeFile(b, 'test');

    const list = await expandGlob(this.tmpdir, '');
    expect(list).to.eql([toPosixPath('a'), toPosixPath('sub/directory/b')]);
  });

  it('returns files beginning with a dot', async function () {
    const a = path.join(this.tmpdir, '.a');
    await fs.writeFile(a, 'test');

    const pth = path.join(this.tmpdir, 'sub', 'directory');
    await fs.mkdir(pth, { recursive: true });
    const b = path.join(pth, '.b');
    await fs.writeFile(b, 'test');

    const list = await expandGlob(this.tmpdir, '');
    expect(list).to.eql([toPosixPath('.a'), toPosixPath('sub/directory/.b')]);
  });

  it('returns files with non-ascii characters', async function () {
    const a = path.join(this.tmpdir, '🚀');
    await fs.writeFile(a, 'test');

    const pth = path.join(this.tmpdir, 'sub', 'directory');
    await fs.mkdir(pth, { recursive: true });
    const b = path.join(pth, '.🚀');
    await fs.writeFile(b, 'test');

    const list = await expandGlob(this.tmpdir, '');
    expect(list).to.eql([toPosixPath('sub/directory/.🚀'), toPosixPath('🚀')]);
  });

  it('returns files when given a relative path', async function () {
    const a = path.join(this.tmpdir, 'a');
    await fs.writeFile(a, 'test');

    const pth = path.join(this.tmpdir, 'sub', 'directory');
    await fs.mkdir(pth, { recursive: true });
    const b = path.join(pth, 'b');
    await fs.writeFile(b, 'test');

    const rel = path.relative(process.cwd(), this.tmpdir);
    const list = await expandGlob(rel, '');
    expect(list).to.eql([toPosixPath('a'), toPosixPath('sub/directory/b')]);
  });

  it('only returns files', async function () {
    const a = path.join(this.tmpdir, '.a');
    await fs.writeFile(a, 'test');

    const b = path.join(this.tmpdir, 'b');
    await fs.writeFile(b, 'test');

    const pth = path.join(this.tmpdir, 'sub', 'directory');
    await fs.mkdir(pth, { recursive: true });

    // "sub/directory" should not be included because it has no files.
    const list = await expandGlob(this.tmpdir, '');
    expect(list).to.eql([toPosixPath('.a'), toPosixPath('b')]);
  });

  it('honors the glob pattern', async function () {
    const a = path.join(this.tmpdir, '.a');
    await fs.writeFile(a, 'test');

    const b = path.join(this.tmpdir, 'b');
    await fs.writeFile(b, 'test');

    // The list should only contain a, since the glob only includes files
    // starting with a ".".
    const list = await expandGlob(this.tmpdir, '.*');
    expect(list).to.eql([toPosixPath('.a')]);
  });
});

describe('#parseBucketNameAndPrefix', () => {
  const cases: {
    only?: boolean;
    name: string;
    input: string;
    expected: [bucket: string, prefix: string];
  }[] = [
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

  cases.forEach((tc) => {
    const fn = tc.only ? it.only : it;
    fn(tc.name, () => {
      const result = parseBucketNameAndPrefix(tc.input);
      expect(result).to.eql(tc.expected);
    });
  });
});
