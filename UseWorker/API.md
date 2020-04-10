# Feliz.UseWorker - API Reference

## WorkerFunc

The `WorkerFunc` is how you define the function that is executed
in your worker instance.

### WorkerFunc.Create

Create a function to run inside a worker instance.

Signature:
```fs
(umdPath: string,
 name: string,
 f: 'Arg -> 'Result,
 ?argCoder: WorkerArgCoders<'Arg> -> WorkerArgCoders<'Arg>,
 ?resultCoder: WorkerResultCoders<'Result> -> WorkerResultCoders<'Result>)
```

Usage:
```fs
// Inside a MyWorker.fs file

let myFunction = WorkerFunc.Create("MyWorker", "myFunction", fun () -> 1)
```

### Coders

By default when the type signature uses a primitive value (such as an int)
the message will not be encoded/decoded for message passing as the application
is able to resolve the types without it. Whenever you do use something more 
complex such as records and discriminated unions, the application will 
automatically encode/decode your messages to/from the worker. 

The coder optional coder options above in the `WorkerFunc.Create` section can
be modified by passing in a "feeder" function to make the changes and keep the
defaults for anything left alone.

#### WorkerArgCoders

This record contains the functions that will handle the encoding/decoding of 
the arguments passed to your worker instance to run in the function. 

```fs
type WorkerArgCoders<'Arg> =
    { /// Deserialization function for worker json input.
      ///
      /// Default: Fable.SimpleJson.Json.tryParseAs<'Result>
      Decoder: string -> 'Arg

      /// Serialization function for worker json input.
      ///
      /// Default: fun (arg: 'Arg) -> Fable.SimpleJson.SimpleJson.stringify arg
      Encoder: 'Arg -> string }

    static member inline Defaults =
        { Decoder = Json.parseAs<'Arg>
          Encoder = fun (arg: 'Arg) -> SimpleJson.stringify arg }
```

#### WorkerResultCoders

This record contains the functions that will handle encoding/decoding of the
result of running the worker function.

```fs
type WorkerResultCoders<'Result> =
    { /// Deserialization function for worker json response.
      ///
      /// Default: Fable.SimpleJson.Json.tryParseAs<'Result>
      Decoder: string -> Result<'Result,string>

      /// Serialization function for worker json response.
      ///
      /// Default: fun (arg: 'Result) -> Fable.SimpleJson.SimpleJson.stringify arg
      Encoder: 'Result -> string }

    static member inline Defaults =
        { Decoder = Json.tryParseAs<'Result>
          Encoder = fun (arg: 'Result) -> SimpleJson.stringify arg }
```

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
    | Error of string
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
      
      /// Execute the function on the main thread if execution is
      /// request when the worker is in a failed state.
      ///
      /// Default: true
      Fallback: bool

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
(workerFunc: WorkerFunc<'Arg,'Result>) : WorkerCommands<'Arg,'Result> * WorkerStatus
(workerFunc: WorkerFunc<'Arg,'Result>, options: WorkerOptions -> WorkerOptions) : WorkerCommands<'Arg,'Result> * WorkerStatus
```

Usage:
```fs
React.useWorker(MyWorker.myFunction)
React.useWorker(MyWorker.myFunction, fun o -> { o with Timeout = None })
```

## Elmish

### Cmd.Worker.create

Creates the worker process.

Signature:
```fs
(workerFunc: WorkerFunc<'Arg,'Result>) (workerMsg: Worker<_,_> -> 'Msg) (workerStatusMsg: WorkerStatus -> 'Msg) : Cmd<_>
```

Usage:
```fs
Cmd.Worker.create MyWorker.myFunction SetWorker SetWorkerStatus
```

### Cmd.Worker.createWithOptions

Creates the worker process with additional options.

Signature:
```fs
(workerFunc: WorkerFunc<'Arg,'Result>) (workerMsg: Worker<_,_> -> 'Msg) (workerStatusMsg: WorkerStatus -> 'Msg) (options: WorkerOptions -> WorkerOptions) : Cmd<_>
```

Usage:
```fs
Cmd.Worker.createWithOptions MyWorker.myFunction SetWorker SetWorkerStatus (fun o -> { o with Timeout = None })
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
