# Changelog

### [0.10.2](https://www.github.com/google-github-actions/upload-cloud-storage/compare/v0.10.1...v0.10.2) (2022-04-29)


### Miscellaneous Chores

* release 0.10.2 ([c8139e9](https://www.github.com/google-github-actions/upload-cloud-storage/commit/c8139e9af3fab69c9d73c7681be1405d7b591dd0))

### [0.10.1](https://www.github.com/google-github-actions/upload-cloud-storage/compare/v0.10.1...v0.10.1) (2022-04-27)


### Miscellaneous Chores

* release 0.10.1 (again) ([353bd88](https://www.github.com/google-github-actions/upload-cloud-storage/commit/353bd887e4b25b7421aad10428f267ff0144c1a4))

### [0.10.1](https://www.github.com/google-github-actions/upload-cloud-storage/compare/v0.10.0...v0.10.1) (2022-04-27)


### Miscellaneous Chores

* release 0.10.1 ([a57e0fd](https://www.github.com/google-github-actions/upload-cloud-storage/commit/a57e0fd138fe7123a81d71712f0682bb4d77d9c9))

## [0.10.0](https://www.github.com/google-github-actions/upload-cloud-storage/compare/v0.9.0...v0.10.0) (2022-04-26)


### Features

* refactor uploading and ignore processing ([#255](https://www.github.com/google-github-actions/upload-cloud-storage/issues/255)) ([6c467dd](https://www.github.com/google-github-actions/upload-cloud-storage/commit/6c467ddf4d1706392602ca12bdb604c635c9f571))

## [0.9.0](https://www.github.com/google-github-actions/upload-cloud-storage/compare/v0.8.0...v0.9.0) (2022-04-07)


### Features

* parse .gcloudignore files during upload ([#237](https://www.github.com/google-github-actions/upload-cloud-storage/issues/237)) ([0715ae5](https://www.github.com/google-github-actions/upload-cloud-storage/commit/0715ae527180418bb29f3055035821805f8b3344))

## [0.8.0](https://www.github.com/google-github-actions/upload-cloud-storage/compare/v0.7.0...v0.8.0) (2022-03-17)


### Miscellaneous Chores

* release 0.8.0 ([#233](https://www.github.com/google-github-actions/upload-cloud-storage/issues/233)) ([18d7842](https://www.github.com/google-github-actions/upload-cloud-storage/commit/18d78424cd0d52395d187cc82e3f13af4c0f018a))

## [0.7.0](https://www.github.com/google-github-actions/upload-cloud-storage/compare/v0.6.0...v0.7.0) (2022-03-08)


### ⚠ BREAKING CHANGES

* require Node 16 (#227)

### Miscellaneous Chores

* require Node 16 ([#227](https://www.github.com/google-github-actions/upload-cloud-storage/issues/227)) ([15c0c05](https://www.github.com/google-github-actions/upload-cloud-storage/commit/15c0c0521e9a3a3eb74e73e4407ba11ea441d67d))

## [0.6.0](https://www.github.com/google-github-actions/upload-cloud-storage/compare/v0.5.0...v0.6.0) (2022-03-08)

**⚠️ This is the last release that supports Node 12!**

### ⚠ BREAKING CHANGES

* throw an exception on invalid or duplicate headers (#169)

### Features

* add support for files and folders beginning with a dot ([#206](https://www.github.com/google-github-actions/upload-cloud-storage/issues/206)) ([b5dd2b4](https://www.github.com/google-github-actions/upload-cloud-storage/commit/b5dd2b4bed766f174d8238b2269ff3ca8a50a0bb))
* switch to using actions-utils ([#167](https://www.github.com/google-github-actions/upload-cloud-storage/issues/167)) ([7c418c5](https://www.github.com/google-github-actions/upload-cloud-storage/commit/7c418c5f23ef49794eba2e2b70d46dee5ee9d304))


### bug

* also upload files and folders beginning with a dot ([#206](https://www.github.com/google-github-actions/upload-cloud-storage/issues/206))
* throw an exception on invalid or duplicate headers ([#169](https://www.github.com/google-github-actions/upload-cloud-storage/issues/169)) ([7348133](https://www.github.com/google-github-actions/upload-cloud-storage/commit/7348133c56238ded37fcbb09c23fc8996481320f))

## [0.5.0](https://www.github.com/google-github-actions/upload-cloud-storage/compare/v0.4.0...v0.5.0) (2021-11-16)


### Features

* Add `headers` option ([#42](https://www.github.com/google-github-actions/upload-cloud-storage/issues/42)) ([#99](https://www.github.com/google-github-actions/upload-cloud-storage/issues/99)) ([531cbeb](https://www.github.com/google-github-actions/upload-cloud-storage/commit/531cbebb6f6d81d00018daceedd5d4ac33b5750a))
* add WIF docs, add warning for credentials input ([#145](https://www.github.com/google-github-actions/upload-cloud-storage/issues/145)) ([cb8404f](https://www.github.com/google-github-actions/upload-cloud-storage/commit/cb8404f7f7e1b83eb7d9f5a55eff745fab90be97))


### Bug Fixes

* absolute path without parent dir ([#108](https://www.github.com/google-github-actions/upload-cloud-storage/issues/108)) ([205a73d](https://www.github.com/google-github-actions/upload-cloud-storage/commit/205a73d2c3105366722104e84f2ad1da16c2ad63))

## [0.4.0](https://www.github.com/google-github-actions/upload-cloud-storage/compare/v0.3.0...v0.4.0) (2021-08-09)


### Features

* Add support for configuring resumable uploads ([#34](https://www.github.com/google-github-actions/upload-cloud-storage/issues/34)) ([#36](https://www.github.com/google-github-actions/upload-cloud-storage/issues/36)) ([6623911](https://www.github.com/google-github-actions/upload-cloud-storage/commit/6623911abca8aa04b7e1b453c5bd4c8544cb0811))
* Refactor action to support upload at root, glob matching ([#33](https://www.github.com/google-github-actions/upload-cloud-storage/issues/33)) ([a789c2a](https://www.github.com/google-github-actions/upload-cloud-storage/commit/a789c2a53adaa50b68f34fe3bfa2cf7b08585b71))


### Bug Fixes

* add docs for  resumable ([#54](https://www.github.com/google-github-actions/upload-cloud-storage/issues/54)) ([3bcc856](https://www.github.com/google-github-actions/upload-cloud-storage/commit/3bcc856858d4ef496631306d8ffe071d6e8d013d))
* skip setup/teardown without auth ([#55](https://www.github.com/google-github-actions/upload-cloud-storage/issues/55)) ([a518f71](https://www.github.com/google-github-actions/upload-cloud-storage/commit/a518f71a726853dbf7be97b32c48a37d62139b15))

## [0.3.0](https://www.github.com/google-github-actions/upload-cloud-storage/compare/v0.2.1...v0.3.0) (2021-05-26)


### Features

* Add `predefinedAcl` option ([#28](https://www.github.com/google-github-actions/upload-cloud-storage/issues/28)) ([#31](https://www.github.com/google-github-actions/upload-cloud-storage/issues/31)) ([a2ee322](https://www.github.com/google-github-actions/upload-cloud-storage/commit/a2ee322f4331b6873c769c25eb7e896f0ebddf99))

### [0.2.1](https://www.github.com/google-github-actions/upload-cloud-storage/compare/v0.2.0...v0.2.1) (2020-11-14)


### Bug Fixes

* user-agent ([#7](https://www.github.com/google-github-actions/upload-cloud-storage/issues/7)) ([59dc367](https://www.github.com/google-github-actions/upload-cloud-storage/commit/59dc367a30ea273fb86b5ad91f5cfbaf515347ab))

## [0.2.0](https://www.github.com/google-github-actions/upload-cloud-storage/compare/v0.1.0...v0.2.0) (2020-11-13)


### ⚠ BREAKING CHANGES

* transfer gcs action (#1)

### Features

* transfer gcs action ([#1](https://www.github.com/google-github-actions/upload-cloud-storage/issues/1)) ([3d447c2](https://www.github.com/google-github-actions/upload-cloud-storage/commit/3d447c22006c4a60e679e1e4bd435062c5c7a995))
