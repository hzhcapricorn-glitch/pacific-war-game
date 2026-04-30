#!/usr/bin/env python3
import json

# 读取卡牌数据
with open('src/data/cards/combat.json', 'r', encoding='utf-8') as f:
    cards = json.load(f)

# 需要换行的卡牌名称映射
name_replacements = {
    "TBD鱼雷机 破坏者": "TBD鱼雷机\n破坏者",
    "法拉格特级驱逐舰": "法拉格特级\n驱逐舰",
    "弗莱彻级驱逐舰": "弗莱彻级\n驱逐舰",
    "猫鲨级潜艇": "猫鲨级\n潜艇",
    "亚特兰大级巡洋舰": "亚特兰大级\n巡洋舰",
    "巴尔的摩级巡洋舰": "巴尔的摩级\n巡洋舰",
    "北卡罗来纳级战列舰": "北卡罗来纳级\n战列舰",
    "衣阿华级战列舰": "衣阿华级\n战列舰",
    "独立级轻型航母": "独立级\n轻型航母",
    "埃塞克斯级航空母舰": "埃塞克斯级\n航空母舰",
    "企业号航空母舰": "企业号\n航空母舰",
    "F4F野猫战斗机": "F4F野猫\n战斗机",
    "F6F地狱猫战斗机": "F6F地狱猫\n战斗机",
    "SBD无畏式俯冲轰炸机": "SBD无畏式\n俯冲轰炸机",
    "TBM复仇者鱼雷机": "TBM复仇者\n鱼雷机",
}

# 更新卡牌名称
updated_count = 0
for card in cards:
    if card['name'] in name_replacements:
        old_name = card['name']
        card['name'] = name_replacements[old_name]
        print(f"✓ Updated: {old_name} -> {repr(card['name'])}")
        updated_count += 1

# 写回文件
with open('src/data/cards/combat.json', 'w', encoding='utf-8') as f:
    json.dump(cards, f, ensure_ascii=False, indent=2)

print(f"\n✓ Total updated: {updated_count} cards")
print(f"✓ File saved: src/data/cards/combat.json")
