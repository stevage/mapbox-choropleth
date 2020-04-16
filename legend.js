function getCSS() {
    return `
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
}

function getHTML(choropleth) {
    const binHTML = (bin) => {
        let col = `background-color: ${choropleth.colorScale(bin[0]).hex()};`;
        return (
            `<span class="choropleth-legend-box" style="${col}"></span>` +
            `<span class="choropleth-legend-label">${choropleth.numberFormatFunc(
                bin[0]
            )}</span><br>`
        );
    };
    return (
        '<div class="choropleth-legend">' +
        choropleth.bins.reverse().map(binHTML).join('\n') +
        '</div>'
    );
}

module.exports = { getCSS, getHTML };
