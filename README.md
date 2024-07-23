# upload-cloud-storage

The `upload-cloud-storage` GitHub Action uploads files to a [Google Cloud
Storage (GCS)][gcs] bucket.

Paths to files that are successfully uploaded are set as output variables and
can be used in subsequent steps.

**This is not an officially supported Google product, and it is not covered by a
Google Cloud support contract. To report bugs or request features in a Google
Cloud product, please contact [Google Cloud
support](https://cloud.google.com/support).**

## Prerequisites

-   This action requires Google Cloud credentials that are authorized to upload
    blobs to the specified bucket. See the [Authorization](#authorization)
    section below for more information.

-   This action runs using Node 16. If you are using self-hosted GitHub Actions
    runners, you must use runner version [2.285.0](https://github.com/actions/virtual-environments)
    or newer.

## Usage

> **⚠️ WARNING!** The Node.js runtime has [known issues with unicode characters
> in filepaths on Windows][nodejs-unicode-windows]. There is nothing we can do
> to fix this issue in our GitHub Action. If you use unicode or special
> characters in your filenames, please use `gsutil` or `gcloud` to upload
> instead.

### For uploading a file

```yaml
jobs:
  job_id:
    permissions:
      contents: 'read'
      id-token: 'write'

    steps:
    - id: 'checkout'
      uses: 'actions/checkout@v4'

    - id: 'auth'
      uses: 'google-github-actions/auth@v2'
      with:
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
        service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

    - id: 'upload-file'
      uses: 'google-github-actions/upload-cloud-storage@v2'
      with:
        path: '/path/to/file'
        destination: 'bucket-name'

    # Example of using the output
    - id: 'uploaded-files'
      uses: 'foo/bar@v1'
      env:
        file: '${{ steps.upload-file.outputs.uploaded }}'
```

The file will be uploaded to `gs://bucket-name/file`

### For uploading a folder

```yaml
jobs:
  job_id:
    permissions:
      contents: 'read'
      id-token: 'write'

    steps:
    - id: 'checkout'
      uses: 'actions/checkout@v4'

    - id: 'auth'
      uses: 'google-github-actions/auth@v2'
      with:
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
        service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

    - id: 'upload-folder'
      uses: 'google-github-actions/upload-cloud-storage@v2'
      with:
        path: '/path/to/folder'
        destination: 'bucket-name'

    # Example of using the output
    - id: 'uploaded-files'
      uses: 'foo/bar@v1'
      env:
        files: '${{ steps.upload-folder.outputs.uploaded }}'
```

## Destination Filenames

If the folder has the following structure:

```text
.
└── myfolder
    ├── file1
    └── folder2
        └── file2.txt
```

### Default Configuration

With default configuration

```yaml
- id: 'upload-files'
  uses: 'google-github-actions/upload-cloud-storage@v2'
  with:
    path: 'myfolder'
    destination: 'bucket-name'
```

The files will be uploaded to `gs://bucket-name/myfolder/file1`,`gs://bucket-name/myfolder/folder2/file2.txt`

Optionally, you can also specify a prefix in destination.

```yaml
- id: 'upload-files'
  uses: 'google-github-actions/upload-cloud-storage@v2'
  with:
    path: 'myfolder'
    destination: 'bucket-name/myprefix'
```

The files will be uploaded to `gs://bucket-name/myprefix/myfolder/file1`,`gs://bucket-name/myprefix/myfolder/folder2/file2.txt`

### Upload to bucket root

To upload `myfolder` to the root of the bucket, you can set `parent` to false.
Setting `parent` to false will omit `path` when uploading to bucket.

```yaml
- id: 'upload-files'
  uses: 'google-github-actions/upload-cloud-storage@v2'
  with:
    path: 'myfolder'
    destination: 'bucket-name'
    parent: false
```

The files will be uploaded to `gs://bucket-name/file1`,`gs://bucket-name/folder2/file2.txt`

If path was set to `myfolder/folder2`, the file will be uploaded to `gs://bucket-name/file2.txt`

Optionally, you can also specify a prefix in destination.

```yaml
- id: 'upload-files'
  uses: 'google-github-actions/upload-cloud-storage@v2'
  with:
    path: 'myfolder'
    destination: 'bucket-name/myprefix'
    parent: false
```

The files will be uploaded to `gs://bucket-name/myprefix/file1`,`gs://bucket-name/myprefix/folder2/file2.txt`

### Glob Pattern

You can specify a glob pattern like

```yaml
- id: 'upload-files'
  uses: 'google-github-actions/upload-cloud-storage@v2'
  with:
    path: 'myfolder'
    destination: 'bucket-name'
    glob: '**/*.txt'
```

This will particular pattern will match all text files within `myfolder`.

In this case, `myfolder/folder2/file2.txt` is the only matched file and will be uploaded to `gs://bucket-name/myfolder/folder2/file2.txt`.

If `parent` is set to `false`, it wil be uploaded to `gs://bucket-name/folder2/file2.txt`.

## Inputs

<!-- BEGIN_AUTOGEN_INPUTS -->

-   <a name="project_id"></a><a href="#user-content-project_id"><code>project_id</code></a>: _(Optional)_ Google Cloud project ID to use for billing and API requests. If not
    provided, the project will be inferred from the environment, best-effort.
    To explicitly set the value:

    ```yaml
    project_id: 'my-project'
    ```

-   <a name="universe"></a><a href="#user-content-universe"><code>universe</code></a>: _(Optional, default: `googleapis.com`)_ The Google Cloud universe to use for constructing API endpoints. Trusted
    Partner Cloud and Google Distributed Hosted Cloud should set this to their
    universe address.

    You can also override individual API endpoints by setting the environment
    variable `GHA_ENDPOINT_OVERRIDE_<endpoint>` where `<endpoint>` is the API
    endpoint to override. For example:

    ```yaml
    env:
      GHA_ENDPOINT_OVERRIDE_oauth2: 'https://oauth2.myapi.endpoint/v1'
    ```

    For more information about universes, see the Google Cloud documentation.

-   <a name="path"></a><a href="#user-content-path"><code>path</code></a>: _(Required)_ The path to a file or folder inside the action's filesystem that should be
    uploaded to the bucket.

    You can specify either the absolute path or the relative path from the
    action:

    ```yaml
    path: '/path/to/file'
    ```

    ```yaml
    path: '../path/to/file'
    ```

-   <a name="destination"></a><a href="#user-content-destination"><code>destination</code></a>: _(Required)_ The destination for the file/folder in the form bucket-name or with an
    optional prefix in the form `bucket-name/prefix`. For example, to upload a
    file named `file` to the GCS bucket `bucket-name`:

    ```yaml
    destination: 'bucket-name'
    ```

    To upload to a subfolder:

    ```yaml
    destination: 'bucket-name/prefix'
    ```

-   <a name="gzip"></a><a href="#user-content-gzip"><code>gzip</code></a>: _(Optional, default: `true`)_ Upload file(s) with gzip content encoding. To disable gzip
    content-encoding, set the value to false:

    ```yaml
    gzip: false
    ```

-   <a name="resumable"></a><a href="#user-content-resumable"><code>resumable</code></a>: _(Optional, default: `true`)_ Enable resumable uploads. To disable resumable uploads, set the value to
    false:

    ```yaml
    resumable: false
    ```

-   <a name="predefinedAcl"></a><a href="#user-content-predefinedAcl"><code>predefinedAcl</code></a>: _(Optional)_ Apply a predefined set of access controls to the files being uploaded. For
    example, to grant project team members access to the uploaded files
    according to their roles:

    ```yaml
    predefinedAcl: 'projectPrivate'
    ```

    Acceptable values are: `authenticatedRead`, `bucketOwnerFullControl`,
    `bucketOwnerRead`, `private`, `projectPrivate`, `publicRead`. See [the
    document](https://googleapis.dev/nodejs/storage/latest/global.html#UploadOptions)
    for details.

-   <a name="headers"></a><a href="#user-content-headers"><code>headers</code></a>: _(Optional)_ Set object metadata. For example, to set the `Content-Type` header to
    `application/json` and custom metadata with key `custom-field` and value
    `custom-value`:

    ```yaml
    headers: |-
      content-type: 'application/json'
      x-goog-meta-custom-field: 'custom-value'
    ```

    Settable fields are: `cache-control`, `content-disposition`,
    `content-encoding`, `content-language`, `content-type`, `custom-time`. See
    [the
    document](https://cloud.google.com/storage/docs/gsutil/addlhelp/WorkingWithObjectMetadata#settable-fields;-field-values)
    for details. All custom metadata fields must be prefixed with
    `x-goog-meta-`.

-   <a name="parent"></a><a href="#user-content-parent"><code>parent</code></a>: _(Optional, default: `true`)_ Whether the parent directory should be included in GCS destination path. To disable this:

    ```yaml
    parent: false
    ```

-   <a name="glob"></a><a href="#user-content-glob"><code>glob</code></a>: _(Optional)_ Glob pattern to match for files to upload.

    ```yaml
    glob: '*.txt'
    ```

-   <a name="concurrency"></a><a href="#user-content-concurrency"><code>concurrency</code></a>: _(Optional, default: `100`)_ Number of files to simultaneously upload.

    ```yaml
    concurrency: '10'
    ```

-   <a name="process_gcloudignore"></a><a href="#user-content-process_gcloudignore"><code>process_gcloudignore</code></a>: _(Optional, default: `true`)_ Process a `.gcloudignore` file present in the top-level of the repository.
    If true, the file is parsed and any filepaths that match are not uploaded
    to the storage bucket. To disable, set the value to false:

    ```yaml
    process_gcloudignore: false
    ```


<!-- END_AUTOGEN_INPUTS -->


## Outputs

<!-- BEGIN_AUTOGEN_OUTPUTS -->

-   `uploaded`: Comma-separated list of files that were uploaded.


<!-- END_AUTOGEN_OUTPUTS -->


## Authorization

There are a few ways to authenticate this action. The caller must have
permissions to access the secrets being requested.

### Via google-github-actions/auth

Use [google-github-actions/auth](https://github.com/google-github-actions/auth)
to authenticate the action. You can use [Workload Identity Federation][wif] or
traditional [Service Account Key JSON][sa] authentication.

```yaml
jobs:
  job_id:
    permissions:
      contents: 'read'
      id-token: 'write'

    steps:
    - id: 'auth'
      uses: 'google-github-actions/auth@v2'
      with:
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
        service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

    - uses: 'google-github-actions/upload-cloud-storage@v2'
```

### Via Application Default Credentials

If you are hosting your own runners, **and** those runners are on Google Cloud,
you can leverage the Application Default Credentials of the instance. This will
authenticate requests as the service account attached to the instance. **This
only works using a custom runner hosted on GCP.**

```yaml
jobs:
  job_id:
    steps:
    - id: 'upload-file'
      uses: 'google-github-actions/upload-cloud-storage@v2'
```

The action will automatically detect and use the Application Default
Credentials.

[gcs]: https://cloud.google.com/storage
[wif]: https://cloud.google.com/iam/docs/workload-identity-federation
[sa]: https://cloud.google.com/iam/docs/creating-managing-service-accounts
[nodejs-unicode-windows]: https://github.com/nodejs/node/issues/48673
