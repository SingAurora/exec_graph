import { plugin } from 'bun'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 此脚本只在显式导出时读取前端 app/demo，不进入服务端运行时依赖。
const backendRoot = fileURLToPath(new URL('../', import.meta.url))
const assets = new Map<string, string>()
plugin({
  name: 'demo-image-manifest',
  setup(build) {
    build.onLoad({ filter: /\.(jpg|jpeg|png|webp)$/ }, ({ path }) => {
      const key = basename(path)
      if (assets.has(key) && assets.get(key) !== path) throw new Error(`图片文件名冲突：${key}`)
      assets.set(key, path)
      return { contents: `export default ${JSON.stringify(`seed-asset:${key}`)}`, loader: 'js' }
    })
  },
})

const [{ currentUser, lin, miao, initialProjects }, { demoActions }, { cookingParticipants }, { initialFollowing }] = await Promise.all([
  import('../../frontend/src/app/demo/catalog'),
  import('../../frontend/src/app/demo/actions'),
  import('../../frontend/src/app/demo/cooking/participants'),
  import('../../frontend/src/app/demo/following'),
])
const dataset = {
  dataset: 'frontend-demo-v1',
  users: [currentUser, lin, miao, ...cookingParticipants],
  graphs: initialProjects,
  actions: demoActions.map(({ projectId, ...node }) => ({ ...node, graphId: projectId })),
  following: initialFollowing,
  assets: [...assets.keys()].sort().map((key) => ({ key })),
}
await Bun.write(resolve(backendRoot, 'internal/infrastructure/persistence/demoseed/testdata/demo-v1.json'), JSON.stringify(dataset, null, 2) + '\n')
for (const [key, source] of assets) {
  await Bun.write(resolve(backendRoot, 'internal/infrastructure/storage/demomedia/assets', key), Bun.file(source))
}
console.log(`导出 ${dataset.users.length} 个测试用户、${dataset.graphs.length} 张图、${dataset.actions.length} 条行动、${assets.size} 张本地配图`)
