from html.parser import HTMLParser
from pathlib import Path
class Parser(HTMLParser):
 def handle_starttag(self,t,a):
  d=dict(a)
  if t=='img' and any('logo' in v.lower() for v in d.values()):print(d.get('alt',''),d.get('src',''))
for n in ['bil','bdb']:
 print(n)
 p=Parser();p.feed(Path(r'D:\FinAgenticAI\docs\source-review',n+'-home.html').read_text(encoding='utf-8'))
