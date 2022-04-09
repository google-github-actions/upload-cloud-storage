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

import { promises as fs } from 'fs';
import * as path from 'path';

import globby from 'globby';
import { toPlatformPath, toPosixPath } from '@google-github-actions/actions-utils';

/**
 * absoluteRootAndComputedGlob expands the root to an absolute path. If the
 * result points to a file, the root is modified to be the parent directory and
 * the glob is updated to match only the file. Otherwise, the absolute path and
 * glob are returned.
 *
 * If the file/directory does not exist, it throws an error.
 *
 * If the root is a path to a file and glob is defined, it throws an error.
 *
 * @param root The root path to expand.
 * @param glob The glob to compute.
 * @return [string, string] The expanded root and computed glob.
 */
export async function absoluteRootAndComputedGlob(
  root: string,
  glob: string,
): Promise<[absoluteRoot: string, computedGlob: string]> {
  // Resolve the root input path, relative to the active workspace. If the
  // value was already an absolute path, this has no effect.
  const githubWorkspace = process.env.GITHUB_WORKSPACE;
  if (!githubWorkspace) {
    throw new Error(`$GITHUB_WORKSPACE is not set`);
  }
  const resolvedRoot = path.resolve(githubWorkspace, toPlatformPath(root));

  // Handle when the root is pointing to a single file instead of a directory.
  // In this case, set the parent directory as the root and glob as the file.
  const absoluteRootStat = await fs.lstat(resolvedRoot);
  if (absoluteRootStat.isFile()) {
    if (glob) {
      throw new Error(`root "path" points to a file, but "glob" was also given`);
    }

    const computedGlob = path.basename(resolvedRoot);
    const absoluteRoot = path.dirname(resolvedRoot);
    return [absoluteRoot, toPosixPath(computedGlob)];
  }

  return [resolvedRoot, toPosixPath(glob)];
}

/**
 * parseBucketNameAndPrefix parses the given name and returns the bucket
 * portion and any prefix (if it exists).
 *
 * @param name Name the parse.
 * @return The bucket and prefix (prefix will be the empty string).
 */
export function parseBucketNameAndPrefix(name: string): [bucket: string, prefix: string] {
  const trimmed = (name || '').trim();

  const idx = trimmed.indexOf('/');
  if (idx > -1) {
    const bucket = (trimmed.substring(0, idx) || '').trim();
    const prefix = (trimmed.substring(idx + 1) || '').trim();
    return [bucket, prefix];
  }

  return [trimmed, ''];
}

/**
 * expandGlob compiles the list of all files in the given directory for the
 * provided glob.
 *
 * @param directoryPath The path to the directory.
 * @param glob Glob pattern to use for searching. If the empty string, a
 * match-all pattern is used instead.
 * @return Sorted list of relative paths of files from directoryPath, in posix
 * form.
 */
export async function expandGlob(directoryPath: string, glob: string): Promise<string[]> {
  const directoryPosix = toPosixPath(directoryPath);
  const pth = toPosixPath(path.posix.join(directoryPosix, glob));
  const filesList = await globby([pth], {
    dot: true,
  });

  for (let i = 0; i < filesList.length; i++) {
    const rel = path.posix.relative(directoryPosix, filesList[i]);
    filesList[i] = rel;
  }

  return filesList.sort();
}
