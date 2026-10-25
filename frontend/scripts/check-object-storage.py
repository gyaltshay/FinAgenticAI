"""Local S3 smoke check; never prints credentials or license contents."""
import argparse
import datetime as dt
import hashlib
import hmac
import json
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]


def config():
    values = {}
    for line in (ROOT / '.env.storage.local').read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('"\'')
    return values


def request(values, method, path, body=b''):
    endpoint = values['MINIO_ENDPOINT'].rstrip('/')
    parsed = urllib.parse.urlsplit(endpoint)
    if parsed.hostname not in {'localhost', '127.0.0.1'}:
        raise RuntimeError('This smoke check is restricted to local storage endpoints.')
    timestamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    date = timestamp[:8]
    digest = hashlib.sha256(body).hexdigest()
    headers = {'host': parsed.netloc, 'x-amz-content-sha256': digest, 'x-amz-date': timestamp}
    signed = ';'.join(sorted(headers))
    canonical_headers = ''.join(key + ':' + headers[key] + '\n' for key in sorted(headers))
    canonical_uri = urllib.parse.quote(path, safe='/-_.~')
    canonical = '\n'.join([method, canonical_uri, '', canonical_headers, signed, digest])
    scope = date + '/us-east-1/s3/aws4_request'
    text = 'AWS4-HMAC-SHA256\n' + timestamp + '\n' + scope + '\n' + hashlib.sha256(canonical.encode()).hexdigest()
    sign = lambda key, data: hmac.new(key, data.encode(), hashlib.sha256).digest()
    signing_key = ('AWS4' + values['MINIO_ROOT_PASSWORD']).encode()
    for part in [date, 'us-east-1', 's3', 'aws4_request']:
        signing_key = sign(signing_key, part)
    signature = hmac.new(signing_key, text.encode(), hashlib.sha256).hexdigest()
    headers['Authorization'] = 'AWS4-HMAC-SHA256 Credential=' + values['MINIO_ROOT_USER'] + '/' + scope + ', SignedHeaders=' + signed + ', Signature=' + signature
    req = urllib.request.Request(endpoint + canonical_uri, data=body if method in {'PUT', 'POST'} else None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, b''


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify-persistence', action='store_true')
    args = parser.parse_args()
    values = config()
    bucket = '/' + values['MINIO_BUCKET']
    receipt = ROOT / '.local/minio/check.json'
    if args.verify_persistence:
        check = json.loads(receipt.read_text())
        path = bucket + '/' + check['key']
        status, content = request(values, 'GET', path)
        if status != 200 or content.decode() != check['payload']:
            raise RuntimeError('Persistence verification failed (HTTP ' + str(status) + ').')
        status, _ = request(values, 'DELETE', path)
        if status not in {200, 204}:
            raise RuntimeError('Test-object cleanup failed (HTTP ' + str(status) + ').')
        receipt.unlink()
        print('Persistence verified; only the synthetic test object was removed.')
        return
    status, _ = request(values, 'HEAD', bucket)
    if status == 404:
        status, _ = request(values, 'PUT', bucket)
    if status not in {200, 204}:
        raise RuntimeError('Bucket setup failed (HTTP ' + str(status) + ').')
    key = '_setup-check/' + str(uuid.uuid4()) + '.txt'
    payload = 'FinAgenticAI synthetic storage connectivity test.'
    path = bucket + '/' + key
    status, _ = request(values, 'PUT', path, payload.encode())
    if status not in {200, 204}:
        raise RuntimeError('Test upload failed (HTTP ' + str(status) + ').')
    status, content = request(values, 'GET', path)
    if status != 200 or content != payload.encode():
        raise RuntimeError('Test download failed (HTTP ' + str(status) + ').')
    receipt.parent.mkdir(parents=True, exist_ok=True)
    receipt.write_text(json.dumps({'key': key, 'payload': payload}))
    print('Private bucket available; signed upload/download passed. Test object retained for restart verification.')


if __name__ == '__main__':
    main()
