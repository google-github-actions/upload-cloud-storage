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

import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';

import ignore from 'ignore';
import { Storage, Bucket } from '@google-cloud/storage';

import {
  EXAMPLE_BUCKET,
  EXAMPLE_FILE,
  EXAMPLE_DIR,
  FAKE_FILE,
  FILES_IN_DIR,
  FAKE_METADATA,
  EXAMPLE_PREFIX,
  FILES_IN_DIR_WITHOUT_PARENT_DIR,
  TXT_FILES_IN_DIR,
  TXT_FILES_IN_TOP_DIR,
} from './constants.test';
import { UploadHelper, expandGlob, toPosixPath } from '../src/upload-helper';
/**
 * Unit Test uploadFile method in uploadHelper.
 */
describe('Unit Test uploadFile', function () {
  beforeEach(function () {
    // Before each call is made to uploadFile stub upload method in storage
    // library to return fake constant data.
    this.uploadStub = sinon.stub(Bucket.prototype, 'upload').callsFake(() => {
      return Promise.resolve([FAKE_FILE, FAKE_METADATA]);
    });
  });

  afterEach(function () {
    sinon.restore();
  });

  it('uploads a single file', async function () {
    const uploader = new UploadHelper(new Storage());
    await uploader.uploadFile(EXAMPLE_BUCKET, EXAMPLE_FILE, true, true);
    // Assert that upload method in storage library was called with right file.
    expect(this.uploadStub.firstCall.args[0]).eq(
      path.posix.normalize(EXAMPLE_FILE),
    );
  });

  it('uploads a single file with prefix', async function () {
    const uploader = new UploadHelper(new Storage());
    await uploader.uploadFile(
      EXAMPLE_BUCKET,
      EXAMPLE_FILE,
      true,
      true,
      EXAMPLE_PREFIX,
    );
    // Assert that upload method in storage library was called with right file
    // and right prefix.
    expect(this.uploadStub.firstCall.args[0]).eq(
      path.posix.normalize(EXAMPLE_FILE),
    );
    expect(this.uploadStub.firstCall.args[1].destination.split('/')[0]).eq(
      EXAMPLE_PREFIX,
    );
    expect(this.uploadStub.firstCall.args[1].resumable).to.be.true;
    expect(this.uploadStub.firstCall.args[1].configPath).to.exist;
  });

  it('uploads a single file not resumeable', async function () {
    const uploader = new UploadHelper(new Storage());
    await uploader.uploadFile(EXAMPLE_BUCKET, EXAMPLE_FILE, true, false);
    expect(this.uploadStub.firstCall.args[1].resumable).to.not.exist;
    expect(this.uploadStub.firstCall.args[1].configPath).to.not.exist;
  });

  it('uploads a single file no gzip', async function () {
    const uploader = new UploadHelper(new Storage());
    await uploader.uploadFile(EXAMPLE_BUCKET, EXAMPLE_FILE, false, false);
    expect(this.uploadStub.firstCall.args[1].gzip).to.be.false;
  });

  it('does not upload ignored file', async function () {
    const rel = path.posix.relative('.', EXAMPLE_FILE);
    const ignores = ignore().add(rel);
    const uploader = new UploadHelper(new Storage());
    const result = await uploader.uploadFile(
      EXAMPLE_BUCKET,
      EXAMPLE_FILE,
      false,
      false,
      undefined,
      undefined,
      undefined,
      ignores,
    );
    expect(result).to.eq(null);
  });
});

/**
 * Unit Test uploadDir method in uploadHelper.
 */
