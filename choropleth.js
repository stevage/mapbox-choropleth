/*
let choro = new Choropleth({
    table: 'mydata.csv', // CSV url. Or array of [{col1: val, col2: val}, ...]

    geometry: 'boundaries.geojson', // GeoJSON URL, mapbox:// URL, or { source: 'mysource', sourceLayer: 'lga-boundaries'}
    tableId: 'boundary_id', // column name in table
    geometryId: 'id',
    numericCol: 'val',
    binMethod: 'ckmeans',
    binCount: 7,
    colorScale: 'OrRd' // Any string/array accepted by chroma.scale, including Color Brewer identifiers.
}).addTo(map);


*/
/* jshint esnext:true */

const ss = require('simple-statistics');
const chroma = require('chroma-js');
function bins(vals, binCount) {
    return ss.ckmeans(vals, Math.min(binCount, vals.length))
        .map(vals => ({
            min: ss.min(vals),
            max: ss.max(vals)
        }));
}

if (typeof fetch !== 'function') {
    // global.fetch = require('node-fetch-polyfill');
}
const d3 = require('d3-fetch');
class Choropleth {
    makeColorScale() {
        const vals = this.table.map(row => row[this.options.numericCol]);
        // const vals = [7,5,3,9,8,8,7,6,10];
        const breaks = this.breaks(vals);
        // console.log(breaks);
        this.colorScale = chroma
            .scale(this.options.colorScheme)
            .domain([this.minVal, this.maxVal])
            .classes(breaks);
            
        // con sole.log(vals.map(v => this.colorScale(v).hsl()));
    }
    makeSource(geometry) {
        if (geometry.match (/\.geojson$/)) {
            this.source = {
                type: 'geojson', 
                url: geometry
            };
        } else {
            this.source = {
                type: 'vector',
                url: geometry
            };
        }
        this.sourceId = 'choropleth';
    }
    makeLayer() {
        const rowToStop = row => [row[this.options.tableId], this.colorScale(row[this.options.numericCol]).hex()];
        this.layerId = 'choropleth';
        this.layer = {
            id: this.layerId,
            type: 'fill',
            source: this.sourceId,
            'source-layer': this.options.sourceLayer,
            paint: {
                'fill-color': {
                    property: this.options.geometryId,
                    // TODO check if number of geometry rows or table rows is shorter, and use that.
                    stops: this.table.map(rowToStop),
                    type: 'categorical'
                }
            }

        };
    }
    breaks (vals) {
        let bins = ss.ckmeans(vals, Math.min(this.options.binCount, vals.length));
        this.minVal = bins[0][0];
        this.maxVal = bins[bins.length - 1].slice(-1)[0];
        return [
            bins[0][0], 
            ...bins.map( b => b.slice(-1)[0])
        ];
    }

    checkOptions(options) {
        this.options = Object.assign({
            binCount: 7,
            colorScheme: 'OrRd',
        }, options);
        // TODO validate
        // table must exist...
        // check sourceLayer if geometry is a mapbox://
    }
    addTo(map) {
        const addTable = table => {
            if (map.getSource(this.sourceId)) {
                map.removeSource(this.sourceId);
            }
            if (map.getLayer(this.layerId)) {
                map.removeLayer(this.layerId);
            }
            map.addSource(this.sourceId, this.source);
            console.log(this.layer);
            map.addLayer(this.layer);
        };
        const mapReady = cb => map.loaded() ? cb () : map.on('load', cb);
        mapReady( () => Promise.resolve(this.table).then(addTable));
    }
    constructor (options) {
        this.checkOptions(options);
        const convertRow = row => {
            row[this.options.numericCol] = +row[this.options.numericCol];
            return row;
        };
        let tableP, geometryP;
        this.makeSource(this.options.geometry);
        this.table = d3.csv(this.options.table, convertRow)
        .then(table => {
            this.table = table;
            this.makeColorScale();
            this.makeLayer();
        })
        .catch(e => { throw(e) });//console.error)
    }
    
}
module.exports = Choropleth;