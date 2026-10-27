# Local object storage

MinIO AIStor stores original workbooks uploaded through the local FinAgenticAI application. [PostgreSQL](POSTGRESQL_SETUP.md) stores administrative records and submission references; agent results still use the existing browser workspace.

## Requirements

- Running Docker Desktop with Linux containers.
- An AIStor Free license saved as `.local/minio/minio.license` inside the project.
- Private credentials in `.env.storage.local`. Copy `.env.storage.example` and replace the password when setting up another computer.

Official guide: https://docs.min.io/aistor/installation/container/install/.

## Start and stop

Run in `D:\FinAgenticAI`:

```powershell
docker compose --env-file .env.storage.local -f compose.storage.yaml up -d
docker compose --env-file .env.storage.local -f compose.storage.yaml ps
```

Open http://127.0.0.1:9001. Credentials are `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` in `.env.storage.local`. The S3 API is http://127.0.0.1:9000 and the private upload bucket is `financial-submissions`.

```powershell
docker compose --env-file .env.storage.local -f compose.storage.yaml stop
```

Objects persist in Docker volume `finagenticai-storage_minio-data` across container restarts/recreation. Do not remove that volume or run `down --volumes` if you need the files. Persistent storage is not a backup.

Credentials and license files are ignored by Git. The local image and `.env.storage.example` are pinned to the same tested official image digest for reproducible team setup. Do not expose the console publicly or place root credentials in frontend code.

The reusable S3 check is `python frontend/scripts/check-object-storage.py`. It creates the private bucket if needed and tests a tiny synthetic object; `--verify-persistence` checks that the test object survives a restart and then removes only that test object.

## Application upload flow

Start MinIO as above, install the [FastAPI environment](../backend/README.md), then run `npm run api` and `npm run dev` from `D:\FinAgenticAI\frontend`. `npm run gemini` remains an alias. Restart the local API after changing storage settings. It reads `.env.storage.local` from the repository root; these values are never included in the frontend build. Optional `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY` override root credentials when an application account is configured. Existing signing keys and receipts are preserved across the FastAPI migration.

1. A company officer uploads a workbook. The backend stores its exact original bytes before validation.
2. Every upload receives a unique key: `originals/<company>/<period>/<submission-id>/v<version>/<object-id>/original.xlsx`. The extra object ID keeps simultaneous uploads separate too. Original filename, submission/version, uploader, timestamp, and SHA-256 are retained in object metadata and the signed receipt.
3. The browser saves that receipt with its submission version and synchronizes its metadata to PostgreSQL when configured. The validator retrieves the stored bytes, checks their hash and submission identity, and runs the existing Python checks. A validation failure does not delete the original.
4. **Download original** is available in submission history and validation details for versions with a stored workbook. Older sample records have no original file. Downloaded bytes must match the original hash.
5. If storage fails, validation does not start and the user sees an error. Submitting again creates another version; earlier stored originals remain intact.

The bucket stays private. Downloads use POST requests with a signed receipt; object keys alone do not grant access. The receipt is an access capability and should not be shared. The signing key is kept in ignored `.local/minio/receipt-signing.key`; preserve it across API restarts and back it up alongside the storage setup to keep existing receipts usable. Raw root credentials and signing keys never go to the browser.

API endpoints: `GET /api/storage/health`, `POST /api/storage/workbooks`, and `POST /api/storage/workbooks/download`. Validation accepts the stored receipt plus matching company/period/submission/version. The earlier raw-base64 validation API remains compatible for independent validator callers; it does not archive workbooks. All application uploads now use storage first.

The existing login is a frontend prototype. Signed receipts protect object retrieval; server-authenticated users and role authorization remain future integration work. Upload metadata and original references also persist in PostgreSQL when configured. Resetting browser state does not delete MinIO objects or database history. MinIO object metadata remains inspectable in the console. Revision numbers are still proposed by browsers; PostgreSQL rejects conflicting version snapshots. Reload before correcting a submission from a stale browser.

MinIO stores raw workbooks only in this integration. Agent results and generated reports retain their existing storage behavior. Teammates running independent local containers have separate data; shared testing requires one shared backend and storage instance. GitHub Pages cannot access this local backend/storage by itself.
