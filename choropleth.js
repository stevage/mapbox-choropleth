/* jshint esnext:true */
const ss = require('simple-statistics');
const chroma = require('chroma-js');
const d3 = require('d3-fetch');

if (typeof fetch !== 'function') {
    // required for testing in node. Annoyingly this fails in browser...
    // global.fetch = require('node-fetch-polyfill');
}

class Choropleth {
    breaks (vals) {
        this.bins = ss.ckmeans(vals, Math.min(this.binCount, vals.length))
            .map(bin => [bin[0], bin[bin.length -1]]);
        this.minVal = this.bins[0][0];
        this.maxVal = this.bins[this.bins.length - 1][1];
        return [this.bins[0][0],  ...this.bins.map(b => b[1])];
    }
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
            type: this.geometryType
        };
        if (this.geometryUrl) {
            this.source.url = this.geometryUrl
        } else if (this.geometryTiles) {
            this.source.tiles = this.geometryTiles
        }
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
            paint: Object.assign({}, this.paint, {
                'fill-color': {
                    property: this.geometryIdField,
                    stops: this.table.map(rowToStop),
                    type: 'categorical'
                }
            })
        };
        if (this.layout) {
            this.layer.layout = this.layout;
        }

    }

    checkOptions(options) {
        for (let field of ['tableIdField','tableNumericField','geometryIdField']) {
            if (!options[field]) throw ('"' + field + '" required.');
        }        
        if (!options.tableRows && !options.tableUrl) {
            throw ('"tableRows" or "tableUrl" required.');
        }
        if (!options.geometryTiles && !options.tableTiles) {
            throw ('"geometryTiles" or "geometryTiles" required.');
        }
        Object.assign(this, {
            binCount: 7,
            colorScheme: 'RdBu',
        }, options);

        this.geometryType = (this.geometryUrl || '').match(/\.geojson/) ? 'geojson' : 'vector';
        if (typeof this.legendElement === 'string') {
            this.legendElement = document.querySelectorAll(this.legendElement)[0];
        }

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
            // console.log(this.layer);
            map.addLayer(this.layer);
        };
        const mapReady = cb => map.loaded() ? cb () : map.on('load', cb);
        mapReady( () => Promise.resolve(this.table).then(addTable));
        return this;
    }
    addLegendCSS() {
        let styles = document.createElement('style');
        styles.innerHTML = `
            .choropleth-legend {
                background: white;
                padding: 1em;
                line-height: 0;
                font-family:sans-serif;
                border: 1px solid grey;
            }

            .choropleth-legend-box {
                font-size: 30px;
                margin:0;
                display: inline-block; 
                width: 1em; 
                height: 1em;
            }
            .choropleth-legend-label {
                vertical-align:super;
                font-size:10pt;            
                padding-left:1em;
            }
        `;
        // document.body.appendChild(styles);
        document.head.insertBefore(styles, document.head.firstChild);
    }

    getLegendHTML() {
        const binHTML = bin => {
            let col = `background-color: ${this.colorScale(bin[0]).hex()};`;
            return `<span class="choropleth-legend-box" style="${col}"></span>` +
                `<span class="choropleth-legend-label">${bin[0]}</span><br>`;
                
        };
        return '<div class="choropleth-legend">' +
              this.bins.reverse().map(binHTML).join('\n') +
              '</div>';
    }

    on(event, cb) {
        this._handlers[event].push(cb); 
        return this;
    }

    _fire(event) {
        this._handlers[event].forEach(cb => cb());
    }

    constructor (options) {
        this._handlers = { 'ready': [] };
        const convertRow = row => ( row[this.tableNumericField] = +row[this.tableNumericField], row);
        this.checkOptions(options);
        this.makeSource();
        const tableRows = this.tableRows ? Promise.resolve(this.tableRows) : d3.csv(this.tableUrl, convertRow);
        this.table = tableRows
            .then(table => {
                this.table = table;
                this.makeColorScale();
                this.makeLayer();
                if (this.legendElement) {
                    this.addLegendCSS();
                    this.legendElement.innerHTML = this.getLegendHTML();
                }
                this._fire('ready');
            }).catch(e => { throw(e); });
    }    
}
module.exports = Choropleth;