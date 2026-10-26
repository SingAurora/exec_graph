import meal from '../../../../assets/demo-weight-meal.jpg'
import cycling from '../../../../assets/demo-cycling.jpg'
import photography from '../../../../assets/demo-street-photo.jpg'
import boardGames from '../../../../assets/demo-board-games.jpg'
import gaming from '../../../../assets/demo-gaming.jpg'

// 网上选取的演示配图保存在本地；它们不是这些虚构行动的现场照片。
// 来源依次为以下页面，保留链接便于替换或追溯。
// https://unsplash.com/photos/kcA-c3f_3FE
// https://unsplash.com/photos/OFyh9TpMyM8
// https://commons.wikimedia.org/wiki/File:网红化沙坡尾1.jpg
// 沙坡尾照片：向史公哲曰，CC BY-SA 4.0，使用 960px 缩略图。
// https://roxley.com/products/brass-birmingham （官方啤酒桶与棋盘配图）
// https://www.nintendo.com/jp/switch/aaaca/guide/index.html （© 2017 Nintendo）
/** 五个兴趣的本地演示配图，地点与游戏和行动文字对应。 */
export const interestImages = {
  weight: { url: meal, alt: '蔬菜与蛋白质搭配的一餐 · 演示配图' },
  cycling: { url: cycling, alt: '骑友结伴骑行 · 演示配图' },
  photography: { url: photography, alt: '厦门沙坡尾避风坞 · 演示配图' },
  'board-games': { url: boardGames, alt: '《工业革命：伯明翰》的啤酒桶与棋盘 · 官方配图' },
  gaming: { url: gaming, alt: '《马里奥奥德赛》中的马里奥与凯皮 · 官方配图' },
}
