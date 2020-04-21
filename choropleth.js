const ss = require('simple-statistics');
const chroma = require('chroma-js');
const d3 = require('d3-fetch');
const legend = require('./legend');
const flatten = (a) => a.reduce((a, [b, c]) => [...a, b, c], []);
if (typeof fetch !== 'function') {
    // required for testing in node. Annoyingly this fails in browser...
    // global.fetch = require('node-fetch-polyfill');
}

function toNumber(x) {
    if (x === '' || x === ' ') {
        return null;
    } else {
        return +x;
    }
}

class Choropleth {
    makeColorScale() {
        const getBreaks = (vals) => {
            this.bins = ss
                .ckmeans(vals, Math.min(this.binCount, vals.length))
                .map((bin) => [bin[0], bin[bin.length - 1]]);
            this.minVal = this.bins[0][0];
            this.maxVal = this.bins[this.bins.length - 1][1];
            return [this.bins[0][0], ...this.bins.map((b) => b[1])];
        };
        const vals = this.table
            .map((row) => toNumber(row[this.tableNumericField]))
            .filter(Number.isFinite);
        const breaks = getBreaks(vals);
        this.colorScale = chroma
            .scale(this.colorScheme)
            .domain([this.minVal, this.maxVal])
            .classes(breaks);
    }
    makeSource() {
        const sourceProp = this.source;
        this.source = {
            type: this.geometryType,
        };
        if (this.geometryType === 'geojson') {
            this.source.data = this.geometryUrl;
        } else {
            if (this.geometryUrl) {
                this.source.url = this.geometryUrl;
            } else if (this.geometryTiles) {
                this.source.tiles = this.geometryTiles;
            }
        }
        this.sourceId = this.sourceId || 'choropleth';
        Object.assign(this.source, sourceProp);
    }
    makeLayer() {
        const rowToStop = (row) => [
            row[this.tableIdField],
            this.colorScale(toNumber(row[this.tableNumericField])).hex(),
        ];
        let fillColorProp;
        if (this.useFeatureState) {
            fillColorProp = [
                'to-color',
                ['feature-state', 'choroplethColor'],
                'transparent',
            ];
        } else {
            fillColorProp = [
                'match',
                this.useFeatureId
                    ? ['id']
                    : ['to-string', ['get', this.geometryIdField]], // TODO what are we doing about numeric ids?
                ...flatten(
                    this.table
                        .filter((row) =>
                            Number.isFinite(
                                toNumber(row[this.tableNumericField])
                            )
                        )
                        .map(rowToStop)
                ),
                'transparent', // TODO option for non-numeric values?
            ];
        }
        if (this.debug) {
            console.log(fillColorProp);
        }
        this.layer = {
            id: this.layerId,
            type: 'fill',
            source: this.sourceId,
            paint: Object.assign({}, this.paint, {
                'fill-color': fillColorProp,
            }),
            layout: Object.assign({}, this.layout),
        };
        console.log(this.layer.paint);
        if (this.geometryType === 'vector') {
            this.layer['source-layer'] = this.sourceLayer;
        }
    }

    setFeatureStates(map) {
        for (let row of this.table) {
            map.setFeatureState(
                {
                    id: +row[this.tableIdField],
                    source: this.sourceId,
                    ...(this.sourceLayer
                        ? { sourceLayer: this.sourceLayer }
                        : {}),
                },
                {
                    choroplethColor: this.colorScale(
                        toNumber(row[this.tableNumericField])
                    ).hex(),
                }
            );
        }
    }

    addTo(map) {
        const onMapStyleLoaded = (fn) => {
            const nextFn = () => process.nextTick(fn);
            map.isStyleLoaded() ? nextFn() : map.once('styledata', nextFn);
        };
        const addLayer = () => {
            if (map.getSource(this.sourceId)) {
                map.removeSource(this.sourceId);
            }
            if (map.getLayer(this.layerId)) {
                map.removeLayer(this.layerId);
            }
            map.addSource(this.sourceId, this.source);
            if (this.before) {
                map.addLayer(this.layer, this.before);
            } else {
                map.addLayer(this.layer);
            }
            if (this.useFeatureState) {
                map.once('data', () => {
                    this.setFeatureStates(map);
                });
            }
        };

        onMapStyleLoaded(() => Promise.resolve(this.table).then(addLayer));
        return this;
    }

    getLegendHTML() {
        return legend.getHTML(this);
    }

    on(event, cb) {
        this._handlers[event].push(cb);
        return this;
    }

    _fire(event) {
        this._handlers[event].forEach((cb) => cb());
    }

    checkOptions(options) {
        if (!options.tableIdField) {
            throw '"tableIdField" required';
        }
        if (!options.tableNumericField) {
            throw '"tableNumericField" required';
        }
        if (!options.geometryIdField && !options.useFeatureId) {
            throw '"geometryIdField" or "useFeatureId" required.';
        }

        if (options.useFeatureState && !options.useFeatureId) {
            throw '"useFeatureState" requires "useFeatureId"';
        }

        if (!options.tableRows && !options.tableUrl) {
            throw '"tableRows" or "tableUrl" required.';
        }
        if (!options.geometryTiles && !options.geometryUrl) {
            throw '"geometryTiles" or "geometryUrl" required.';
        }
        Object.assign(
            this,
            {
                binCount: 7,
                colorScheme: 'RdBu',
                layerId: 'choropleth',
                numberFormatFunc: (x) => x.toFixed(1),
            },
            options
        );

        this.geometryType = (this.geometryUrl || '').match(/\.geojson/)
            ? 'geojson'
            : 'vector';
        if (typeof this.legendElement === 'string') {
            this.legendElement = document.querySelectorAll(
                this.legendElement
            )[0];
        }

        if (this.geometryType === 'vector' && !this.sourceLayer)
            throw 'sourceLayer required.';
    }

    async _load() {
        const convertRow = (row) => {
            row[this.tableNumericField] = +row[this.tableNumericField];
            if (this.useFeatureId) {
                row[this.tableIdField] = +row[this.tableIdField];
            }
            return row;
        };
        const table = await (this.tableRows
            ? this.tableRows
            : d3.csv(this.tableUrl, convertRow));
        this.table = table;
        if (this.debug) {
            console.log(this.table);
        }
        this.makeColorScale();
        if (this.debug) {
            console.log(this.bins);
        }
        this.makeLayer();
        if (this.legendElement) {
            let styles = document.createElement('style');
            styles.innerHTML = legend.getCSS();
            document.head.insertBefore(styles, document.head.firstChild);
            this.legendElement.innerHTML = this.getLegendHTML();
        }
        this._fire('ready');
    }

    constructor(options) {
        this._handlers = { ready: [] };
        this.checkOptions(options);
        this.bins = [];
        this.makeSource();
        this.table = this._load(); // make .table a promise then later a value
    }
}
module.exports = Choropleth;
