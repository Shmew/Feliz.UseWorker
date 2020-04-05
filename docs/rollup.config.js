const glob = require('fast-glob');
const path = require('path');
import cleanup from 'rollup-plugin-cleanup';

const distDir = path.join(__dirname, '../dist/Workers')
const outputDir = path.join(__dirname, '../public/Workers')
const workerGlobs = ['*.js']

const flatten = arr => {
    return arr.reduce(function (flat, toFlatten) {
        return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
    }, []);
}

module.exports = flatten(
    workerGlobs
        .map(pattern => path.join(distDir, pattern).replace(/\\/g, '/'))
        .map(workerGlob => {
            return glob.sync(workerGlob).map(fileName => {
                const options = {
                    input: fileName,
                    output: {
                        dir: outputDir,
                        format: 'umd',
                        preferConst: true,
                        name: path.basename(fileName, path.extname(fileName))
                    },
                    plugins: [
                        cleanup(),
                    ]
                }

                return options
            })
        }))
