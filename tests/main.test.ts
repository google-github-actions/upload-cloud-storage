/*
 * Copyright 2022 Google LLC
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

import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';

import * as core from '@actions/core';
import { clearEnv, forceRemove, setInputs } from '@google-github-actions/actions-utils';

import { stubUpload } from './util.test';

import { run } from '../src/main';

/**
 * These are ONLY meant to be the highest-level tests that exercise the entire
 * workflow up to but not including the actual uploading of files.
 */
describe('#run', () => {
  beforeEach(async function () {
    // Create a temporary directory to serve as the actions workspace
    const githubWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'gha-'));
    await fs.cp('tests/testdata', path.join(githubWorkspace, 'testdata'), {
      recursive: true,
      force: true,
    });
    this.githubWorkspace = githubWorkspace;
    process.env.GITHUB_WORKSPACE = this.githubWorkspace;

    // Stub somewhat annoying logs
    const doNothing = () => {
      /** do nothing */
    };
    sinon.stub(core, 'debug').callsFake(doNothing);
    sinon.stub(core, 'info').callsFake(doNothing);
    sinon.stub(core, 'warning').callsFake(doNothing);
    sinon.stub(core, 'setOutput').callsFake(doNothing);
  });

  afterEach(async function () {
    sinon.restore();

    await forceRemove(this.githubWorkspace);

    clearEnv((key) => {
      return key.startsWith(`INPUT_`) || key.startsWith(`GITHUB_`);
    });
  });

  it('uploads all files', async function () {
    const uploadStub = stubUpload();

    setInputs({
      path: './testdata',
      destination: 'my-bucket/sub/path',
      gzip: 'true',
      resumable: 'true',
      parent: 'true',
      glob: '**/*',
      concurrency: '10',
      process_gcloudignore: 'true',
      predefinedAcl: 'authenticatedRead',
      headers: 'content-type: application/json',
    });

    await run();

    // Check call sites
    const uploadedFiles = uploadStub.getCalls().map((call) => call.args[0]);
    expect(uploadedFiles).to.eql([
      path.join(this.githubWorkspace, 'testdata', '🚀'),
      path.join(this.githubWorkspace, 'testdata', 'testfile'),
      path.join(this.githubWorkspace, 'testdata', 'test2.txt'),
      path.join(this.githubWorkspace, 'testdata', 'test1.txt'),
      path.join(this.githubWorkspace, 'testdata', 'test.json'),
      path.join(this.githubWorkspace, 'testdata', 'nested1', 'test1.txt'),
      path.join(this.githubWorkspace, 'testdata', 'nested1', 'nested2', 'test3.txt'),
    ]);

    // Check arguments
    const call = uploadStub.getCall(0).args[1];
    if (!call) {
      throw new Error('expected first call to be defined');
    }
    expect(call.destination).to.eql('sub/path/testdata/🚀');
    expect(call.metadata).to.eql({ contentType: 'application/json' });
    expect(call.gzip).to.eql(true);
    expect(call.predefinedAcl).to.eql('authenticatedRead');
    expect(call.resumable).to.eql(true);
    expect(call.configPath).to.be;
  });

  it('processes a gcloudignore', async function () {
    const uploadStub = stubUpload();

    setInputs({
      path: './testdata',
      destination: 'my-bucket/sub/path',
      gzip: 'true',
      resumable: 'true',
      parent: 'true',
      concurrency: '10',
      process_gcloudignore: 'true',
    });

    // Add gcloudignore
    await fs.writeFile(path.join(this.githubWorkspace, '.gcloudignore'), '*.txt');

    await run();

    // Check call sites
    const uploadedFiles = uploadStub.getCalls().map((call) => call.args[0]);
    expect(uploadedFiles).to.eql([
      path.join(this.githubWorkspace, 'testdata', '🚀'),
      path.join(this.githubWorkspace, 'testdata', 'testfile'),
      path.join(this.githubWorkspace, 'testdata', 'test.json'),
    ]);

    // Check arguments
    const call = uploadStub.getCall(0).args[1];
    if (!call) {
      throw new Error('expected first call to be defined');
    }
    expect(call.destination).to.eql('sub/path/testdata/🚀');
  });
});
