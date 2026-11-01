import data from './mainland-regions.json'

export type MainlandDistrict = { code: string; name: string }
export type MainlandCity = MainlandDistrict & { children: MainlandDistrict[] }
export type MainlandProvince = MainlandDistrict & { children: MainlandCity[] }

export const mainlandRegions = data as MainlandProvince[]

/** 从区县代码读取完整的公开地址，未知代码返回 undefined。 */
export function findMainlandLocation(code?: string | null) {
  if (!code) return undefined
  for (const province of mainlandRegions) {
    for (const city of province.children) {
      const district = city.children.find((item) => item.code === code)
      if (district) return { code: district.code, provinceCode: province.code, province: province.name, cityCode: city.code, city: city.name, districtCode: district.code, district: district.name }
    }
  }
  return undefined
}

/** 公开资料中使用省、市、区县的紧凑显示格式。 */
export function formatMainlandLocation(code?: string | null) {
  const location = findMainlandLocation(code)
  return location ? `${location.province} · ${location.city} · ${location.district}` : ''
}
