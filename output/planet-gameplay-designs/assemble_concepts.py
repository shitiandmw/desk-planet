"""Assemble generated planet art into review images and a download bundle."""

import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parent.parent
REFINED = ROOT / 'generation/batch-1f3e086482'
FONT = '/System/Library/Fonts/STHeiti Medium.ttc'
LIGHT_FONT = '/System/Library/Fonts/STHeiti Light.ttc'


def font(size, light=False):
    return ImageFont.truetype(LIGHT_FONT if light else FONT, size)


STAGES = [
    {
        'id': '01-gathering', 'title': '采集聚落', 'population': '12 / 12',
        'resources': '木材 32     石材 18     食物 24',
        'source': 'generation/batch-80a052be24/01-gathering.png',
        'selection': '中央储物点',
        'lines': ['自动采集 → 统一库存', '采食 4 · 伐木 3 · 采石 3', '还有 2 人可参与建设', '', '下一步：农田或工具升级'],
        'action': '调整人口分工',
        'tags': [('伐木点', (470, 204), (551, 269)), ('采石场', (899, 190), (977, 277)), ('采食区', (425, 357), (514, 423))],
        'caption': '人口分工：采食、伐木、采石 → 中央储物点',
    },
    {
        'id': '02-agriculture', 'title': '农业扩张', 'population': '24 / 30',
        'resources': '木材 68     石材 42     食物 96',
        'source': 'generation/batch-9eda1b4530/02-agriculture.png',
        'selection': '农田',
        'lines': ['岗位 6 / 8', '食物产出 +12 / 分', '', '农业扩张 / 工具改良', '保留空地供后续工坊'],
        'action': '选择研究方向',
        'tags': [('工具工坊', (888, 343), (934, 407)), ('粮仓', (776, 445), (811, 495)), ('农业用地', (790, 685), (846, 630))],
        'caption': '发展取舍：粮食与住房扩张 / 工具效率',
    },
    {
        'id': '03-metallurgy', 'title': '矿石冶炼', 'population': '40 / 48',
        'resources': '矿石 46     金属 18     工具 12',
        'source': 'generation/batch-9eda1b4530/03-metallurgy.png',
        'selection': '金属工具工坊',
        'lines': ['矿石 → 金属 → 工具', '当前瓶颈：金属供给', '', '可增加冶炼岗位', '下一步：机械研究'],
        'action': '查看生产缺口',
        'tags': [('矿场', (900, 151), (945, 217)), ('冶炼炉', (878, 286), (933, 355)), ('工具与研究', (985, 425), (1056, 508))],
        'caption': '加工瓶颈：矿石 → 冶炼 → 工具与研究',
    },
    {
        'id': '04-electric-manufacturing', 'title': '电力与制造', 'population': '64 / 72',
        'resources': '金属 128     零件 32     供电 80 / 100',
        'source': 'generation/batch-9eda1b4530/04-electric-manufacturing.png',
        'selection': '车辆工厂',
        'lines': ['金属 → 零件 → 战车', '生产队列：战车 × 2', '供电负载 80 / 100', '', '制造占用零件与人口'],
        'action': '调整制造队列',
        'tags': [('发电站', (834, 356), (912, 434)), ('零件工坊', (1004, 434), (1066, 507)), ('车辆制造', (956, 560), (1037, 636)), ('部队集结', (922, 764), (977, 723))],
        'caption': '工业投入：供电 + 零件 → 车辆制造与部队',
    },
]


def glass(draw, box, radius=14, alpha=183):
    draw.rounded_rectangle(box, radius=radius, fill=(21, 44, 55, alpha), outline=(228, 246, 247, 95), width=1)


