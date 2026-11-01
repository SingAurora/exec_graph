import { mainlandRegions } from '../../../entities/profile/model/mainland-regions'
import { useState } from 'react'
import type { ProfileLocation } from '../../../entities/profile/model/types'

type MainlandLocationSelectProps = {
	value?: ProfileLocation
  disabled?: boolean
	onChange: (value?: ProfileLocation) => void
}

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
			<select className="form-input min-w-0" value={provinceCode} disabled={disabled} onChange={(event) => { const next = event.target.value; setProvinceCode(next); setCityCode(''); setDistrictCode(''); onChange(undefined) }}><option value="">省级地区</option>{mainlandRegions.map((province) => <option value={province.code} key={province.code}>{province.name}</option>)}</select>
			<select className="form-input min-w-0" value={cityCode} disabled={disabled || !selectedProvince} onChange={(event) => { const next = event.target.value; setCityCode(next); setDistrictCode(''); onChange(undefined) }}><option value="">城市</option>{(selectedProvince?.children ?? []).map((city) => <option value={city.code} key={city.code}>{city.name}</option>)}</select>
			<select className="form-input min-w-0" value={districtCode} disabled={disabled || !selectedCity} onChange={(event) => emitDistrict(event.target.value)}><option value="">区 / 县</option>{(selectedCity?.children ?? []).map((district) => <option value={district.code} key={district.code}>{district.name}</option>)}</select>
    </div>
  )
}
