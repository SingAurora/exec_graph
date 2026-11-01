// Package location 提供中国大陆省、市、区县行政区划的本地校验与名称解析。
package location

import (
	_ "embed"
	"encoding/json"
)

// Region 是行政区划树中的一层节点。
type Region struct {
	Code     string   `json:"code"`
	Name     string   `json:"name"`
	Children []Region `json:"children"`
}

// Location 是一个完整的省、市、区县地址。
type Location struct {
	Code         string `json:"code"`
	ProvinceCode string `json:"provinceCode"`
	Province     string `json:"province"`
	CityCode     string `json:"cityCode"`
	City         string `json:"city"`
	DistrictCode string `json:"districtCode"`
	District     string `json:"district"`
}

//go:embed mainland-regions.json
var regionData []byte

var regions = loadRegions()

func loadRegions() []Region {
	var value []Region
	if err := json.Unmarshal(regionData, &value); err != nil {
		panic("行政区划数据无效: " + err.Error())
	}
	return value
}

// Lookup 根据六位区县代码解析完整地址；空代码和未知代码均返回 false。
func Lookup(code string) (Location, bool) {
	for _, province := range regions {
		for _, city := range province.Children {
			for _, district := range city.Children {
				if district.Code == code {
					return Location{Code: district.Code, ProvinceCode: province.Code, Province: province.Name, CityCode: city.Code, City: city.Name, DistrictCode: district.Code, District: district.Name}, true
				}
			}
		}
	}
	return Location{}, false
}
