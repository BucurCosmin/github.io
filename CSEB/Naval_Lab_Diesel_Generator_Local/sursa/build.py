from pathlib import Path
p=Path(__file__).parent
(p/'dist').mkdir(exist_ok=True)
s=(p/'shell.html').read_text().replace('<!--THREE-->','<script>\n'+(p/'three.min.js').read_text()+'\n</script>').replace('<!--APP-->','<script>\n'+(p/'software-renderer.js').read_text()+'\n'+(p/'app.js').read_text()+'\n</script>')
(p/'dist/index.html').write_text(s)
print('Standalone HTML',len(s.encode()),'bytes')
