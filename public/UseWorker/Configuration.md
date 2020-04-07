# Feliz.UseWorker - Configuration

## Creating the worker file

To create the worker simply create a new file in 
your project. The module can be opened in your
actual application if you want to be able to run the
code without a worker context, it won't negatively
impact anything. 

You can open namespaces and modules to use in the web
worker, but you need to make sure the module *does not
use any browser APIs or DOM related libraries (like React)!*

If you have code that your worker needs to consume (like the 
domain model for a specific React component) I recommend
moving that code to a more isolated file. This will also help
keep the bundle small.

There are a couple caveats here:
 * Avoid using namespacing in the worker file
 * Do not open any namespaces or modules in the worker
   that require the DOM to function. (e.g. no react libs)

If you do either of the following above *the worker will fail!*

## Packaging the worker with Webpack

A `webpack.config.js` will need to be created in your project with
the following configuration:

```js
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
                            loader: 'babel-loader',
                            options: {
                                presets: [
                                    ['@babel/preset-env', {
                                        modules: false,
                                        // This adds polyfills when needed. Requires core-js dependency.
                                        // See https://babeljs.io/docs/en/babel-preset-env#usebuiltins
                                        // Note that you still need to add custom polyfills if necessary (e.g. whatwg-fetch)
                                        useBuiltIns: 'usage',
                                        corejs: 3
                                    }]
                                ]
                            }
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
```

You should just copy and paste this into your newly created 
`webpack.config.js`. The only items you need to worry about 
once you've done that is the `outputDir` and `workerGlobs`.

You can modify the `createExport` function to change how your worker
is bundled.

By default the library will look for the root of your application
and then try to load the worker from the `/Workers` directory.

### package.json

Setup here is pretty simple, just call webpack with the configuration
file you just made:

```json
{
    ...
    "scripts": {
        "create-workers": "webpack --config docs/webpack.config.js"
    }
    ...
}
```

It is recommended you clean up the directories before each build.

## Calling the worker from your application

Once you've done the above steps all that's left is to create
and run your worker. 

There are two methods of creating and managing your worker:
via Elmish or a React hook.

### React Hook

Creating a worker via the hook is quite simple:

```fs
React.useWorker<unit, int>("Sort.sortNumbers")
```

The points to note here is that you define the input and output 
types when calling `React.useWorker`. These are essentially the
signature of the function you wish to call. In this case
`sortNumbers` is a function that takes `()` and returns an `int`.

The string you provide is the `umd` path to your function. The 
`umd` module will be the *name of your worker.fs*. Then you 
provide the actual function within your `worker.fs` as you defined
it in the file.

What we get back from this is a tuple of which the first value
is the `worker` instance, and the second is the React `state` 
representing the `WorkerStatus`. 

The `worker` instance is an anonymous record exposing three functions:

```fs
exec: unit -> int
kill: unit -> unit
restart: unit -> unit
```

Do note that the `exec` function signature is based on the type 
restrictions applied during creation above.

From this point you can simply call these values like any other
and the worker will handle the rest!

### Elmish

Creating a worker using Elmish is a bit more involved, but still
pretty straightforward. To create the worker you dispatch 
`Cmd.Worker.create` (or `Cmd.Worker.createWithOptions` more on that
below):

```fs
Cmd.Worker.create "Sort.sortNumbers" SetWorker ChangeWorkerState
```

The string you provide is the `umd` path to your function. The 
`umd` module will be the *name of your worker.fs*. Then you 
provide the actual function within your `worker.fs` as you defined
it in the file.

`SetWorker` and `ChangeWorkerState` are part of your `Msg` type, 
with `SetWorker` being the msg to set your worker in your state 
and `ChangeWorkerState` being the msg to set the `WorkerStatus`
in your state.

An example of how your `Msg` could look with corresponding `State`:

```fs
type State =
    { Count: int 
      Worker: Worker<unit,int> option
      WorkerState: WorkerStatus }

type Msg =
    | ChangeWorkerState of WorkerStatus
    | ExecuteWorker
    | KillWorker
    | RestartWorker
    | SetCount of int
    | SetWorker of Worker<unit,int>
    | WorkerResult of int
```

Do note that the type restrictions on `SetWorker` is how you
define the signature of the function you're calling. 

Once you've done this and have a worker you can dispatch a
`Cmd` to send a message to your worker. There are three 
commands:

```fs
Cmd.Worker.exec: (worker: Worker<'Arg,'Result> option) (arg: 'Arg) (msg: 'Result -> 'Msg)
Cmd.Worker.kill: (worker: Worker<'Arg,'Result> option)
Cmd.Worker.restart: (worker: Worker<'Arg,'Result> option)
```

If the worker is `None` the command will be skipped.

From this point on you can simply dispatch a msg from your 
view and the update function will in turn create a `Cmd` to
call the worker.
