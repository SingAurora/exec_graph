import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mainlandRegions } from '../../../entities/profile/model/mainland-regions.ts'
import { MainlandLocationSelect } from './MainlandLocationSelect.tsx'

const render = (props) => renderToStaticMarkup(createElement(MainlandLocationSelect, { onChange() {}, ...props }))

describe('mainland location select', () => {
  test('uses component-library combobox triggers for the three levels', () => {
    const html = render({})
    expect(html.match(/role="combobox"/g)).toHaveLength(3)
    expect(html).toContain('省份')
    expect(html).toContain('城市')
    expect(html).toContain('区县')
  })

  test('shows the selected province, city and district names', () => {
    const province = mainlandRegions[0]
    const city = province.children[0]
    const district = city.children[0]
    const html = render({ value: {
      code: district.code, provinceCode: province.code, province: province.name,
      cityCode: city.code, city: city.name, districtCode: district.code, district: district.name,
    } })
    expect(html).toContain(province.name)
    expect(html).toContain(city.name)
    expect(html).toContain(district.name)
  })
})