describe('Unit Test uploadDir', function () {
  beforeEach(function () {
    // Before each call is made to uploadDir stub uploadFile in UploadHelper to
    // return fake constant data.
    this.uploadFileStub = sinon
      .stub(UploadHelper.prototype, 'uploadFile')
      .callsFake(() => {
        return Promise.resolve([FAKE_FILE, FAKE_METADATA]);
      });
  });

  afterEach(function () {
    sinon.restore();
  });

  it('uploads a dir', async function () {
    const uploader = new UploadHelper(new Storage());
    await uploader.uploadDirectory(EXAMPLE_BUCKET, EXAMPLE_DIR, '', true, true);
    // Assert that uploadFile was called for each file in directory.
    expect(this.uploadFileStub.callCount).eq(FILES_IN_DIR.length);
    // Capture filename arguments passed to uploadFile.
    const uploadFileCalls = this.uploadFileStub.getCalls();
    const filenames = uploadFileCalls.map(
      (uploadFileCall: sinon.SinonSpyCall) => uploadFileCall.args[1],
    );
    // Assert uploadDir called uploadFile with right files.
    expect(filenames).to.have.members(FILES_IN_DIR);
  });

  it('uploads a dir with prefix', async function () {
    const uploader = new UploadHelper(new Storage());
    await uploader.uploadDirectory(
      EXAMPLE_BUCKET,
      EXAMPLE_DIR,
      '',
      true,
      true,
      EXAMPLE_PREFIX,
    );
    // Assert that uploadFile was called for each file in directory.
    expect(this.uploadFileStub.callCount).eq(FILES_IN_DIR.length);
    // Capture filename arguments passed to uploadFile.
    const uploadFileCalls = this.uploadFileStub.getCalls();
    const filenames = uploadFileCalls.map(
      (uploadFileCall: sinon.SinonSpyCall) => uploadFileCall.args[1],
    );
    // Capture destination arguments passed to uploadFile.
    const destinations = uploadFileCalls.map(
      (uploadFileCall: sinon.SinonSpyCall) => uploadFileCall.args[4],
    );
    // Assert uploadDir called uploadFile with right files.
    expect(filenames).to.have.members(FILES_IN_DIR);
    // Assert uploadDir called uploadFile with prefixed destination.
    destinations.forEach((destination: string) => {
      expect(destination.split('/')[0]).eq(EXAMPLE_PREFIX);
    });
  });

  it('uploads a dir at bucket root', async function () {
    const uploader = new UploadHelper(new Storage());
    await uploader.uploadDirectory(
      EXAMPLE_BUCKET,
      EXAMPLE_DIR,
      '',
      true,
      true,
      '',
      false,
    );
    // Assert that uploadFile was called for each file in directory.
    expect(this.uploadFileStub.callCount).eq(FILES_IN_DIR.length);
    // Capture filename arguments passed to uploadFile.
    const uploadFileCalls = this.uploadFileStub.getCalls();
    const filenames = uploadFileCalls.map(
      (uploadFileCall: sinon.SinonSpyCall) => uploadFileCall.args[1],
    );
    // Capture destination arguments passed to uploadFile.
    const destinations = uploadFileCalls.map(
      (uploadFileCall: sinon.SinonSpyCall) => uploadFileCall.args[4],
    );
    // Assert uploadDir called uploadFile with right files.
    expect(filenames).to.have.members(FILES_IN_DIR);
    // Assert uploadDir called uploadFile with destination paths.
    expect(destinations).to.have.members(FILES_IN_DIR_WITHOUT_PARENT_DIR);
  });

  it('uploads a dir at bucket root with prefix', async function () {
    const uploader = new UploadHelper(new Storage());
    await uploader.uploadDirectory(
      EXAMPLE_BUCKET,
      EXAMPLE_DIR,
      '',
      true,
      true,
      EXAMPLE_PREFIX,
      false,
    );
    // Assert that uploadFile was called for each file in directory.
    expect(this.uploadFileStub.callCount).eq(FILES_IN_DIR.length);
    // Capture filename arguments passed to uploadFile.
    const uploadFileCalls = this.uploadFileStub.getCalls();
    const filenames = uploadFileCalls.map(
      (uploadFileCall: sinon.SinonSpyCall) => uploadFileCall.args[1],
    );
    // Capture destination arguments passed to uploadFile.
    const destinations = uploadFileCalls.map(
      (uploadFileCall: sinon.SinonSpyCall) => uploadFileCall.args[4],
    );
    // Assert uploadDir called uploadFile with right files.
    expect(filenames).to.have.members(FILES_IN_DIR);
    // Assert uploadDir called uploadFile with destination paths.
    expect(destinations).to.have.members(
      FILES_IN_DIR_WITHOUT_PARENT_DIR.map((f) => `${EXAMPLE_PREFIX}/${f}`),
    );
    // Assert uploadDir called uploadFile with prefixed destination.
    destinations.forEach((destination: string) => {
      expect(destination.split('/')[0]).eq(EXAMPLE_PREFIX);
    });
  });

  it('uploads a dir at bucket root with globstar txt', async function () {
    const uploader = new UploadHelper(new Storage());
    await uploader.uploadDirectory(
      EXAMPLE_BUCKET,
      EXAMPLE_DIR,
      '**/*.txt',
      true,
      true,
      '',
      true,
    );
    // Assert that uploadFile was called for each file in directory.
    expect(this.uploadFileStub.callCount).eq(TXT_FILES_IN_DIR.length);
    // Capture filename arguments passed to uploadFile.
    const uploadFileCalls = this.uploadFileStub.getCalls();
    const filenames = uploadFileCalls.map(
      (uploadFileCall: sinon.SinonSpyCall) => uploadFileCall.args[1],
    );
    // Capture destination arguments passed to uploadFile.
    const destinations = uploadFileCalls.map(
      (uploadFileCall: sinon.SinonSpyCall) => uploadFileCall.args[4],
    );
    // Assert uploadDir called uploadFile with right files.
    expect(filenames).to.have.members(TXT_FILES_IN_DIR);
    // Assert uploadDir called uploadFile with destination paths.
    expect(destinations).to.have.members(TXT_FILES_IN_DIR);
  });

  it('uploads a dir at bucket root with glob txt in top dir', async function () {
    const uploader = new UploadHelper(new Storage());
    await uploader.uploadDirectory(
      EXAMPLE_BUCKET,
      EXAMPLE_DIR,
      '*.txt',
      true,
      true,
      '',
      true,
    );
    // Assert that uploadFile was called for each file in directory.
    expect(this.uploadFileStub.callCount).eq(TXT_FILES_IN_TOP_DIR.length);
    // Capture filename arguments passed to uploadFile.
    const uploadFileCalls = this.uploadFileStub.getCalls();
    const filenames = uploadFileCalls.map(
      (uploadFileCall: sinon.SinonSpyCall) => uploadFileCall.args[1],
    );
    // Capture destination arguments passed to uploadFile.
    const destinations = uploadFileCalls.map(
      (uploadFileCall: sinon.SinonSpyCall) => uploadFileCall.args[4],
    );
    // Assert uploadDir called uploadFile with right files.
    expect(filenames).to.have.members(TXT_FILES_IN_TOP_DIR);
    // Assert uploadDir called uploadFile with destination paths.
    expect(destinations).to.have.members(TXT_FILES_IN_TOP_DIR);
  });

  it('uploads a dir honoring ignores', async function () {
    // Unstub so the ignore logic is actually triggered.
    sinon.restore();

    const ignores = ignore().add('*.txt');
    const uploader = new UploadHelper(new Storage());

    const result = await uploader.uploadDirectory(
      EXAMPLE_BUCKET,
      EXAMPLE_DIR,
      '*.txt',
      true,
      true,
      '',
      true,
      undefined,
      undefined,
      undefined,
      ignores,
    );

    expect(result).to.eql([]);
  });
});

