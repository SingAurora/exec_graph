import { useState } from 'react'
import { mainlandRegions } from '../../../entities/profile/model/mainland-regions'
import type { ProfileLocation } from '../../../entities/profile/model/types'
import { Select } from '../../../shared/ui/select/Select'

type MainlandLocationSelectProps = {
  value?: ProfileLocation
  disabled?: boolean
  onChange: (value?: ProfileLocation) => void
}

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
  const clear = () => {
    setProvinceCode(''); setCityCode(''); setDistrictCode(''); onChange(undefined)
  }
  return (
    <div className="grid gap-1">
      <div className="grid grid-cols-3 gap-2">
        <Select label="省份" placeholder="省份" className={locationSelectClass} value={provinceCode || undefined} disabled={disabled}
          options={mainlandRegions.map((province) => ({ value: province.code, label: province.name }))}
          onValueChange={(next) => {
            setProvinceCode(next); setCityCode(''); setDistrictCode(''); onChange(undefined)
          }} />
        <Select label="城市" placeholder="城市" className={locationSelectClass} value={cityCode || undefined}
          disabled={disabled || !selectedProvince}
          options={(selectedProvince?.children ?? []).map((city) => ({ value: city.code, label: city.name }))}
          onValueChange={(next) => {
            setCityCode(next); setDistrictCode(''); onChange(undefined)
          }} />
        <Select label="区县" placeholder="区县" className={locationSelectClass} value={districtCode || undefined}
          disabled={disabled || !selectedCity}
          options={(selectedCity?.children ?? []).map((district) => ({ value: district.code, label: district.name }))}
          onValueChange={(next) => emitDistrict(next)} />
      </div>
      {selectedProvince && <button className="text-button justify-self-start" type="button" disabled={disabled} onClick={clear}>清除所在地</button>}
    </div>
  )
}
