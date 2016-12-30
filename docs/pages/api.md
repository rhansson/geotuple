---
layout: page
title: API
tagline: experimental
description: api
---

GeoTuple provides an API (HTTP GET/POST requests) for querying the database and return data in JSON format.

```
It is the goal of this project to add and improve the capabilities over time.
```

### API Endpoints
The following calls area available:

Method | Arguments | Returns
------ | --------- | -------
api_getthemes | | Available themes
api_getthemeprops | theme | Properties for the specified theme
api_getpoint | longitude, latitude, theme1 .. n, API_KEY | Data values* for the specified theme(s)
 | |  * a single point closest to the specified location
 
##### _**Get a temporary API Key**_

1. Launch the [GeoTuple app](http://geotuple.com){:target="_blank"}
2. Select "Get an API Key" from the menu in the top right of the window
  ![](/pages/get_api_key.png)

3. Copy the code displayed at the top left of the window (valid for a maximum of 24h)
  ![](/pages/copy_api_key.png)

> _**Please limit your requests to < 3/min**_

#### Examples
Results are returned within [ ]. If invalid request or an error occurs an empty result is returned.
_Notice that curl is used for illustration only, any HTTP client will do._


```
# Available themes
curl -X POST http://geotuple.com/ocpu/user/rolandhhansson/library/geotuple/R/api_getthemes/json -H "Content-Type: application/json"
#
# returns:
[
  {
    "name": "landcov",
    "descr": "Land Cover"
  },
  {
    "name": "dist_mroad",
    "descr": "Distance from Major Roads"
  },
  {
    "name": "pop_dens",
    "descr": "Population Density"
  },
  {
    "name": "inc_percap",
    "descr": "Income per Capita"
  },
  {
    "name": "z",
    "descr": "Elevation"
  },
  {
    "name": "dist_starb",
    "descr": "Distance from Starbucks"
  }
]
```

```
# Properties for theme "z"
curl http://geotuple.com/ocpu/user/rolandhhansson/library/geotuple/R/api_getthemeprops/json \
 -H "Content-Type: application/json" \
 -d '{"theme":"z"}'
 #
 # returns:
 [
  {
    "descr": "Elevation",
    "type": "discrete",
    "units": "meters",
    "is_dist": false,
    "min": -58,
    "max": 3432,
    "avg": 610.386
  }
]
```

```
# Data for theme "z"
# Replace YOUR_API_KEY with the code copied above
# "dist" is the distance to the database point (returned) closest to the specified location
curl http://geotuple.com/ocpu/user/rolandhhansson/library/geotuple/R/api_getpoint/json \
 -H "Content-Type: application/json" \
 -d '{"lon":"-121.494", "lat":"38.577", "themes":"z", "key":"YOUR_API_KEY"}'
 #
 # returns:
 [
  {
    "dist": 103,
    "z": 25
  }
]
```

```
# Data for themes "z" and "inc_percap"
# Replace YOUR_API_KEY
# "dist" is the distance to the database point (returned) closest to the specified location
curl http://geotuple.com/ocpu/user/rolandhhansson/library/geotuple/R/api_getpoint/json \
 -H "Content-Type: application/json" \
 -d '{"lon":"-121.494", "lat":"38.577", "themes":["z", "inc_percap"], "key":"YOUR_API_KEY"}'
 #
 # returns:
 [
  {
    "dist": 103,
    "z": 25,
    "inc_percap": 30019
  }
]

```

```
# Data for all themes
# Replace YOUR_API_KEY 
# "dist" is the distance to the database point (returned) closest to the specified location
curl http://geotuple.com/ocpu/user/rolandhhansson/library/geotuple/R/api_getpoint/json \
 -H "Content-Type: application/json" \
 -d '{"lon":"-121.494", "lat":"38.577", "themes":"*", "key":"YOUR_API_KEY"}'
 #
 # returns:
 [
  {
    "dist": 103,
    "landcov": 23,
    "dist_mroad": 574,
    "pop_dens": 841,
    "inc_percap": 30019,
    "z": 25,
    "dist_starb": 342
  }
]
```

> YOU EXPRESSLY UNDERSTAND AND AGREE THAT YOUR USE OF THE SERVICE AND THE CONTENT IS AT YOUR SOLE RISK AND THAT THE SERVICE AND THE CONTENT ARE PROVIDED "AS IS" AND "AS AVAILABLE."

