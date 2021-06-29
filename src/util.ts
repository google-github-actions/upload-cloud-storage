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

import * as path from 'path';

/**
 * Constructs a destination path in GCS from a given filepath
 *
 * @param filePath The path to file.
 * @param directory  The parent dir specified.
 * @param parent  If parent dir should be preserved in destination path.
 * @param prefix  Prefix any to be prefixed to destination path.
 * @returns The GCS destination for a given filepath
 */
export async function GetDestinationFromPath(
  filePath: string,
  directory: string,
  parent = true,
  prefix = '',
): Promise<string> {
  let dest = path.posix.normalize(filePath);
  // if parent is set to false, modify dest path to remove parentDir
  if (!parent) {
    // get components of parent path "./test/foo" to [test,foo]
    const splitDirPath = path.posix
      .normalize(directory)
      .split(path.posix.sep)
      .filter((p) => p);
    // get components of file path "./test/foo/1" becomes [test,foo,1]
    const splitDestPath = path.posix.normalize(filePath).split(path.posix.sep);
    // for each element in parent path pop those from file path
    // for a given parent dir like [test,foo], files maybe [test,foo,1] [test,foo,bar,1]
    // which is transformed to [1], [bar,1] etc
    splitDirPath.forEach(() => {
      splitDestPath.shift();
    });
    // create final destination by joining [bar,1] to "bar/1"
    dest = path.posix.join(...splitDestPath);
  }
  // add any prefix if set "bar/1" with prefix "testprfx" becomes "testprfx/bar/1"
  if (prefix) {
    dest = path.posix.join(prefix, dest);
  }
  return dest;
}
