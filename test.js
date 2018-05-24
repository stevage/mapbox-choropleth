let mapboxgl = require('mapbox-gl');
mapboxgl.accessToken = 'pk.eyJ1Ijoic3RldmFnZSIsImEiOiJGcW03aExzIn0.QUkUmTGIO3gGt83HiRIjQw';
window.map = new mapboxgl.Map({
    container: 'map', // container id
    style: 'mapbox://styles/mapbox/streets-v9', // stylesheet location
    center: [140, -30], // starting position [lng, lat]
    zoom: 5 // starting zoom
});

let Choropleth = require('./choropleth');

let c = new Choropleth({ 
    // table: 'https://raw.githubusercontent.com/mapbox/csv2geojson/gh-pages/test/data/line.csv',
    table: 'https://gist.githubusercontent.com/stevage/088fd8edab66157e1a307f521e38ecca/raw/46d01d54a7d95cac1ad88347aa910b5de3946b3e/elb.csv',
    // geometry: 'https://raw.githubusercontent.com/mapbox/csv2geojson/gh-pages/test/data/minutes.geojson',
    numericCol: 'Australian Labor Party Percentage',
    tableId: 'DivisionNm',
    geometry: 'mapbox://stevage.7ux6xzbz',
    geometryId: 'ELECT_DIV',
    sourceLayer: 'ELB',
    binCount: 20,
    colorScheme: 'Spectral'
 }).addTo(map);
// c.table.then(() => console.log(c.layer));

