from html.parser import HTMLParser
from urllib.parse import urlparse,parse_qs,urljoin
from pathlib import Path
import json,urllib.request,concurrent.futures
root=Path(r'D:\FinAgenticAI')
class Images(HTMLParser):
 def __init__(self):super().__init__();self.images=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='img':
   src=a.get('src','');original=parse_qs(urlparse(src).query).get('url',[src])[0]
   if '/portfolio/' in original or original=='/images/logo/logo.webp':self.images.append(urljoin('https://www.dhi.bt',original))
p=Images();p.feed((root/'docs/source-review/dhi-home.html').read_text(encoding='utf-8'))
urls=list(dict.fromkeys(p.images));print(json.dumps(urls,indent=2))
if __name__=='__main__':
 import sys
 if '--download' in sys.argv:
  folder=root/'frontend/public/logos';folder.mkdir(parents=True,exist_ok=True)
  def fetch(url):
   name=Path(urlparse(url).path).name
   if name=='logo.webp':name='DHI.webp'
   try:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as response:
     content=response.read()
     if not response.headers.get('Content-Type','').startswith('image/'):raise ValueError('Not an image')
    (folder/name).write_bytes(content)
    return {'file':name,'url':url}
   except Exception as e:return {'url':url,'error':str(e)}
  with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:results=list(executor.map(fetch,urls))
  (root/'docs/source-review/logo-sources.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
  print(json.dumps(results,indent=2))
