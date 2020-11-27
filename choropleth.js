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
    _getColorScale() {
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
        return chroma
            .scale(this.colorScheme)
            .domain([this.minVal, this.maxVal])
            .classes(breaks);
    }
    _getSourceDef() {
        const sourceDef = {
            type: this.geometryType,
        };
        if (this.geometryType === 'geojson') {
            sourceDef.data = this.geometryUrl;
        } else {
            if (this.geometryUrl) {
                sourceDef.url = this.geometryUrl;
            } else if (this.geometryTiles) {
                sourceDef.tiles = this.geometryTiles;
            }
        }
        this.sourceId = this.sourceId || 'choropleth';
        return { ...sourceDef, ...this.source };
    }
    _getFillColorProp() {
        const rowToStop = (row) => [
            row[this.tableIdField],
            this.colorScale(toNumber(row[this.tableNumericField])).hex(),
        ];
        if (this.useFeatureState) {
            return [
                'to-color',
                ['feature-state', 'choroplethColor'],
                'transparent',
            ];
        }
        return [
            'match',
            this.useFeatureId
                ? ['id']
                : ['to-string', ['get', this.geometryIdField]], // TODO what are we doing about numeric ids?
            ...flatten(
                this.table
                    .filter((row) =>
                        Number.isFinite(toNumber(row[this.tableNumericField])),
                    )
                    .map(rowToStop),
            ),
            'transparent', // TODO option for non-numeric values?
        ];
    }
    _getLayerDef() {
        const fillColorProp = this._getFillColorProp();
        if (this.debug) {
            console.log(fillColorProp);
        }

        const layer = {
            id: this.layerId,
            type: 'fill',
            source: this.sourceId,
            paint: Object.assign({}, this.paint, {
                'fill-color': fillColorProp,
            }),
            layout: Object.assign({}, this.layout),
        };
        if (this.geometryType === 'vector') {
            layer['source-layer'] = this.sourceLayer;
        }
        return layer;
    }
    /* After initialisation, set rows directly */
    setRows(rows) {
        this.table = rows;
        this.colorScale = this._getColorScale();
        this.legendElement.innerHTML = this.getLegendHTML();
        this._map.setPaintProperty(
            this.layerId,
            'fill-color',
            this._getFillColorProp(),
        );
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
                        toNumber(row[this.tableNumericField]),
                    ).hex(),
                },
            );
        }
    }

    addTo(map) {
        const onMapStyleLoaded = (fn) => {
            // It seems to be so hard to reliably add a layer without hitting a 'style not ready' error.
            if (this.immediate) {
                fn();
            } else if (map.isStyleLoaded()) {
                const nextFn = () => window.setTimeout(fn, 0);
                nextFn();
            } else {
                map.once('style.load', fn);
            }
        };
        const addLayer = () => {
            if (map.getLayer(this.layerId)) {
                map.removeLayer(this.layerId);
            }
            if (map.getSource(this.sourceId)) {
                map.removeSource(this.sourceId);
            }
            map.addSource(this.sourceId, this.sourceDef);
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

        this._map = map;

        onMapStyleLoaded(() => Promise.resolve(this.table).then(addLayer));
        return this;
    }
    remove() {
        if (this._map) {
            if (this._map.getLayer(this.layerId)) {
                this._map.removeLayer(this.layerId);
            }
            if (this._map.getSource(this.sourceId)) {
                this._map.removeSource(this.sourceId);
            }
        }
        if (this.legendElement) {
            if (this._stylesElement) {
                this._stylesElement.parentNode.removeChild(this._stylesElement);
            }
            this.legendElement.innerHTML = '';
        }
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
            options,
        );

        this.geometryType = (this.geometryUrl || '').match(/\.geojson/)
            ? 'geojson'
            : 'vector';
        if (typeof this.legendElement === 'string') {
            this.legendElement = document.querySelectorAll(
                this.legendElement,
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
        this.colorScale = this._getColorScale();
        if (this.debug) {
            console.log(this.bins);
        }
        this.layer = this._getLayerDef();
        if (this.legendElement) {
            this._stylesElement = document.createElement('style');
            this._stylesElement.innerHTML = legend.getCSS();
            document.head.insertBefore(
                this._stylesElement,
                document.head.firstChild,
            );
            this.legendElement.innerHTML = this.getLegendHTML();
        }
        this._fire('ready');
    }

    constructor(options) {
        this._handlers = { ready: [] };
        this.checkOptions(options);
        this.bins = [];
        this.sourceDef = this._getSourceDef();
        this.table = this._load(); // make .table a promise then later a value
    }
}
module.exports = Choropleth;
