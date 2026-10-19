"""Deliver original design notes, source links, development plan and verification evidence."""
from pathlib import Path
import zipfile

root=Path(__file__).resolve().parents[1]
output=root/'output/planet-planning.zip'
output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for directory in ('knowledge','development'):
        for path in sorted((root/'docs'/directory).rglob('*')):
            if path.is_file():archive.write(path,Path('planet-planning')/path.relative_to(root/'docs'))
    for path in sorted((root/'docs/assets/demo').glob('planet-iteration-*.png')):
        archive.write(path,Path('planet-planning')/path.relative_to(root/'docs'))
    for name in ('gameplay-guide.md','demo-design.md','demo-validation.md'):
        archive.write(root/'docs'/name,Path('planet-planning')/name)
    archive.writestr('planet-planning/README.md','# 微缩星球 · 策划与开发资料\n\n从 [知识库](knowledge/README.md)、[开发清单](development/backlog.md) 和 [迭代记录](development/iterations.md) 开始。当前玩法见 [游玩指南](gameplay-guide.md)，功能与证据边界见 [验证记录](demo-validation.md)。\n\n资料包含原创机制摘要与官方来源链接，不包含第三方游戏资产或页面全文。\n')
with zipfile.ZipFile(output) as archive:assert archive.testzip() is None
print(f'{output.relative_to(root)}: {output.stat().st_size:,} bytes; verified')
