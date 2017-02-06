---
layout: page
title: Database
description: database
---

The database, behind GeoTuple, stores quantitative geospatial information as points (gridded), thematically organized in a PostGIS (PostgreSQL) database. The data is derived from publicly available sources into a uniform spatial resolution ranging from 250 meters for populated areas to 2 km for remote areas such as desert and mountain areas. 
The data is progressively aggregated to effectively suit larger areas (lower resolutions), without the typical restrictions of fixed boundaries such as census units. 

_Currently, data is available for the state of California, USA._

```
It is the goal of this project to expand both the area and the number of themes over time.
```

### Data Layers
The following data layers (themes) are provided as of Feb 6, 2017:

Theme | Title | Description | Time Period | Units | Source | Credit
----- | ----- | ----------- | ----------- | ----- | ------ | ------
Elevation | Global Multi-resolution Terrain Elevation Data 2010 | | | meters | [U.S. Geological Survey (EROS) Center](https://lta.cr.usgs.gov/GMTED2010){:target="_blank"} | Danielson, J.J., and Gesch, D.B., 2011
Land Cover | National Land Cover Database 2011 | | 2011 | Type | [MRLC Consortium](http://www.mrlc.gov/nlcd2011.php){:target="_blank"} | 
Population Density | | Derived from census block and block group summary files | 2010 | p/sqkm | [US Census Bureau](http://census.gov/data.html){:target="_blank"} | National Historical Geographic Information System ([NHGIS](https://www.nhgis.org){:target="_blank"})*1
Income Per Capita | | Derived from census block group summary files and weighted by population density | 2010 | USD | [US Census Bureau](http://census.gov/data.html){:target="_blank"} | National Historical Geographic Information System ([NHGIS](https://www.nhgis.org){:target="_blank"})*1
Race White | | Derived from census block and block group summary files and weighted by population density | 2010 | % | [US Census Bureau](http://census.gov/data.html){:target="_blank"} | National Historical Geographic Information System ([NHGIS](https://www.nhgis.org){:target="_blank"})*1
Distance from Major Roads | California Enhanced National Highway System (NHS) | | 2012 | meters | [California Department of Transportation (Caltrans)](http://www.dot.ca.gov/hq/tsip/gis/datalibrary/){:target="_blank"} | 
Distance from Starbucks | | | 2016 | meters | [Starbucks Corp. / Socrata](https://opendata.socrata.com/Business/All-Starbucks-Locations-in-the-World/xy4y-c4mk){:target="_blank"} | Chris Meller @chrismeller
CalEnviroScreen 3.0 | California Communities Environmental Health Screening Tool | Derived from census tracts | 2017 | score | [California Office of Environmental Health Hazard Assessment (OEHHA)](http://oehha.ca.gov/calenviroscreen){:target="_blank"} | 

*1 Minnesota Population Center. National Historical Geographic Information System: Version 2.0. Minneapolis, MN: University of Minnesota 2011.

>Data displayed or made available on any GeoTuple website are governed by the terms of service or other applicable contract by their respective provider.