describe('#expandGlob', () => {
  beforeEach(async function () {
    // Make a temporary directory and make the path relative to cwd, then make
    // it posix.
    const tmp = os.tmpdir();
    this.tmpdir = await fs.mkdtemp(path.join(tmp, 'gha-'));
    this.tmpdir = path.relative(process.cwd(), this.tmpdir);
  });

  afterEach(async function () {
    if (this.tmpdir) {
      try {
        await fs.rm(this.tmpdir, { recursive: true, force: true });
      } catch (err) {
        console.error(`failed to remove directory: ${err}`);
      }
    }
  });

  it('returns the empty list when the directory is empty', async function () {
    const list = await expandGlob(this.tmpdir, '');
    expect(list).to.eql([]);
  });

  it('returns one file', async function () {
    const a = path.join(this.tmpdir, 'a');
    await fs.writeFile(a, 'test');
    const list = await expandGlob(this.tmpdir, '');
    expect(list).to.eql([toPosixPath(a)]);
  });

  it('returns multiple files', async function () {
    const a = path.join(this.tmpdir, 'a');
    await fs.writeFile(a, 'test');

    const b = path.join(this.tmpdir, 'b');
    await fs.writeFile(b, 'test');

    const list = await expandGlob(this.tmpdir, '');
    expect(list).to.eql([toPosixPath(a), toPosixPath(b)]);
  });

  it('returns files in subdirectories', async function () {
    const a = path.join(this.tmpdir, 'a');
    await fs.writeFile(a, 'test');

    const pth = path.join(this.tmpdir, 'sub', 'directory');
    await fs.mkdir(pth, { recursive: true });
    const b = path.join(pth, 'b');
    await fs.writeFile(b, 'test');

    const list = await expandGlob(this.tmpdir, '');
    expect(list).to.eql([toPosixPath(a), toPosixPath(b)]);
  });

  it('returns files beginning with a dot', async function () {
    const a = path.join(this.tmpdir, '.a');
    await fs.writeFile(a, 'test');

    const pth = path.join(this.tmpdir, 'sub', 'directory');
    await fs.mkdir(pth, { recursive: true });
    const b = path.join(pth, '.b');
    await fs.writeFile(b, 'test');

    const list = await expandGlob(this.tmpdir, '');
    expect(list).to.eql([toPosixPath(a), toPosixPath(b)]);
  });

  it('returns files with non-ascii characters', async function () {
    const a = path.join(this.tmpdir, '🚀');
    await fs.writeFile(a, 'test');

    const pth = path.join(this.tmpdir, 'sub', 'directory');
    await fs.mkdir(pth, { recursive: true });
    const b = path.join(pth, '.🚀');
    await fs.writeFile(b, 'test');

    const list = await expandGlob(this.tmpdir, '');
    expect(list).to.eql([toPosixPath(b), toPosixPath(a)]);
  });
});
