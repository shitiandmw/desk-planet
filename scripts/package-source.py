"""Package the current planet demo and its source without dependencies or old concept archives."""
from pathlib import Path
import shutil
import zipfile

root = Path(__file__).resolve().parents[1]
output = root / 'output/planet-demo.zip'
files = [root / name for name in ('package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', '.gitignore')]
for directory in ('src', 'public', 'scripts', 'dist', 'docs/knowledge', 'docs/development', 'tests/fixtures'):
    files.extend(p for p in (root / directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
files.extend(root / 'docs' / name for name in ('demo-design.md', 'demo-validation.md', 'scene-spec.json', 'gameplay-guide.md', 'building-games-research.md'))
files.extend((root / 'docs/assets/demo').glob('planet-*'))

with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for path in files:
        archive.write(path, Path('planet-demo') / path.relative_to(root))
    readme = (root / 'README.md').read_text().replace('output/planet-demo/planet-demo.html', 'planet-demo.html')
    archive.writestr('planet-demo/README.md', readme)
    archive.write(root / 'output/planet-demo/planet-demo.html', 'planet-demo/planet-demo.html')
    archive.write(root / 'node_modules/three/LICENSE', 'planet-demo/third-party/three-MIT.txt')
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
shutil.copy2(output, root / 'output/woodland-demo.zip')
print(f'{output.name}: {output.stat().st_size:,} bytes; archive integrity verified')
