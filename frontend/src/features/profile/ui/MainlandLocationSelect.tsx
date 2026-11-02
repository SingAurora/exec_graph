import { useState } from 'react'
import { mainlandRegions } from '../../../entities/profile/model/mainland-regions'
import type { ProfileLocation } from '../../../entities/profile/model/types'
import { Select } from '../../../shared/ui/select/Select'

type MainlandLocationSelectProps = {
  value?: ProfileLocation
  disabled?: boolean
  onChange: (value?: ProfileLocation) => void
}

// Radix Select 不允许空字符串作为 item value，用独立哨兵表示“未选择/清空”；真实区划代码都是六位数字。
const noneValue = '__none__'
const locationSelectClass = '!h-10 !min-w-0 w-full !border !border-line !bg-surface !px-3 !text-sm !font-normal'

/** 中国大陆省、市、区县三级选择器；保存值始终是最终区县代码。 */
export function MainlandLocationSelect({ value, disabled = false, onChange }: MainlandLocationSelectProps) {
  const [provinceCode, setProvinceCode] = useState(value?.provinceCode ?? '')
  const [cityCode, setCityCode] = useState(value?.cityCode ?? '')
  const [districtCode, setDistrictCode] = useState(value?.districtCode ?? '')
  const selectedProvince = mainlandRegions.find((item) => item.code === provinceCode)
  const selectedCity = selectedProvince?.children.find((item) => item.code === cityCode)
  const emitDistrict = (nextDistrictCode: string) => {
    setDistrictCode(nextDistrictCode)
    const district = selectedCity?.children.find((item) => item.code === nextDistrictCode)
    if (!district || !selectedProvince || !selectedCity) {
      onChange(undefined)
      return
    }
    onChange({ code: district.code, provinceCode: selectedProvince.code, province: selectedProvince.name, cityCode: selectedCity.code, city: selectedCity.name, districtCode: district.code, district: district.name })
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      <Select label="省份" className={locationSelectClass} value={provinceCode || noneValue} disabled={disabled}
        options={[{ value: noneValue, label: '省份' }, ...mainlandRegions.map((province) => ({ value: province.code, label: province.name }))]}
        onValueChange={(next) => {
          const code = next === noneValue ? '' : next
          setProvinceCode(code); setCityCode(''); setDistrictCode(''); onChange(undefined)
        }} />
      <Select label="城市" className={locationSelectClass} value={cityCode || noneValue}
        disabled={disabled || !selectedProvince}
        options={[{ value: noneValue, label: '城市' }, ...(selectedProvince?.children ?? []).map((city) => ({ value: city.code, label: city.name }))]}
        onValueChange={(next) => {
          const code = next === noneValue ? '' : next
          setCityCode(code); setDistrictCode(''); onChange(undefined)
        }} />
      <Select label="区县" className={locationSelectClass} value={districtCode || noneValue}
        disabled={disabled || !selectedCity}
        options={[{ value: noneValue, label: '区县' }, ...(selectedCity?.children ?? []).map((district) => ({ value: district.code, label: district.name }))]}
        onValueChange={(next) => emitDistrict(next === noneValue ? '' : next)} />
    </div>
  )
}
