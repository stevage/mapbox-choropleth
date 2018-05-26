## Mapbox-choropleth

Creates choropleth layers for Mapbox-GL-JS maps. A choropleth (sometimes called a heatmap) is a type of data visualisation where polygons (typically administrative boundaries such as states) are coloured to represent a numeric quantity (such as population). 

This library combines a CSV file and a boundary source (GeoJSON or Mapbox vector tiles) to create a `fill` layer in your Mapbox-GL-JS map.

It uses: 

* D3-csv to fetch and parse the CSV file
* SimpleStatistics.ckmean to generate colour "bins"
* Chroma.JS to assign a colour palette

### Usage

```
const Choropleth = require('./choropleth');

let c = new Choropleth({ options }).addTo(map);
```

#### Required options

```
    tableUrl:           // URL of a CSV file that contains your table data.
    tableNumericField:  // Name of the column in the CSV file that contains the numeric quantity to be visualised
    tableIdField:       // Name of the column in the CSV file that contains boundary identifiers
    geometryUrl:        // Either a mapbox:// vector tile URL, or a URL of a GeoJSON file containing the boundary geometry.
    geometryIdField:    // Name of the attribute in the CSV file that contains the same boundary identifiers as tableIdField
    sourceLayer:        // If using a vector tile source, the source layer to use.
```

#### Optional options

```
    binCount:           // Number of distinct colour bins to use.
    colorScheme:        // Any color scheme identifier accepted by [chroma.scale()](https://gka.github.io/chroma.js/#chroma-scale), including [Color Brewer](http://colorbrewer2.org/) names ("BuGn", "Spectral") and arrays (['blue', 'white', 'red']).
```

#### Example

```
const Choropleth = require('./choropleth');
let c = new Choropleth({ 
    tableUrl: 'https://gist.githubusercontent.com/stevage/088fd8edab66157e1a307f521e38ecca/raw/46d01d54a7d95cac1ad88347aa910b5de3946b3e/elb.csv',
    tableNumericField: 'Australian Labor Party Percentage',
    tableIdField: 'DivisionNm',
    geometryUrl: 'mapbox://stevage.7ux6xzbz',
    geometryIdField: 'ELECT_DIV',
    sourceLayer: 'ELB',
    binCount: 20,
    colorScheme: 'Spectral'
 }).addTo(map);
```

## Credits

Author: [Steve Bennett](https://github.com/stevage)
