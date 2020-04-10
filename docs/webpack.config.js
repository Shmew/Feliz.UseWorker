const glob = require('fast-glob');
const path = require('path');

// Where to place the worker files
const outputDir = path.join(__dirname, '../public/Workers')
// Path from the current directory to worker source code
const workerGlobs = ['Workers/*.fs']

const flatten = arr => {
    return arr.reduce(function (flat, toFlatten) {
        return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
    }, []);
}

const createExport = fileName => {
    const options =
        {
            entry: fileName,
            output: {
                path: outputDir,
                filename: path.basename(fileName).replace(/\.fs(x)?$/, '.js'),
                library: path.basename(fileName, path.extname(fileName)),
                libraryTarget: 'umd'
            },
            mode: 'production',
            devtool: 'source-map',
            resolve: {
                // See https://github.com/fable-compiler/Fable/issues/1490
                symlinks: false
            },
            module: {
                rules: [
                    {
                        test: /\.fs(x|proj)?$/,
                        use: {
                            loader: 'fable-loader',
                            options: {
                                allFiles: true,
                                define: []
                            }
                        }
                    },
                    {
                        test: /\.js$/,
                        exclude: /node_modules/,
                        use: {
                            loader: 'babel-loader'
                        }
                    }
                ]
            },
            target: 'webworker'
        }
    return options
}

module.exports = flatten(
    workerGlobs
        .map(pattern => path.join(__dirname, pattern).replace(/\\/g, '/'))
        .map(workerGlob => glob.sync(workerGlob).map(createExport))
)
