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
 * Avoid using namespacing in the worker file.
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
// MyWorker.fs
module MyWorker

open Feliz.UseWorker

// The function does not need to be inlined
let myFunction = WorkerFunc("MyWorker","myFunction", fun () -> 1)
```

```fs
let worker,workerStatus = React.useWorker(MyWorker.myFunction)
```

The two strings you provide is the `umd` path to your function. The first
is the umd module, which will be the *name of your worker.fs* by default. 
Then you provide name of the binding to your `WorkerFunc`, and then the 
function you want to call.

What we get back from the hook is a tuple of which the first value
is the `worker` instance, and the second is the React `state` 
representing the `WorkerStatus`. 

The `worker` instance is a `WorkerCommands<'Arg,'Result>` which exposes
three functions:

```fs
exec: 'Arg -> 'Result
kill: unit -> unit
restart: unit -> unit
```

Do note that the `exec` function signature is the same as your provided 
function.

From this point, you can simply call these values like any other
and the worker will handle the rest!

### Elmish

Creating a worker using Elmish is a bit more involved, but still
pretty straightforward. To create the worker you dispatch use
`Cmd.Worker.create` or `Cmd.Worker.createWithOptions` to modify 
default behavior:

```fs
// MyWorker.fs
module MyWorker

open Feliz.UseWorker

// The function does not need to be inlined
let myFunction = WorkerFunc("MyWorker","myFunction", fun () -> 1)
```

```fs
Cmd.Worker.create MyWorker.myFunction SetWorker ChangeWorkerState
```

The two strings you provide is the `umd` path to your function. The first
is the umd module, which will be the *name of your worker.fs* by default. 
Then you provide name of the binding to your `WorkerFunc`, and then the 
function you want to call.

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

Keep in mind that when using the elmish versions this worker will *not
automatically dispose of itself if it goes out of scope!* You will need
to kill your worker manually.

It is *strongly recommended* that you use [Feliz.ElmishComponents] when 
your worker is not used globally or your state is not persistent.

If you're using [Feliz.ElmishComponents] then you can interface `System.IDisposable` 
in your state (aka model) and the `React.elmishComponent` will automatically dispose
the state when the component is unmounted. 

What this means is you can do this:

```fs
type State =
    { Count: int 
      Worker: Worker<unit,int> option
      WorkerState: WorkerStatus }

    interface System.IDisposable with
        member this.Dispose () =
            this.Worker |> Option.iter (fun w -> w.Dispose())
```

Once you've done this and have a worker, you can dispatch a
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

[Feliz.ElmishComponents]: https://zaid-ajaj.github.io/Feliz/#/Ecosystem/ElmishComponents