def annotate(base, stage):
    overlay = Image.new('RGBA', base.size)
    draw = ImageDraw.Draw(overlay)
    glass(draw, (28, 25, 586, 122))
    draw.text((48, 40), stage['title'], font=font(28), fill='#f6fbf7')
    draw.text((370, 46), '人口 ' + stage['population'], font=font(20), fill='#dce9e9')
    draw.text((48, 84), stage['resources'], font=font(21), fill='#e0eded')

    for text, (x, y), (tx, ty) in stage['tags']:
        w = int(draw.textlength(text, font=font(19))) + 24
        h = 34
        start_y = y + h if ty > y else y
        draw.line((x + w // 2, start_y, tx, ty), fill=(250, 250, 226, 195), width=2)
        draw.ellipse((tx - 3, ty - 3, tx + 3, ty + 3), fill='#f8e1a2')
        glass(draw, (x, y, x + w, y + h), radius=8, alpha=181)
        draw.text((x + 12, y + 6), text, font=font(19), fill='#f8fbf6')

    x, y, w, h = 1242, 356, 268, 328
    glass(draw, (x, y, x + w, y + h), alpha=195)
    draw.text((x + 18, y + 18), '当前选择', font=font(16, True), fill='#a9c5ca')
    draw.text((x + 18, y + 48), stage['selection'], font=font(25), fill='#ffffff')
    draw.line((x + 18, y + 89, x + w - 18, y + 89), fill=(225, 241, 240, 55), width=1)
    for index, text in enumerate(stage['lines']):
        if text:
            draw.text((x + 18, y + 108 + index * 29), text, font=font(18, True), fill='#e1eded')
    draw.rounded_rectangle((x + 16, y + 267, x + w - 16, y + 310), radius=9, fill=(110, 171, 145, 205))
    draw.text((x + w / 2, y + 289), stage['action'], font=font(20), anchor='mm', fill='#ffffff')

    dock = (518, 948, 1018, 1001)
    glass(draw, dock, alpha=181)
    active_count = 4 if stage['id'].startswith('04') else 3
    for index, text in enumerate(['建设', '生产', '科技', '部队']):
        color = '#eef8f4' if index < active_count else '#8fa9af'
        draw.text((580 + index * 125, 975), text, font=font(21), anchor='mm', fill=color)
        if index < 3:
            draw.line((643 + index * 125, 961, 643 + index * 125, 988), fill=(230, 245, 245, 50), width=1)
    return Image.alpha_composite(base.convert('RGBA'), overlay).convert('RGB')


def create_comparison():
    width, margin, gap, top = 2400, 48, 36, 160
    card_width = (width - margin * 2 - gap) // 2
    image_height = card_width * 2 // 3
    card_height = image_height + 124
    height = top + card_height * 2 + gap + 48
    board = Image.new('RGB', (width, height), '#eef3f4')
    draw = ImageDraw.Draw(board)
    draw.text((margin, 28), '低多边形星球 · 文明发展设计', font=font(58), fill='#193b43')
    draw.text((margin + 2, 106), '同一颗星球 / 功能分区 / 平静水面与短水渠', font=font(28, True), fill='#647e86')
    for index, stage in enumerate(STAGES):
        x = margin + (index % 2) * (card_width + gap)
        y = top + (index // 2) * (card_height + gap)
        draw.rectangle((x, y, x + card_width - 1, y + card_height - 1), fill='white')
        with Image.open(ROOT / f"{stage['id']}-annotated.png") as image:
            board.paste(image.resize((card_width, image_height), Image.Resampling.LANCZOS), (x, y))
        draw.rectangle((x, y, x + card_width - 1, y + card_height - 1), outline='#d3dfe3', width=1)
        draw.text((x + 24, y + image_height + 18), f"0{index + 1}  {stage['title']}", font=font(40), fill='#21464e')
        draw.text((x + 26, y + image_height + 76), stage['caption'], font=font(25, True), fill='#6a8086')
    board.save(ROOT / 'comparison.jpg', quality=95, subsampling=0, optimize=True)


def create_water_study():
    board = Image.new('RGB', (1600, 980), '#eff4f4')
    draw = ImageDraw.Draw(board)
    draw.text((48, 32), '水体设计 · 让动效保持简单', font=font(49), fill='#1b4651')
    draw.text((50, 107), '平静海湾 + 固定岸线 + 短水渠', font=font(27, True), fill='#6b858c')
    specs = [
        ('01-gathering', (290, 550, 730, 843), '01  平静海湾', ['保留连续水面', '让浅色纹理缓慢移动']),
        ('03-metallurgy', (405, 520, 735, 740), '02  稳定岸线', ['岸线位置保持固定', '边缘只做轻微明暗变化']),
        ('03-metallurgy', (542, 433, 889, 664), '03  短水渠', ['固定渠床和水带', '纹理沿水渠方向流动']),
    ]
    for index, (identifier, bounds, title, notes) in enumerate(specs):
        x, y, w = 48 + index * 512, 174, 480
        draw.rounded_rectangle((x, y, x + w, 696), radius=12, fill='white', outline='#d3e0e3')
        with Image.open(ROOT / f'{identifier}.png') as image:
            crop = ImageOps.fit(image.crop(bounds), (w, 320), method=Image.Resampling.LANCZOS)
            board.paste(crop, (x, y))
        draw.text((x + 23, 522), title, font=font(31), fill='#25515b')
        for row, text in enumerate(notes):
            draw.text((x + 25, 580 + row * 39), text, font=font(25, True), fill='#6b8389')
    draw.rounded_rectangle((48, 735, 1552, 903), radius=14, fill='#dcecee')
    draw.text((76, 759), '动效按层处理', font=font(30), fill='#214d59')
    draw.text((76, 813), '高光缓慢漂移、水渠定向流动；保持水位、岸线与渠床稳定。', font=font(25, True), fill='#4d717c')
    draw.text((76, 852), '水面接缝与流向仍需在引擎中验证，无需先做真实流体模拟。', font=font(24, True), fill='#4d717c')
    draw.text((50, 929), '静态设计示意 · 本轮未实现水体动画', font=font(21, True), fill='#7b9299')
    board.save(ROOT / 'water-study.jpg', quality=95, subsampling=0, optimize=True)


def main():
    results = json.loads((REFINED / 'batch-results.json').read_text(encoding='utf-8'))
    if any(item['status'] != 'succeeded' for item in results['jobs']):
        raise RuntimeError('One or more water refinements did not finish.')
    for stage in STAGES:
        identifier = stage['id']
        with Image.open(ROOT / stage['source']) as source, Image.open(REFINED / f'{identifier}.png') as revised:
            clean = revised.convert('RGB')
            if identifier == '01-gathering':
                preserve_foraging = Image.new('L', source.size, 0)
                ImageDraw.Draw(preserve_foraging).rectangle((475, 439, 579, 514), fill=255)
                preserve_foraging = preserve_foraging.filter(ImageFilter.GaussianBlur(2))
                clean = Image.composite(source.convert('RGB'), clean, preserve_foraging)
            if clean.size != (1536, 1024):
                raise ValueError(f'Unexpected canvas for {identifier}: {clean.size}')
            clean.save(ROOT / f'{identifier}.png')
            annotate(clean, stage).save(ROOT / f'{identifier}-annotated.png')
    create_comparison()
    create_water_study()
    shutil.copyfile(WORKSPACE / 'docs/planet-art-direction.md', ROOT / 'design-notes.md')
    requests = json.loads((ROOT / 'stage-01-request.json').read_text(encoding='utf-8'))
    requests += json.loads((ROOT / 'stage-02-04-requests.json').read_text(encoding='utf-8'))
    water_prompt = json.loads((ROOT / 'water-refinement-requests.json').read_text(encoding='utf-8'))[0]['prompt']
    prompts = {
        'model': 'gpt-image-2.5-sunburst', 'size': '1536x1024', 'quality': 'high',
        'reference': '上一轮 A 版作为风格参考；第一阶段图作为后续阶段的地形参考。',
        'stage_prompts': [{'id': item['id'], 'prompt': item['prompt']} for item in requests],
        'water_material_edit': water_prompt,
        'assembly': '水体局部编辑后与原场景合成；管理界面、功能标注及对比板由 Pillow 排版。',
    }
    (ROOT / 'prompts.json').write_text(json.dumps(prompts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'stages': len(STAGES), 'images': 10, 'comparison': str(ROOT / 'comparison.jpg')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
