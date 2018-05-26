/* jshint esnext:true */
const ss = require('simple-statistics');
const chroma = require('chroma-js');
const d3 = require('d3-fetch');

if (typeof fetch !== 'function') {
    // required for testing in node. Annoyingly this fails in browser...
    // global.fetch = require('node-fetch-polyfill');
}

class Choropleth {
    makeColorScale() {
        const vals = this.table.map(row => row[this.tableNumericField]);
        const breaks = this.breaks(vals);
        this.colorScale = chroma
            .scale(this.colorScheme)
            .domain([this.minVal, this.maxVal])
            .classes(breaks);
    }
    makeSource() {
        this.source = {
            type: this.geometryType,
            url: this.geometryUrl
        };
        this.sourceId = 'choropleth';
    }
    makeLayer() {
        const rowToStop = row => [row[this.tableIdField], this.colorScale(row[this.tableNumericField]).hex()];
        this.layerId = 'choropleth';
        this.layer = {
            id: this.layerId,
            type: 'fill',
            source: this.sourceId,
            'source-layer': this.sourceLayer,
            paint: {
                'fill-color': {
                    property: this.geometryIdField,
                    // TODO check if number of geometry rows or table rows is shorter, and use that.
                    stops: this.table.map(rowToStop),
                    type: 'categorical'
                }
            }
        };
    }
    breaks (vals) {
        let bins = ss.ckmeans(vals, Math.min(this.binCount, vals.length));
        this.minVal = bins[0][0];
        this.maxVal = bins[bins.length - 1].slice(-1)[0];
        return [
            bins[0][0], 
            ...bins.map( b => b.slice(-1)[0])
        ];
    }

    checkOptions(options) {
        for (let field of ['geometryUrl','tableUrl','tableIdField','tableNumericField','geometryIdField']) {
            if (!options[field]) throw (field + ' required.');
        }        
        
        Object.assign(this, {
            binCount: 7,
            colorScheme: 'RdBu',
        }, options);

        this.geometryType = this.geometryUrl.match(/\.geojson/) ? 'geojson' : 'vector';

        if (this.geometryType === 'vector' && !this.sourceLayer) throw ('sourceLayer required.');
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
        return this;
    }
    constructor (options) {
        const convertRow = row => (row[this.tablenumericField] = +row[this.tablenumericField], row);
        this.checkOptions(options);
        this.makeSource();
        this.table = d3.csv(this.tableUrl, convertRow)
            .then(table => {
                this.table = table;
                this.makeColorScale();
                this.makeLayer();
            }).catch(e => { throw(e); });
    }    
}
module.exports = Choropleth;