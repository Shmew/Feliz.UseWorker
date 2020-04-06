# Feliz.UseWorker - API Reference

## WorkerStatus

This is a discriminated union that represents
the possible states that the worker can be in:

```fs
/// The status of a web worker instance.
[<RequireQualifiedAccess>]
type WorkerStatus =
    /// The worker has been initialized, but has not yet been executed.
    | Pending
    /// The worker has been executed correctly.
    | Success
    /// The worker is running.
    | Running
    /// The worker ended with an error.
    | Error
    /// The worker was killed via timeout expiration.
    | TimeoutExpired
    /// The worker process has been terminated.
    | Killed
```

## WorkerOptions

The options that can be set during worker creation:

```fs
/// Options for worker creation.
type WorkerOptions =
    { /// The base path of where to load the worker script.
        ///
        /// Default: Tries to find the root via `document.
        /// location.href by splitting on `#` and taking the head, 
        /// if that fails it takes the `document.location.origin`. 
        /// `/Workers` is then appended to the result.
        BasePath: string
        /// A list of external dependencies such as an unpkg script.
        /// 
        /// This shouldn't be necessary, simply open the namespace/modules
        /// required and they will be included in the worker script.
        ///
        /// Default: []
        Dependencies: string list
        /// Sets the function name of the loaded umd module.
        ///
        /// Default: `None` - splits on `BasePath` by `.` and takes 
        /// the head.
        FunctionName: string option
        /// Timeout of worker function in ms.
        ///
        /// Default: `Some 5000`
        Timeout: int option }
```

## React

### WorkerCommands

Record that contains the functions to call the worker.

Signature:
```fs
type WorkerCommands<'Arg,'Result> =
    { /// Executes the worker function.
      exec: ('Arg * ('Result -> unit)) -> unit
      /// Terminates the worker instance.
      kill: unit -> unit
      /// Terminates the worker instance (if alive), then generates a new worker.
      restart: unit -> unit }
```

### React.useWorker

Creates the worker process.

Signature:
```fs
useWorker<'Arg, 'Result> (umdPath: string) : WorkerCommands<'Arg,'Result> * WorkerStatus
useWorker<'Arg, 'Result> (umdPath: string, options: WorkerOptions -> WorkerOptions) : WorkerCommands<'Arg,'Result> * WorkerStatus
```

Usage:
```fs
React.useWorker<unit,int> "Sort.sortNumbers"
React.useWorker<unit,int>("Sort.sortNumbers", fun o -> { o with Timeout = None })
```

## Elmish

### Cmd.Worker.create

Creates the worker process.

Signature:
```fs
(umdPath: string) (workerMsg: Worker<_,_> -> 'Msg) (workerStatusMsg: WorkerStatus -> 'Msg) : Cmd<_>
```

Usage:
```fs
Cmd.Worker.create "Sort.numberSort" SetWorker SetWorkerStatus
```

### Cmd.Worker.createWithOptions

Creates the worker process with additional options.

Signature:
```fs
(umdPath: string) (workerMsg: Worker<_,_> -> 'Msg) (workerStatusMsg: WorkerStatus -> 'Msg) (options: WorkerOptions -> WorkerOptions) : Cmd<_>
```

Usage:
```fs
Cmd.Worker.create "Sort.numberSort" SetWorker SetWorkerStatus (fun o -> { o with Timeout = None })
```

### Cmd.Worker.exec

Executes the worker function.

Signature:
```fs
(worker: Worker<'Arg,'Result> option) (arg: 'Arg) (msg: 'Result -> 'Msg) : Cmd<_>
```

Usage:
```fs
Cmd.Worker.exec state.Worker () WorkerResult
```

### Cmd.Worker.kill

Terminates the worker instance.

Signature:
```fs
(worker: Worker<'Arg,'Result> option) : Cmd<_>
```

Usage:
```fs
Cmd.Worker.kill state.Worker
```

### Cmd.Worker.restart

Terminates the worker instance (if alive), then generates a new worker.

Signature:
```fs
(worker: Worker<'Arg,'Result> option) : Cmd<_>
```

Usage:
```fs
Cmd.Worker.restart state.Worker
```
