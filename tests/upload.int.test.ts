/*
 * Copyright 2021 Google LLC
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

import * as tmp from 'tmp';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Storage } from '@google-cloud/storage';
import pMap from 'p-map';

import {
  EXAMPLE_FILE,
  EXAMPLE_DIR,
  FILES_IN_DIR,
  EXAMPLE_PREFIX,
  FILES_IN_DIR_WITHOUT_PARENT_DIR,
  TXT_FILES_IN_DIR,
  TXT_FILES_IN_DIR_WITHOUT_PARENT_DIR,
  TXT_FILES_IN_TOP_DIR,
} from './constants.test';
import { Client } from '../src/client';

const storage = new Storage({
  projectId: process.env.UPLOAD_CLOUD_STORAGE_TEST_PROJECT,
});
const PERF_TEST_FILE_COUNT = 10000;

// skip performance test and error message verification on Windows
const isWin = os.platform() === 'win32';

describe('Integration Upload ', function () {
  let testBucket: string;
  // helper function to create a new bucket
  async function getNewBucket(): Promise<string> {
    const bucketName = `test-${Math.round(Math.random() * 1000)}${
      process.env.GITHUB_SHA
    }`;
    const [bucket] = await storage.createBucket(bucketName, {
      location: 'US',
    });
    return bucket.name;
  }
  // helper func to get all files in test bucket
  async function getFilesInBucket(): Promise<string[]> {
    if (testBucket) {
      const [files] = await storage.bucket(testBucket).getFiles();
      return files.map((f) => f.name);
    }
    return [];
  }
  // create a new bucket for tests
  this.beforeAll(async function () {
    if (!process.env.UPLOAD_CLOUD_STORAGE_TEST_PROJECT) {
      this.skip();
    }
    testBucket = await getNewBucket();
    process.env.UPLOAD_ACTION_NO_LOG = 'true';
  });
  // skip test if no bucket is set
  this.beforeEach(function () {
    if (!process.env.UPLOAD_CLOUD_STORAGE_TEST_PROJECT) {
      this.skip();
    }
  });
  // remove all files in bucket before each test
  this.afterEach(async function () {
    const [files] = await storage.bucket(testBucket).getFiles();
    const uploader = async (name: string): Promise<number> => {
      const del = await storage.bucket(testBucket).file(name).delete();
      return del[0].statusCode;
    };
    await pMap(
      files.map((f) => f.name),
      uploader,
      { concurrency: 100 },
    );
    const [checkFiles] = await storage.bucket(testBucket).getFiles();
    expect(checkFiles.length).eq(0);
  });
  // delete bucket after all tests
  this.afterAll(async function () {
    if (testBucket) {
      await storage.bucket(testBucket).delete();
    }
  });

  it('uploads a single file', async function () {
    const uploader = new Client();
    const uploadResponse = await uploader.upload(
      testBucket,
      './tests/testdata/test1.txt',
    );
    expect(uploadResponse[0][0].name).eql('test1.txt');
    const filesInBucket = await getFilesInBucket();
    expect(filesInBucket.length).eq(1);
    expect(filesInBucket).to.have.members(['test1.txt']);
  });

  it('uploads a single file with prefix no gzip', async function () {
    const uploader = new Client();
    const uploadResponse = await uploader.upload(
      `${testBucket}/${EXAMPLE_PREFIX}`,
      './tests/testdata/test1.txt',
      '',
      false,
    );
    const expectedFile = `${EXAMPLE_PREFIX}/test1.txt`;
    expect(uploadResponse[0][0].name).eql(expectedFile);
    const filesInBucket = await getFilesInBucket();
    expect(filesInBucket.length).eq(1);
    expect(filesInBucket).to.have.members([expectedFile]);
  });

  it('uploads a single file with metadata', async function () {
    const uploader = new Client();
    const uploadResponse = await uploader.upload(
      testBucket,
      './tests/testdata/test1.txt',
      '',
      true,
      true,
      true,
      undefined,
      100,
      {
        contentType: 'application/json',
        metadata: {
          foo: 'bar',
        },
      },
    );
    expect(uploadResponse[0][0].name).eql('test1.txt');
    const filesInBucket = await getFilesInBucket();
    expect(filesInBucket.length).eq(1);
    expect(filesInBucket).to.have.members(['test1.txt']);
    const metadata = uploadResponse[0][0].metadata;
    expect(metadata.contentType).eql('application/json');
    expect(Object.keys(metadata.metadata).length).eq(1);
    expect(metadata.metadata.foo).eql('bar');
  });

  it('uploads a single file with prefix without resumeable', async function () {
    const uploader = new Client();
    const uploadResponse = await uploader.upload(
      `${testBucket}/${EXAMPLE_PREFIX}`,
      './tests/testdata/test1.txt',
      '',
      false,
      false,
    );
    const expectedFile = `${EXAMPLE_PREFIX}/test1.txt`;
    expect(uploadResponse[0][0].name).eql(expectedFile);
    const filesInBucket = await getFilesInBucket();
    expect(filesInBucket.length).eq(1);
    expect(filesInBucket).to.have.members([expectedFile]);
  });

  it('uploads a single file without extension', async function () {
    const uploader = new Client();
    const uploadResponse = await uploader.upload(
      `${testBucket}/${EXAMPLE_PREFIX}`,
      './tests/testdata/testfile',
    );
    const expectedFile = `${EXAMPLE_PREFIX}/testfile`;
    expect(uploadResponse[0][0].name).eql(expectedFile);
    const filesInBucket = await getFilesInBucket();
    expect(filesInBucket.length).eq(1);
    expect(filesInBucket).to.have.members([expectedFile]);
  });

  it('uploads a single file with non ascii filename 🚀', async function () {
    const uploader = new Client();
    const uploadResponse = await uploader.upload(
      `${testBucket}/${EXAMPLE_PREFIX}`,
      './tests/testdata/🚀',
    );
    const expectedFile = `${EXAMPLE_PREFIX}/🚀`;
    expect(uploadResponse[0][0].name).eql(expectedFile);
    const filesInBucket = await getFilesInBucket();
    expect(filesInBucket.length).eq(1);
    expect(filesInBucket).to.have.members([expectedFile]);
  });

  it('uploads a directory', async function () {
    const uploader = new Client();
    await uploader.upload(testBucket, EXAMPLE_DIR);
    const filesInBucket = await getFilesInBucket();
    expect(filesInBucket.length).eq(FILES_IN_DIR.length);
    expect(filesInBucket).to.have.members(FILES_IN_DIR);
  });

  it('uploads a directory with prefix', async function () {
    const uploader = new Client();
    await uploader.upload(`${testBucket}/${EXAMPLE_PREFIX}`, EXAMPLE_DIR);
    const filesInBucket = await getFilesInBucket();
    const filesInDirWithPrefix = FILES_IN_DIR.map(
      (f) => `${EXAMPLE_PREFIX}/${f}`,
    );
    expect(filesInBucket.length).eq(filesInDirWithPrefix.length);
    expect(filesInBucket).to.have.members(filesInDirWithPrefix);
  });

  it('uploads a directory without parentDir', async function () {
    const uploader = new Client();
    await uploader.upload(testBucket, EXAMPLE_DIR, '', true, true, false);
    const filesInBucket = await getFilesInBucket();
    expect(filesInBucket.length).eq(FILES_IN_DIR_WITHOUT_PARENT_DIR.length);
    expect(filesInBucket).to.have.members(FILES_IN_DIR_WITHOUT_PARENT_DIR);
  });

  it('uploads a directory with custom metadata', async function () {
    const uploader = new Client();
    await uploader.upload(
      testBucket,
      EXAMPLE_DIR,
      '',
      true,
      true,
      true,
      undefined,
      100,
      {
        metadata: {
          foo: 'bar',
        },
      },
    );
    const filesInBucket = await getFilesInBucket();
    expect(filesInBucket.length).eq(FILES_IN_DIR.length);
    expect(filesInBucket).to.have.members(FILES_IN_DIR);
    const [files] = await storage.bucket(testBucket).getFiles();
    files.forEach((f) => {
      switch (path.extname(f.name)) {
        case '.json': {
          expect(f.metadata.contentType).eql('application/json');
          break;
        }
        case '.txt': {
          expect(f.metadata.contentType).eql('text/plain');
          break;
        }
        default: {
          expect(f.metadata.contentType).to.be.undefined;
          break;
        }
      }
      expect(Object.keys(f.metadata.metadata).length).eq(1);
      expect(f.metadata.metadata.foo).eql('bar');
    });
  });

  it('uploads a directory with prefix without parentDir', async function () {
    const uploader = new Client();
    await uploader.upload(
      `${testBucket}/${EXAMPLE_PREFIX}`,
      EXAMPLE_DIR,
      '',
      true,
      true,
      false,
    );
    const filesInBucket = await getFilesInBucket();
    const filesInDirWithPrefix = FILES_IN_DIR_WITHOUT_PARENT_DIR.map(
      (f) => `${EXAMPLE_PREFIX}/${f}`,
    );
    expect(filesInBucket.length).eq(filesInDirWithPrefix.length);
    expect(filesInBucket).to.have.members(filesInDirWithPrefix);
  });

  it('uploads a directory with globstar txt', async function () {
    const uploader = new Client();
    await uploader.upload(testBucket, EXAMPLE_DIR, '**/*.txt');
    const filesInBucket = await getFilesInBucket();
    expect(filesInBucket.length).eq(TXT_FILES_IN_DIR.length);
    expect(filesInBucket).to.have.members(TXT_FILES_IN_DIR);
  });

  it('uploads a directory with globstar txt without parentDir', async function () {
    const uploader = new Client();
    await uploader.upload(
      testBucket,
      EXAMPLE_DIR,
      '**/*.txt',
      true,
      true,
      false,
    );
    const filesInBucket = await getFilesInBucket();
    expect(filesInBucket.length).eq(TXT_FILES_IN_DIR_WITHOUT_PARENT_DIR.length);
    expect(filesInBucket).to.have.members(TXT_FILES_IN_DIR_WITHOUT_PARENT_DIR);
  });

  it('uploads a directory with prefix with globstar txt without parentDir', async function () {
    const uploader = new Client();
    await uploader.upload(
      `${testBucket}/${EXAMPLE_PREFIX}`,
      EXAMPLE_DIR,
      '**/*.txt',
      true,
      true,
      false,
    );
    const filesInBucket = await getFilesInBucket();
    const filesInDirWithPrefix = TXT_FILES_IN_DIR_WITHOUT_PARENT_DIR.map(
      (f) => `${EXAMPLE_PREFIX}/${f}`,
    );
    expect(filesInBucket.length).eq(filesInDirWithPrefix.length);
    expect(filesInBucket).to.have.members(filesInDirWithPrefix);
  });

  it('uploads a directory with top level txt glob', async function () {
    const uploader = new Client();
    await uploader.upload(testBucket, EXAMPLE_DIR, '*.txt');
    const filesInBucket = await getFilesInBucket();
    expect(filesInBucket.length).eq(TXT_FILES_IN_TOP_DIR.length);
    expect(filesInBucket).to.have.members(TXT_FILES_IN_TOP_DIR);
  });

  it(`performance test with ${PERF_TEST_FILE_COUNT} files`, async function () {
    if (isWin) {
      this.skip();
    }
    tmp.setGracefulCleanup();

    const { name: tmpDirPath } = tmp.dirSync();
    for (let i = 0; i < PERF_TEST_FILE_COUNT; i++) {
      const { name: tmpFilePath } = tmp.fileSync({
        prefix: 'upload-act-test-',
        postfix: '.txt',
        dir: tmpDirPath,
      });
      fs.writeFileSync(tmpFilePath, path.posix.basename(tmpFilePath));
    }

    const uploader = new Client();
    await uploader.upload(testBucket, tmpDirPath, '', true, false);
    const filesInBucket = await getFilesInBucket();
    expect(filesInBucket.length).eq(PERF_TEST_FILE_COUNT);
  });

  it('throws an error for a non existent dir', async function () {
    if (isWin) {
      this.skip();
    }

    try {
      const uploader = new Client();
      await uploader.upload(testBucket, EXAMPLE_DIR + '/nonexistent');
      throw new Error(`error should have been thrown`);
    } catch (err) {
      expect(`${err}`).to.include('ENOENT');
    }
  });

  it('throws an error for a non existent bucket', async function () {
    try {
      const uploader = new Client();
      await uploader.upload(testBucket + 'nonexistent', EXAMPLE_FILE);
      throw new Error(`error should have been thrown`);
    } catch (err) {
      expect(err).to.be;
    }
  });
});
